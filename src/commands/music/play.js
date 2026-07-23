const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from SoundCloud or Spotify')
        .addStringOption(option => 
            option.setName('song')
                .setDescription('Song name, SoundCloud URL, or Spotify URL')
                .setRequired(true)
        ),
    
    async execute(interaction, client) {
        const query = interaction.options.getString('song');
        
        // Safely check for the voice channel to prevent crashes
        const voiceChannel = interaction.member.voice?.channel;
        if (!voiceChannel) return interaction.reply({ content: 'You must be in a voice channel!', ephemeral: true });

        // Defer reply prevents the "application did not respond" timeout error
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

            // 1. Initial Search (Native Spotify link support + Default SoundCloud search)
            let result = await client.manager.search(query, interaction.user);

            // 2. Fallback to YouTube Music for Commercial Pop Songs (e.g., Dua Lipa)
            // We only trigger this if it's text (not a URL) and the first search failed
            if (!query.startsWith('http') && (!result || result.type === 'EXCEPTION' || result.type === 'NO_MATCHES' || !result.tracks.length)) {
                console.log(`[Music] SoundCloud failed to find "${query}". Trying YouTube Music...`);
                result = await client.manager.search(`ytmsearch:${query}`, interaction.user);
                
                // 3. Final Fallback to standard YouTube
                if (!result || result.type === 'EXCEPTION' || result.type === 'NO_MATCHES' || !result.tracks.length) {
                    console.log(`[Music] YouTube Music failed. Trying standard YouTube...`);
                    result = await client.manager.search(`ytsearch:${query}`, interaction.user);
                }
            }

            // If ALL engines fail or a Spotify link fails to resolve
            if (!result || !result.tracks.length) {
                return interaction.editReply('❌ No results found. If this is a Spotify link, double-check your Client ID & Secret in Render.');
            }

            // Handle Playlists (Spotify Albums/Playlists)
            if (result.type === 'PLAYLIST' || result.type === 'PLAYLIST_LOADED') {
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
            // Catches public node crashes and reports them safely
            console.error('❌ Play Command Error:', error);
            return interaction.editReply('❌ An internal error occurred while trying to load the track. The public node might be restarting.');
        }
    }
};
