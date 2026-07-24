const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// 1. We build the embed as a reusable function
const buildAdminHelpEmbed = (client) => {
    return new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle('🛡️ Starry Admin & Moderation Panel')
        .setDescription('Here is the complete list of management, moderation, and emergency commands compiled from the Manager-Bot suite and Starry Custom Modules.')
        .addFields(
            {
                name: '🚨 Emergency Protocols (Admins Only)',
                value: 
                '`/emergency-nuke` - Vaporizes all channels & roles.\n' +
                '`/emergency-lockdown` - Freezes the entire server.\n' +
                '`/emergency-secure` - Strips dangerous permissions from roles.\n' +
                '`/emergency-unban` - Mass unbans everyone in the server.'
            },
            {
                name: '⚙️ Server Configuration',
                value: 
                '`/setup-server` - Auto-builds a premium server layout.\n' +
                '`/set-name` - Changes the bot\'s custom trigger word.\n' +
                '`/boost-setup` - Sets the server boost announcement channel.\n' +
                '`/chest-setup` - Enables automatic loot chest drops.'
            },
            {
                name: '🔨 Manager-Bot Moderation Suite',
                value: 
                '`/ban` & `/unban` - Ban or unban a member.\n' +
                '`/kick` - Removes a member from the server.\n' +
                '`/timeout` & `/untimeout` - Mutes a member for a set duration.\n' +
                '`/warn` & `/warnings` - Warns a user / checks their history.\n' +
                '`/purge` or `/clear` - Bulk deletes messages.\n' +
                '`/lock` & `/unlock` - Locks/unlocks a specific channel.\n' +
                '`/slowmode` - Adjusts the channel chat delay.\n' +
                '`/role` - Manually add or remove roles from a user.'
            },
            {
                name: '🤖 AI Natural Language Moderation',
                value: 
                'You don\'t even need slash commands! Just chat with Starry:\n' +
                '*"`Starry, timeout @user for 10 minutes for spamming.`"*\n' +
                '*"`Starry, clear 50 messages in this channel.`"*\n' +
                '*"`Starry, give @user the VIP role.`"*'
            }
        )
        .setFooter({ text: 'Starry Management System', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
};

module.exports = {
    // 2. The Slash Command Configuration
    data: new SlashCommandBuilder()
        .setName('ahelp')
        .setDescription('Displays the complete Admin & Moderation Command Menu')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages), // Locks it to Mods & Admins

    async execute(interaction) {
        const embed = buildAdminHelpEmbed(interaction.client);
        return interaction.reply({ embeds: [embed], ephemeral: true });
    },
    
    // Export the embed builder so the text command can use it!
    buildAdminHelpEmbed
};
