const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    const invitesCache = new Map();

    // Fetch all invites when bot boots up
    client.on('ready', async () => {
        try {
            for (const [guildId, guild] of client.guilds.cache) {
                const guildInvites = await guild.invites.fetch().catch(() => null);
                if (guildInvites) {
                    invitesCache.set(guild.id, new Map(guildInvites.map(inv => [inv.code, inv.uses])));
                }
            }
            console.log('✅ Invite Tracker Cache Loaded');
        } catch (err) {}
    });

    // Track when someone creates a new invite link
    client.on('inviteCreate', invite => {
        const guildInvites = invitesCache.get(invite.guild.id);
        if (guildInvites) guildInvites.set(invite.code, invite.uses);
    });

    // Calculate who invited the user when they join
    client.on('guildMemberAdd', async member => {
        const cachedInvites = invitesCache.get(member.guild.id);
        const newInvites = await member.guild.invites.fetch().catch(() => null);

        if (!cachedInvites || !newInvites) return;

        let usedInvite = null;
        for (const [code, invite] of newInvites) {
            const oldUses = cachedInvites.get(code) || 0;
            if (invite.uses > oldUses) {
                usedInvite = invite;
                break;
            }
        }

        // Update the cache so it is ready for the next person
        invitesCache.set(member.guild.id, new Map(newInvites.map(inv => [inv.code, inv.uses])));

        // Send a welcome message in the server's official System Channel
        const systemChannel = member.guild.systemChannel;
        if (systemChannel && usedInvite) {
            const embed = new EmbedBuilder()
                .setColor('Purple')
                .setDescription(`📥 <@${member.id}> joined the server using **${usedInvite.inviter.username}**'s invite link! (${usedInvite.uses} total uses)`);
            systemChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });
};
