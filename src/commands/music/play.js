const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  PermissionFlagsBits 
} = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Play a song, Spotify Playlist, or SoundCloud link with interactive DJ controls!')
    .addStringOption(option => 
      option.setName('song')
        .setDescription('Song name, Spotify Playlist URL, or SoundCloud URL')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const query = interaction.options.getString('song');
    const voiceChannel = interaction.member.voice?.channel;

    // 1. Voice Channel Validation
    if (!voiceChannel) {
      return interaction.reply({ content: '❌ You must be connected to a voice channel first!', ephemeral: true });
    }

    // 2. Permission Check
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      return interaction.reply({ content: '❌ I do not have permission to **Connect** or **Speak** in your voice channel!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
      // Reject Spotify Blend invite links (non-playlist links)
      if (query.includes('spotify.com/blend') && !query.includes('/playlist/')) {
        return interaction.editReply('⚠️ **Spotify Blend Notice:** I cannot read Blend *invite* links. Please copy the actual **Playlist Link**!');
      }

      // ⏱️ 10-Second Anti-Hang Timeout Guard
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('NODE_TIMEOUT')), 10000)
      );

      // Connect Lavalink Player
      const playerPromise = client.manager.createPlayer({
        guildId: interaction.guild.id,
        textId: interaction.channel.id,
        voiceId: voiceChannel.id,
        volume: 100,
        deaf: true
      });

      const player = await Promise.race([playerPromise, timeoutPromise]);

      if (!player) {
        return interaction.editReply('❌ Could not connect to the Lavalink music engine.');
      }

      // Search for Track / Playlist
      let result = await Promise.race([
        client.manager.search(query, interaction.user),
        timeoutPromise
      ]);

      // Search Fallback for raw query strings
      if (!query.startsWith('http') && (!result || result.type === 'EXCEPTION' || result.type === 'NO_MATCHES' || !result.tracks.length)) {
        result = await client.manager.search(`ytmsearch:${query}`, interaction.user);
      }

      if (!result || !result.tracks.length) {
        return interaction.editReply('❌ No results found! If using a Spotify playlist, make sure it is set to **Public**.');
      }

      // Formatting Duration Utility
      const formatTime = (ms) => {
        if (!ms) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
      };

      // 🎛️ Interactive Action Row 1: Playback Controls
      const playbackRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_pause').setEmoji('⏸️').setLabel('Pause/Resume').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('music_skip').setEmoji('⏭️').setLabel('Skip').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_loop').setEmoji('🔁').setLabel('Loop').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setEmoji('⏹️').setLabel('Stop').setStyle(ButtonStyle.Danger)
      );

      // 🎛️ Interactive Action Row 2: Volume & VC Controls
      const djRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dj_vol_down').setEmoji('🔉').setLabel('-10%').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_vol_up').setEmoji('🔊').setLabel('+10%').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('dj_lock').setEmoji('🔒').setLabel('Lock VC').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('dj_unlock').setEmoji('🔓').setLabel('Unlock VC').setStyle(ButtonStyle.Success)
      );

      // 💿 3. PLAYLIST HANDLER
      if (result.type === 'PLAYLIST' || result.type === 'PLAYLIST_LOADED') {
        for (const track of result.tracks) player.queue.add(track);
        if (!player.playing && !player.paused) await player.play();

        const embed = new EmbedBuilder()
          .setColor('#1DB954')
          .setAuthor({ name: 'Playlist Added to Queue', iconURL: interaction.user.displayAvatarURL() })
          .setTitle(result.playlistName || 'Spotify / Custom Playlist')
          .setThumbnail(result.tracks[0]?.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
          .setDescription(
            `✅ Loaded **${result.tracks.length}** tracks into the queue!\n\n` +
            `👤 **Requester:** <@${interaction.user.id}>\n` +
            `🔠 **Queue Position:** #${player.queue.length}`
          )
          .setFooter({ text: 'Starry Music Engine • Use DJ controls below to manage playback', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed], components: [playbackRow, djRow] });
      } 

      // 🎵 4. SINGLE TRACK HANDLER
      else {
        const track = result.tracks[0];
        player.queue.add(track);
        if (!player.playing && !player.paused) await player.play();

        const isCurrentlyPlaying = player.queue.length === 0 && player.playing;

        const embed = new EmbedBuilder()
          .setColor(isCurrentlyPlaying ? '#2b2d31' : '#5865F2')
          .setAuthor({ 
            name: isCurrentlyPlaying ? 'Now Playing' : 'Added to Queue', 
            iconURL: interaction.user.displayAvatarURL() 
          })
          .setTitle(track.title)
          .setURL(track.uri)
          .setThumbnail(track.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
          .setDescription(
            `👤 **Artist/Author:** \`${track.author || 'Unknown'}\`\n` +
            `🕒 **Duration:** \`${track.isStream ? '🔴 LIVE' : formatTime(track.length)}\`\n` +
            `👤 **Requester:** <@${interaction.user.id}>\n` +
            `🔠 **Total Queue:** \`${player.queue.length}\` songs remaining`
          )
          .setFooter({ text: 'Starry Music Engine • Interactive DJ Controls Enabled', iconURL: client.user.displayAvatarURL() })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed], components: [playbackRow, djRow] });
      }

    } catch (error) {
      console.error('❌ Play Command Error:', error);

      if (error.message === 'NODE_TIMEOUT') {
        return interaction.editReply('🔴 **Lavalink Timeout:** The music nodes did not respond in time. Please try again in a few seconds!');
      }

      return interaction.editReply(`❌ **Playback Error:** \`${error.message}\``);
    }
  }
};
