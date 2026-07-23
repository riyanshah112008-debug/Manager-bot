const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Shows the current music queue'),
        
    async execute(interaction, client) {
        const player = client.manager.getPlayer(interaction.guild.id);
        
        if (!player || !player.queue.current) return interaction.reply({ content: 'There is no music playing right now.', ephemeral: true });

        const queue = player.queue;
        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle(`🎶 Queue for ${interaction.guild.name}`)
            .setDescription(`**Now Playing:**\n[${queue.current.title}](${queue.current.uri}) - \`${queue.current.isStream ? 'LIVE' : formatTime(queue.current.length)}\``);

        if (queue.length > 0) {
            const tracks = queue.slice(0, 10).map((track, i) => {
                return `**${i + 1}.** [${track.title}](${track.uri})`;
            });
            embed.addFields({ name: 'Up Next:', value: tracks.join('\n') });
            
            if (queue.length > 10) {
                embed.setFooter({ text: `And ${queue.length - 10} more...` });
            }
        } else {
            embed.addFields({ name: 'Up Next:', value: 'The queue is empty.' });
        }

        return interaction.reply({ embeds: [embed] });
    }
};

// Helper function to format milliseconds into MM:SS
function formatTime(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
}
