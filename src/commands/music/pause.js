const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getActiveMusicPlayer } = require('../../utils/musicPlayerResolver');

const EPHEMERAL_FLAG = (MessageFlags && MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 64;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('⏸️ Pauses the active audio playback'),
        
    async execute(interaction, client) {
        const player = getActiveMusicPlayer(interaction.guild.id, client);
        
        if (!player || (!player.currentTrack && !player.playing)) {
            return interaction.reply({ content: '❌ Nothing is currently playing in this server.', flags: [EPHEMERAL_FLAG] });
        }
        if (player.paused) {
            return interaction.reply({ content: '⚠️ The audio playback is already paused!', flags: [EPHEMERAL_FLAG] });
        }

        player.pause(true);
        return interaction.reply('⏸️ **Paused the music.**');
    }
};
