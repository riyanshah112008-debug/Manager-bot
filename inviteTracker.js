const { EmbedBuilder, PermissionsBitField } = require('discord.js');

module.exports = (client) => {
    const invitesCache = new Map();

    // Fetch all invites ONLY ONCE when bot boots up safely
    client.once('ready', async () => {
        try {
            for (const [guildId, guild] of client.guilds.cache) {
                // Only attempt to fetch if the bot actually has permission to view invites
                if (guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
                    const guildInvites = await guild.invites.fetch().catch(() => null);
                    if (guildInvites) {
                        invitesCache.set(guildId, new Map(guildInvites.map(inv => [inv.code, inv.uses])));
                    }
                }
            }
            console.log('✅ Invite Tracker Cache Loaded');
        } catch (err) {
            console.error('❌ Invite Tracker Init Error:', err);
        }
    });

    // Track when someone creates a new invite link
    client.on('inviteCreate', invite => {
        const guildInvites = invitesCache.get(invite.guild.id);
        if (guildInvites) guildInvites.set(invite.code, invite.uses);
    });

    // Calculate who invited the user when they join
    client.on('guildMemberAdd', async member => {
        // We cannot check invites if we don't have the Manage Guild permission
        if (!member.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageGuild)) return;

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

        // Send a highly detailed, professional welcome message in the server's official System Channel
        const systemChannel = member.guild.systemChannel;
        if (systemChannel && usedInvite) {
            const embed = new EmbedBuilder()
                .setColor('#2b2d31') // Sleek dark theme color
                .setAuthor({ name: `${member.user.tag} has joined!`, iconURL: member.user.displayAvatarURL({ dynamic: true }) })
                .setDescription(`Welcome <@${member.id}> to **${member.guild.name}**!`)
                .addFields(
                    { name: '📨 Invited By', value: `<@${usedInvite.inviter.id}> (\`${usedInvite.inviter.tag}\`)`, inline: true },
                    { name: '🔗 Invite Code', value: `\`${usedInvite.code}\``, inline: true },
                    { name: '📊 Total Uses', value: `\`${usedInvite.uses}\` uses`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .setFooter({ text: `Member #${member.guild.memberCount}`, iconURL: member.guild.iconURL({ dynamic: true }) })
                .setTimestamp();

            systemChannel.send({ embeds: [embed] }).catch(() => {});
        }
    });
};
            
