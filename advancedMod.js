const { PermissionsBitField, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const warnDbPath = path.join(__dirname, 'warnings.json');

module.exports = (client) => {
    const PREFIX = '.';

    function getWarns() {
        if (!fs.existsSync(warnDbPath)) fs.writeFileSync(warnDbPath, JSON.stringify({}));
        return JSON.parse(fs.readFileSync(warnDbPath, 'utf-8'));
    }

    function saveWarns(data) {
        fs.writeFileSync(warnDbPath, JSON.stringify(data, null, 2));
    }

    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'warn',
                description: 'Issue a formal warning to a user (Mod Only)',
                default_member_permissions: '8192', // Manage Messages permission
                options: [
                    { name: 'user', description: 'The user to warn', type: 6, required: true },
                    { name: 'reason', description: 'Reason for the warning', type: 3, required: true }
                ]
            });
            await client.application.commands.create({
                name: 'warnings',
                description: 'Check a user\'s warnings (Mod Only)',
                default_member_permissions: '8192',
                options: [{ name: 'user', description: 'The user to check', type: 6, required: true }]
            });
            await client.application.commands.create({
                name: 'lockdown',
                description: 'Lock or Unlock the current channel (Admin Only)',
                default_member_permissions: '8',
                options: [
                    { name: 'action', description: 'Lock or Unlock', type: 3, required: true, choices: [{ name: 'Lock', value: 'lock' }, { name: 'Unlock', value: 'unlock' }] }
                ]
            });
            console.log('✅ Enhanced Security & Moderation Loaded');
        } catch (err) {}
    });

    // ==========================================
    // 1. WARNING SYSTEM & LOCKDOWN (SLASH COMMANDS)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        // --- WARNINGS ---
        if (interaction.commandName === 'warn') {
            const target = interaction.options.getUser('user');
            const reason = interaction.options.getString('reason');

            const warns = getWarns();
            if (!warns[interaction.guild.id]) warns[interaction.guild.id] = {};
            if (!warns[interaction.guild.id][target.id]) warns[interaction.guild.id][target.id] = [];

            const warnId = Math.random().toString(36).substring(2, 8).toUpperCase();
            warns[interaction.guild.id][target.id].push({ id: warnId, reason: reason, moderator: interaction.user.id, date: Date.now() });
            saveWarns(warns);

            await interaction.reply({ content: `✅ **${target.tag}** has been warned. (Warn ID: \`${warnId}\`)` }).catch(() => {});
            target.send(`⚠️ You received a warning in **${interaction.guild.name}** for: *${reason}*`).catch(() => {});
        }

        if (interaction.commandName === 'warnings') {
            const target = interaction.options.getUser('user');
            const warns = getWarns();
            const userWarns = warns[interaction.guild.id]?.[target.id] || [];

            if (userWarns.length === 0) return interaction.reply({ content: `✅ **${target.tag}** has no warnings.`, ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor('Orange')
                .setTitle(`⚠️ Warnings for ${target.tag}`)
                .setDescription(userWarns.map((w, i) => `**${i + 1}.** [ID: \`${w.id}\`] ${w.reason} *(By <@${w.moderator}>)*`).join('\n'));

            await interaction.reply({ embeds: [embed], ephemeral: true }).catch(() => {});
        }

        // --- LOCKDOWN ---
        if (interaction.commandName === 'lockdown') {
            const action = interaction.options.getString('action');
            const role = interaction.guild.roles.everyone;

            if (action === 'lock') {
                await interaction.channel.permissionOverwrites.edit(role, { SendMessages: false });
                await interaction.reply('🔒 **CHANNEL LOCKEDDOWN.** Normal users can no longer send messages here.').catch(() => {});
            } else {
                await interaction.channel.permissionOverwrites.edit(role, { SendMessages: null });
                await interaction.reply('🔓 **CHANNEL UNLOCKED.** Normal users can send messages again.').catch(() => {});
            }
        }
    });

    // ==========================================
    // 2. DISCORD INVITE SPAM PROTECTOR (PASSIVE)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        
        // Admins bypass the invite filter
        if (message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

        const inviteRegex = /(discord\.gg\/|discord\.com\/invite\/)[a-zA-Z0-9]+/i;
        
        if (inviteRegex.test(message.content)) {
            await message.delete().catch(() => {});
            
            const warningMsg = await message.channel.send(`⚠️ <@${message.author.id}>, posting external Discord invites is strictly forbidden!`);
            setTimeout(() => warningMsg.delete().catch(() => {}), 5000);

            try {
                // Auto-timeout for 10 minutes for sending invites
                await message.member.timeout(10 * 60 * 1000, "Automod: Unauthorized Discord Invite");
            } catch (err) {
                console.log("Could not timeout user for invite spam.");
            }
        }
    });
};
