const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song via Lavalink')
        .addStringOption(option => 
            option.setName('song')
                .setDescription('The song name or URL')
                .setRequired(true)
        ),
    
    async execute(interaction, client) {
        // Fetching 'song' to match your deploy-commands.js structure
        const query = interaction.options.getString('song');
        const { channel } = interaction.member.voice;

        if (!channel) return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });

        // Defer reply prevents the "application did not respond" timeout
        await interaction.deferReply();

        // Create or get the player for this server
        const player = await client.manager.createPlayer({
            guildId: interaction.guild.id,
            textId: interaction.channel.id,
            voiceId: channel.id,
            volume: 100
        });

        // Search for the track using Lavalink
        const result = await client.manager.search(query, interaction.user);

        if (!result.tracks.length) return interaction.editReply('❌ No results found.');

        // Handle Playlists vs Single Tracks
        if (result.type === 'PLAYLIST') {
            for (let track of result.tracks) player.queue.add(track);
            if (!player.playing && !player.paused) player.play();
            return interaction.editReply(`📚 Added playlist **${result.playlistName}** (${result.tracks.length} tracks) to the queue.`);
        } else {
            const track = result.tracks[0];
            player.queue.add(track);
            if (!player.playing && !player.paused) player.play();
            return interaction.editReply(`🎵 Added **${track.title}** to the queue.`);
        }
    }
};
