const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    PermissionFlagsBits 
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const BOT_OWNERS = ['1465049039153135639', '1257676837249617971'];
const warnDbPath = path.join(__dirname, 'warnings.json');

// Async cache setup for warnings
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('modpanel')
        .setDescription('Open an interactive Moderation Control Panel for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt => opt.setName('user').setDescription('The user to moderate').setRequired(true)),

    async execute(interaction) {
        const { member, options, user } = interaction;
        const isOwner = BOT_OWNERS.includes(user.id);

        if (!isOwner && !member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({ content: '❌ Access Denied: You do not have permission to open the mod panel.', ephemeral: true });
        }

        const targetUser = options.getUser('user');

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
    }
};
