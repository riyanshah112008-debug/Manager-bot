const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { getActiveMusicPlayer } = require('../../utils/musicPlayerResolver');

const EPHEMERAL_FLAG = (MessageFlags && MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 64;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('⏭️ Skips the current track'),
        
    async execute(interaction, client) {
        const player = getActiveMusicPlayer(interaction.guild.id, client);
        
        if (!player || (!player.currentTrack && !player.playing)) {
            return interaction.reply({ content: '❌ Nothing is currently playing in this server.', flags: [EPHEMERAL_FLAG] });
        }

        const title = player.currentTrack?.title || player.queue?.current?.title || 'Current Track';
        player.skip();
        return interaction.reply(`⏭️ **Skipped:** \`${title}\``);
    }
};
