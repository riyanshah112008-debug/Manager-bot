const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('🎵 Play a song, Spotify Playlist, or Blend link')
        .addStringOption(option => 
            option.setName('song')
                .setDescription('Song name, Spotify Playlist URL, or SoundCloud URL')
                .setRequired(true)
        ),

    async execute(interaction, client) {
        const query = interaction.options.getString('song');
        const voiceChannel = interaction.member.voice?.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }

        await interaction.deferReply();

        try {
            // Quick intercept: Spotify Blend Invite Links
            if (query.includes('spotify.com/blend') && !query.includes('/playlist/')) {
                return interaction.editReply('⚠️ **Spotify Blend Notice:** I cannot read Blend *invite* links. Please open the Blend in your app, tap the **3 dots (...)**, select **Share**, and copy the **Playlist Link**!');
            }

            const player = await client.manager.createPlayer({
                guildId: interaction.guild.id,
                textId: interaction.channel.id,
                voiceId: voiceChannel.id,
                volume: 100,
                deaf: true
            });

            if (!player) return interaction.editReply('❌ Could not connect to the music node.');

            // 1. Initial Search (Reverted to your original syntax for compatibility)
            let result = await client.manager.search(query, interaction.user);

            // 2. Fallbacks
            if (!query.startsWith('http') && (!result || result.type === 'EXCEPTION' || result.type === 'NO_MATCHES' || !result.tracks.length)) {
                result = await client.manager.search(`ytmsearch:${query}`, interaction.user);
                
                if (!result || result.type === 'EXCEPTION' || result.type === 'NO_MATCHES' || !result.tracks.length) {
                    result = await client.manager.search(`ytsearch:${query}`, interaction.user);
                }
            }

            if (!result || !result.tracks.length) {
                return interaction.editReply('❌ No results found. Ensure your playlist is Public, and check your Spotify IDs in Render.');
            }

            // ==========================================
            // 💿 PLAYLIST / ALBUM HANDLER
            // ==========================================
            if (result.type === 'PLAYLIST' || result.type === 'PLAYLIST_LOADED') {
                for (const track of result.tracks) {
                    player.queue.add(track);
                }
                
                if (!player.playing && !player.paused) await player.play();

                const embed = new EmbedBuilder()
                    .setColor('#1DB954')
                    .setAuthor({ name: 'Playlist Added to Queue', iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(result.playlistName || 'Spotify Playlist')
                    .setDescription(`✅ Successfully added **${result.tracks.length}** tracks to the queue!`)
                    .setFooter({ text: 'Starry Music Engine' });

                return interaction.editReply({ embeds: [embed] });
            } 
            
            // ==========================================
            // 🎵 SINGLE TRACK HANDLER
            // ==========================================
            else {
                const track = result.tracks[0];
                player.queue.add(track);
                
                if (!player.playing && !player.paused) await player.play();

                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setAuthor({ name: 'Added to Queue', iconURL: interaction.user.displayAvatarURL() })
                    .setTitle(track.title)
                    .setURL(track.uri)
                    .setThumbnail(track.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
                    .setDescription(`👤 **Artist:** ${track.author}`)
                    .setFooter({ text: 'Starry Music Engine' });

                return interaction.editReply({ embeds: [embed] });
            }

        } catch (error) {
            console.error('❌ Play Command Error:', error);
            // 🚨 CRASH REPORTER: This will print the EXACT error to Discord!
            return interaction.editReply(`❌ **System Crash:** \`${error.message}\`\n\n*(If this says "No available nodes", your Lavalink servers are currently offline!)*`);
        }
    }
};
