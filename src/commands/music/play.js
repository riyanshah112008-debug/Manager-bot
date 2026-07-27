const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Play a song, Spotify Playlist, or SoundCloud link')
    .addStringOption(option => 
      option.setName('song')
        .setDescription('Song name, Spotify Playlist URL, or SoundCloud URL')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const query = interaction.options.getString('song');
    const voiceChannel = interaction.member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You must be connected to a voice channel first!', ephemeral: true });
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      return interaction.reply({ content: '❌ I do not have permission to **Connect** or **Speak** in your voice channel!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      if (query.includes('spotify.com/blend') && !query.includes('/playlist/')) {
        return interaction.editReply('⚠️ **Spotify Blend Notice:** Please copy the actual **Playlist Link**!');
      }

      // 10-Second Anti-Hang Guard
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('NODE_TIMEOUT')), 10000)
      );

      const playerPromise = client.manager.createPlayer({
        guildId: interaction.guild.id,
        textId: interaction.channel.id,
        voiceId: voiceChannel.id,
        volume: 100,
        deaf: true
      });

      const player = await Promise.race([playerPromise, timeoutPromise]);

      if (!player) return interaction.editReply('❌ Could not connect to the music engine.');

      let result = await Promise.race([
        client.manager.search(query, interaction.user),
        timeoutPromise
      ]);

      if (!query.startsWith('http') && (!result || result.type === 'EXCEPTION' || result.type === 'NO_MATCHES' || !result.tracks.length)) {
        result = await client.manager.search(`ytmsearch:${query}`, interaction.user);
      }

      if (!result || !result.tracks.length) {
        return interaction.editReply('❌ No results found. Ensure your playlist is Public!');
      }

      // Pass interaction so playerStart in index.js edits this reply directly!
      player.data.set('interaction', interaction);

      // PLAYLIST HANDLER
      if (result.type === 'PLAYLIST' || result.type === 'PLAYLIST_LOADED') {
        for (const track of result.tracks) player.queue.add(track);
        
        if (!player.playing && !player.paused) {
          await player.play(); // playerStart will turn this interaction into the Master Embed
        } else {
          const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setAuthor({ name: 'Playlist Added to Queue', iconURL: interaction.user.displayAvatarURL() })
            .setTitle(result.playlistName || 'Spotify Playlist')
            .setDescription(`✅ Added **${result.tracks.length}** tracks to queue!`)
            .setFooter({ text: 'Starry Music Engine' });

          return interaction.editReply({ embeds: [embed] });
        }
      } 
      // SINGLE TRACK HANDLER
      else {
        const track = result.tracks[0];
        player.queue.add(track);

        if (!player.playing && !player.paused) {
          await player.play(); // playerStart will turn this interaction into the Master Embed
        } else {
          const formatTime = (ms) => {
            if (!ms) return '0:00';
            const totalSeconds = Math.floor(ms / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
          };

          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: 'Added to Queue', iconURL: interaction.user.displayAvatarURL() })
            .setTitle(track.title)
            .setURL(track.uri)
            .setThumbnail(track.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
            .setDescription(`👤 **Artist:** \`${track.author || 'Unknown'}\` | 🕒 **Duration:** \`${formatTime(track.length)}\`\n🔠 **Queue Position:** #${player.queue.length}`)
            .setFooter({ text: 'Starry Music Engine' });

          return interaction.editReply({ embeds: [embed] });
        }
      }

    } catch (error) {
      console.error('❌ Play Command Error:', error);
      if (error.message === 'NODE_TIMEOUT') {
        return interaction.editReply('🔴 **Timeout:** Lavalink nodes did not respond in time.');
      }
      return interaction.editReply(`❌ **Error:** \`${error.message}\``);
    }
  }
};
