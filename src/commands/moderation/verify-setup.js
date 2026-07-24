const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('verify-setup')
        .setDescription('Set up the server verification panel (Admins Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(option => 
            option.setName('channel')
                .setDescription('The channel to send the verification panel')
                .setRequired(true)
        )
        .addRoleOption(option => 
            option.setName('role')
                .setDescription('The role to give users when they verify')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const channel = interaction.options.getChannel('channel');
        const role = interaction.options.getRole('role');

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('✅ Server Verification')
            .setDescription('Welcome! To protect this server from automated accounts, we require web verification.\n\nClick the button below to generate your secure, one-time verification link.')
            .setFooter({ text: 'Starry Security Protocol', iconURL: client.user.displayAvatarURL() });

        const button = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`verify_role_${role.id}`) 
                .setLabel('Get Verification Link')
                .setEmoji('🌐')
                .setStyle(ButtonStyle.Primary)
        );

        await channel.send({ embeds: [embed], components: [button] });
        return interaction.reply({ content: `✅ Web Verification panel successfully set up in ${channel}!`, ephemeral: true });
    }
};
