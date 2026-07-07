const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const warnDbPath = path.join(__dirname, 'warnings.json');

// Pro-level async cache for warnings
let warnCache = {};
try {
    if (!fs.existsSync(warnDbPath)) fs.writeFileSync(warnDbPath, JSON.stringify({}));
    warnCache = JSON.parse(fs.readFileSync(warnDbPath, 'utf-8'));
} catch (err) {
    console.error('❌ Error loading warnings.json:', err);
}

async function saveWarns() {
    try {
        await fs.promises.writeFile(warnDbPath, JSON.stringify(warnCache, null, 2));
    } catch (error) {
        console.error('❌ Failed to save Warnings:', error);
    }
}

// Convert time strings (10m, 1h) into milliseconds
function parseTime(timeStr) {
    const match = timeStr.match(/^(\d+)(s|m|h|d)$/);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2];
    if (unit === 's') return val * 1000;
    if (unit === 'm') return val * 60 * 1000;
    if (unit === 'h') return val * 60 * 60 * 1000;
    if (unit === 'd') return val * 24 * 60 * 60 * 1000;
    return null;
}

module.exports = (client) => {
    // ==========================================
    // 1. SPAWN THE BUTTON DASHBOARD
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'modpanel') return;

        // 🔒 SECURITY CHECK: Only Mods can open this panel
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: '❌ Access Denied: You do not have permission to open the mod panel.', ephemeral: true });
        }

        const targetUser = interaction.options.getUser('user');

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle(`🛡️ Moderation Panel: ${targetUser.tag}`)
            .setDescription(`Select an action below to perform on <@${targetUser.id}>.\n*You will be prompted to enter a reason in the next step.*`)
            .setThumbnail(targetUser.displayAvatarURL());

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`mod_warn_${targetUser.id}`).setLabel('Warn').setStyle(ButtonStyle.Primary).setEmoji('⚠️'),
            new ButtonBuilder().setCustomId(`mod_timeout_${targetUser.id}`).setLabel('Timeout').setStyle(ButtonStyle.Secondary).setEmoji('⏱️'),
            new ButtonBuilder().setCustomId(`mod_kick_${targetUser.id}`).setLabel('Kick').setStyle(ButtonStyle.Danger).setEmoji('👢'),
            new ButtonBuilder().setCustomId(`mod_ban_${targetUser.id}`).setLabel('Ban').setStyle(ButtonStyle.Danger).setEmoji('🔨')
        );

        await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    });

    // ==========================================
    // 2. HANDLE BUTTON CLICKS (OPEN MODALS)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isButton() || !interaction.customId.startsWith('mod_')) return;

        // Ensure the person clicking the button has permissions (prevents bypass via old buttons)
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
            return interaction.reply({ content: '❌ You do not have permission to use this button.', ephemeral: true });
        }

        const parts = interaction.customId.split('_');
        const action = parts[1];
        const targetId = parts[2];

        if (action === 'warn') {
            const modal = new ModalBuilder().setCustomId(`modal_warn_${targetId}`).setTitle('Issue a Warning');
            const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason for warning').setStyle(TextInputStyle.Paragraph).setRequired(true);
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        } 
        else if (action === 'timeout') {
            const modal = new ModalBuilder().setCustomId(`modal_timeout_${targetId}`).setTitle('Timeout User');
            const durationInput = new TextInputBuilder().setCustomId('duration').setLabel('Duration (e.g., 10m, 1h, 1d)').setStyle(TextInputStyle.Short).setRequired(true);
            const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(false);
            modal.addComponents(new ActionRowBuilder().addComponents(durationInput), new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        }
        else if (action === 'kick' || action === 'ban') {
            const modal = new ModalBuilder().setCustomId(`modal_${action}_${targetId}`).setTitle(`${action.toUpperCase()} User`);
            const reasonInput = new TextInputBuilder().setCustomId('reason').setLabel('Reason').setStyle(TextInputStyle.Paragraph).setRequired(false);
            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        }
    });

    // ==========================================
    // 3. HANDLE MODAL SUBMISSIONS (EXECUTE ACTION)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isModalSubmit() || !interaction.customId.startsWith('modal_')) return;

        const parts = interaction.customId.split('_');
        const action = parts[1];
        const targetId = parts[2];
        const reason = interaction.fields.getTextInputValue('reason') || 'No reason provided';
        
        // 🚨 PROTECTION SYSTEM CHECK
        const isProtected = client.isUserProtected && client.isUserProtected(interaction.guildId, targetId);
        if (isProtected && ['timeout', 'kick', 'ban'].includes(action)) {
            return interaction.reply({ 
                content: `❌ **Action Denied:** You cannot ${action} <@${targetId}> because they are protected by the server owner!`, 
                ephemeral: true 
            });
        }
        
        const member = await interaction.guild.members.fetch(targetId).catch(() => null);
        
        try {
            if (action === 'warn') {
                if (!warnCache[interaction.guild.id]) warnCache[interaction.guild.id] = {};
                if (!warnCache[interaction.guild.id][targetId]) warnCache[interaction.guild.id][targetId] = [];

                const warnId = Math.random().toString(36).substring(2, 8).toUpperCase();
                warnCache[interaction.guild.id][targetId].push({ id: warnId, reason: reason, moderator: interaction.user.id, date: Date.now() });
                saveWarns();

                if (member) member.send(`⚠️ You received a warning in **${interaction.guild.name}** for: *${reason}*`).catch(() => {});
                await interaction.reply({ content: `✅ Successfully warned <@${targetId}>. (Warn ID: \`${warnId}\`)`, ephemeral: true });
            } 
            
            else if (action === 'timeout') {
                if (!member) return interaction.reply({ content: '❌ User is not in the server.', ephemeral: true });
                const durationStr = interaction.fields.getTextInputValue('duration');
                const msDuration = parseTime(durationStr);
                
                if (!msDuration) return interaction.reply({ content: '❌ Invalid duration format! Use `m`, `h`, or `d`.', ephemeral: true });
                
                await member.timeout(msDuration, reason);
                await interaction.reply({ content: `✅ Successfully timed out <@${targetId}> for ${durationStr}.`, ephemeral: true });
            } 
            
            else if (action === 'kick') {
                if (!member) return interaction.reply({ content: '❌ User is not in the server.', ephemeral: true });
                await member.kick(reason);
                await interaction.reply({ content: `✅ Successfully kicked <@${targetId}>.`, ephemeral: true });
            } 
            
            else if (action === 'ban') {
                await interaction.guild.members.ban(targetId, { reason: reason });
                await interaction.reply({ content: `✅ Successfully banned <@${targetId}>.`, ephemeral: true });
            }
        } catch (error) {
            await interaction.reply({ content: `❌ Error: I don't have permission to do that to this user. Make sure my role is higher than theirs!`, ephemeral: true }).catch(() => {});
        }
    });
};
            
