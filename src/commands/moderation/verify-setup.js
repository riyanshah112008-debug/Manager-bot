const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, PermissionFlagsBits, ChannelType, MessageFlags
} = require('discord.js');
const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify-setup')
    .setDescription('Configure and publish Starry multi-method verification')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName('channel').setDescription('Where to publish the verification panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addRoleOption(o => o.setName('role').setDescription('Role granted after successful verification').setRequired(true))
    .addIntegerOption(o => o.setName('minimum-account-age').setDescription('Minimum Discord account age in days (0 disables)').setMinValue(0).setMaxValue(3650).setRequired(false)),

  async execute(interaction) {
    try {
      await interaction.deferReply({ flags: [EPHEMERAL_FLAG] });
      const channel = interaction.options.getChannel('channel');
      const role = interaction.options.getRole('role');
      const minAge = interaction.options.getInteger('minimum-account-age') ?? 3;
      const bot = interaction.guild.members.me || await interaction.guild.members.fetch(interaction.client.user.id).catch(() => null);
      const perms = channel.permissionsFor(bot);
      if (!perms?.has(PermissionFlagsBits.SendMessages) || !perms?.has(PermissionFlagsBits.EmbedLinks)) {
        return interaction.editReply({ content: 'Starry needs Send Messages and Embed Links in the selected channel.' });
      }
      if (!bot?.permissions.has(PermissionFlagsBits.ManageRoles)) return interaction.editReply({ content: 'Starry needs the Manage Roles permission.' });
      if (role.managed || role.id === interaction.guild.id || role.position >= bot.roles.highest.position) {
        return interaction.editReply({ content: 'Move Starry’s highest role above the selected verified role, then run setup again.' });
      }

      const mongoose = require('mongoose');
      if (mongoose.connection?.readyState !== 1) return interaction.editReply({ content: 'Database is not connected. Verification settings cannot be saved right now.' });
      const ServerSettings = require('../../models/ServerSettings');
      const settings = await ServerSettings.findOneAndUpdate(
        { guildId: String(interaction.guildId) },
        { $set: { 'verification.enabled': true, 'verification.roleId': role.id, 'verification.channelId': channel.id, 'verification.minAccountAgeDays': minAge } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle('🛡️ Verify to access the server')
        .setDescription('Welcome! Complete one of the available verification methods below. Starry checks account age and assigns your member role only after a successful check.\n\n**Available methods**\n• One-click confirmation\n• Math challenge\n• Web verification link\n• Verification link by DM\n• Server rules acceptance')
        .setFooter({ text: 'Starry Security • Your verification session is private' });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('starry_verify_open').setLabel('Start verification').setEmoji('🛡️').setStyle(ButtonStyle.Primary)
      );
      const message = await channel.send({ embeds: [embed], components: [row] });
      settings.verification.panelMessageId = message.id;
      await settings.save();
      return interaction.editReply({ content: '✅ Multi-method verification is enabled and the panel is live in ' + channel + '. Minimum account age: ' + minAge + ' day(s). Configure methods, rules and logging in the dashboard’s Verification module.' });
    } catch (error) {
      console.error('[verify-setup]', error);
      const payload = { content: 'Verification setup failed: ' + (error.message || 'Unknown error') };
      if (interaction.deferred || interaction.replied) return interaction.editReply(payload).catch(() => {});
      return interaction.reply({ ...payload, flags: [EPHEMERAL_FLAG] }).catch(() => {});
    }
  }
};
