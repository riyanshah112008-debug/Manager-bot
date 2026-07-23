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
        const query = interaction.options.getString('song');
        
        // Safely check for the voice channel to prevent crashes
        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel) return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });

        // Defer reply prevents the timeout error
        await interaction.deferReply();

        try {
            // Create or get the player for this server
            const player = await client.manager.createPlayer({
                guildId: interaction.guild.id,
                textId: interaction.channel.id,
                voiceId: voiceChannel.id,
                volume: 100
            });

            if (!player) return interaction.editReply('❌ Could not connect to the music node.');

            // Search for the track
            let result = await client.manager.search(query, interaction.user);

            // If YouTube is rate-limited on the public node, try SoundCloud fallback
            if (!result || result.type === 'EXCEPTION' || result.type === 'NO_MATCHES' || !result.tracks.length) {
                console.log(`[Music] YouTube search failed or blocked for "${query}". Trying SoundCloud fallback...`);
                result = await client.manager.search(`scsearch:${query}`, interaction.user);
                
                if (!result || !result.tracks.length) {
                    return interaction.editReply('❌ No results found, or the public node is currently rate-limited by YouTube. Try a direct link!');
                }
            }

            // Handle Playlists
            if (result.type === 'PLAYLIST' || result.type === 'PLAYLIST_LOADED') {
                // Provide a safe fallback name if playlistName is missing
                const pName = result.playlistName || 'Playlist'; 
                for (let track of result.tracks) player.queue.add(track);
                if (!player.playing && !player.paused) player.play();
                return interaction.editReply(`📚 Added playlist **${pName}** (${result.tracks.length} tracks) to the queue.`);
            } 
            // Handle Single Tracks
            else {
                const track = result.tracks[0];
                player.queue.add(track);
                if (!player.playing && !player.paused) player.play();
                return interaction.editReply(`🎵 Added **${track.title}** to the queue.`);
            }

        } catch (error) {
            // If it crashes, log it to Render and give a clean error to Discord
            console.error('❌ Play Command Error:', error);
            return interaction.editReply('❌ An internal error occurred while trying to load the track. The public node might be restarting.');
        }
    }
};
