const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { StarryAudioEngine } = require('../../utils/nativeAudioEngine');

const EPHEMERAL_FLAG = (MessageFlags && MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 64;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('📻 Toggle smart recommendation autoplay when playlist ends'),

    async execute(interaction, client) {
        const voiceChannel = interaction.member?.voice?.channel;
        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be connected to a voice channel first!', flags: [EPHEMERAL_FLAG] });
        }

        const player = StarryAudioEngine.getOrCreatePlayer(client, interaction.guild.id, voiceChannel, interaction.channel);
        player.autoplay = !player.autoplay;

        return interaction.reply(`📻 **Autoplay recommendation stream is now:** **${player.autoplay ? '🟢 ENABLED' : '🔴 DISABLED'}**!`);
    }
};
