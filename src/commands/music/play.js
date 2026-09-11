// ==========================================
// 🎵 STARRY SUPREME MUSIC ENGINE - PLAY COMMAND
// File Path: commands/play.js
// Bulletproof Native Audio Streamer
// ==========================================
const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { StarryAudioEngine } = require('../../utils/nativeAudioEngine');
const config = require('../../config');

const EPHEMERAL_FLAG = (MessageFlags && MessageFlags.Ephemeral) ? MessageFlags.Ephemeral : 64;

const formatTime = (ms) => {
    if (!ms || isNaN(ms)) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Play high-fidelity audio from SoundCloud, Spotify, or web URL')
    .addStringOption(option => 
      option.setName('song')
        .setDescription('Song title, Spotify Playlist URL, or SoundCloud link')
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const rawQuery = typeof interaction.options?.getString === 'function' 
        ? interaction.options.getString('song') 
        : (interaction.args ? interaction.args.join(' ') : null);
    const query = rawQuery?.trim();
    if (!query) {
      return (interaction.reply || interaction.editReply).call(interaction, {
        content: '❌ Please provide a song name or URL! Example: `,play beggin`',
        flags: [EPHEMERAL_FLAG]
      });
    }

    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
      return (interaction.reply || interaction.editReply).call(interaction, { 
        content: '❌ You must be connected to a voice channel first!', 
        flags: [EPHEMERAL_FLAG] 
      });
    }

    const botMember = interaction.guild.members.me;
    if (botMember?.voice?.channelId && botMember.voice.channelId !== voiceChannel.id) {
      return (interaction.reply || interaction.editReply).call(interaction, { 
        content: `❌ I am already playing music in <#${botMember.voice.channelId}>! Join my channel or wait for the queue to finish.`, 
        flags: [EPHEMERAL_FLAG] 
      });
    }

    const permissions = voiceChannel.permissionsFor(botMember);
    if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions?.has(PermissionFlagsBits.Speak)) {
      return (interaction.reply || interaction.editReply).call(interaction, { 
        content: '❌ I do not have permission to **Connect** or **Speak** in your voice channel!', 
        flags: [EPHEMERAL_FLAG] 
      });
    }

    if (typeof interaction.deferReply === 'function') {
        await interaction.deferReply().catch(() => {});
    }

    const manager = client.manager;
    const hasLavalink = manager && Array.from(manager.shoukaku?.nodes?.values() || []).some(n => n.state === 1);

    if (hasLavalink) {
      try {
        const existingNative = StarryAudioEngine.getPlayer(interaction.guild.id);
        if (existingNative) existingNative.destroy();

        const isUrl = /^https?:\/\//i.test(query);
        let res = null;
        if (!isUrl) {
          try {
            res = await manager.search(query, { requester: interaction.user, engine: 'spotify' });
          } catch (spErr) {}
        }
        if (!res || !res.tracks || res.tracks.length === 0) {
          res = await manager.search(query, { requester: interaction.user });
        }

        if (res && res.tracks && res.tracks.length > 0) {
          let player = manager.getPlayer(interaction.guild.id);
          if (!player) {
            player = await manager.createPlayer({
              guildId: interaction.guild.id,
              voiceId: voiceChannel.id,
              textId: interaction.channel.id,
              deaf: true
            });
          }

          if (player.voiceId !== voiceChannel.id) {
            player.setVoiceChannel(voiceChannel.id);
          }
          player.textId = interaction.channel.id;

          const replyFunc = interaction.editReply || interaction.reply;
          const isSearch = res.type === 'SEARCH' || (res.playlistName && res.playlistName.startsWith('Search results'));
          if (!isSearch && res.type === 'PLAYLIST') {
            for (const track of res.tracks) player.queue.add(track);
            if (!player.playing && !player.paused) player.play();
            return replyFunc.call(interaction, `✅ Added playlist **${res.playlistName || 'Playlist'}** (${res.tracks.length} tracks queued).`);
          } else {
            const track = res.tracks[0];
            player.queue.add(track);
            if (!player.playing && !player.paused) player.play();
            const sourceName = track.sourceName ? (track.sourceName.charAt(0).toUpperCase() + track.sourceName.slice(1)) : 'Spotify';
            return replyFunc.call(interaction, `🎵 Queued **${track.title}** by \`${track.author}\` • ${sourceName} Hi-Fi`);
          }
        }
      } catch (lavalinkErr) {
        console.warn('⚠️ [Lavalink play.js Error, falling back to Native Audio]:', lavalinkErr.message);
      }
    }

    try {
      const player = StarryAudioEngine.getOrCreatePlayer(client, interaction.guild.id, voiceChannel, interaction.channel);
      // ⚡ Instantly join voice channel in 0.1s without waiting for search
      player.connect().catch(() => {});
      const result = await StarryAudioEngine.search(query, interaction.user);

      if (!result || !result.tracks || result.tracks.length === 0) {
        const replyFunc = interaction.editReply || interaction.reply;
        return replyFunc.call(interaction, '❌ No audio results found. Please check the song name or link!');
      }

      if (result.type === 'PLAYLIST') {
        for (const track of result.tracks) {
          player.queue.push(track);
        }
        if (!player.currentTrack) {
          await player.playNext();
        }

        const totalDurationMs = result.tracks.reduce((acc, t) => acc + (t.duration || 0), 0);
        const totalDurationStr = formatTime(totalDurationMs);

        const previewTracks = result.tracks.slice(0, 3).map((t, idx) => {
          return `\`${idx + 1}.\` **[${(t.title || 'Track').substring(0, 45)}](${t.url || 'https://discord.gg'})** • \`${t.author || 'Artist'}\` (\`${formatTime(t.duration)}\`)`;
        }).join('\n');
        const remainingCount = result.tracks.length > 3 ? `\n*... and **${result.tracks.length - 3}** more tracks*` : '';

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setAuthor({ 
            name: `📚 Playlist Enqueued • ${result.source || 'Online Stream'}`, 
            iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
          })
          .setTitle(result.playlistName ? result.playlistName.substring(0, 95) : 'Loaded Playlist')
          .setThumbnail(result.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80')
          .setDescription(
            `✅ Added **${result.tracks.length}** tracks to the server queue!\n\n` +
            `👤 **Curator / Artist:** \`${result.author || 'Featured Artist'}\`\n` +
            `🕒 **Total Estimated Playtime:** \`${totalDurationStr}\`\n` +
            `🔠 **Queue Status:** Currently playing • \`${player.queue.length}\` songs in queue\n` +
            `🔊 **Mastering:** \`Empowering Hi-Fi Dynamic EQ Active\`\n\n` +
            `📝 **Upcoming Tracks Preview:**\n` +
            `${previewTracks}${remainingCount}`
          )
          .setFooter({ text: `Requested by ${interaction.user.tag} • Prefix: ,`, iconURL: interaction.user.displayAvatarURL() })
          .setTimestamp();

        const replyFunc = interaction.editReply || interaction.reply;
        return replyFunc.call(interaction, { embeds: [embed] });
      } else {
        const track = result.tracks[0];
        if (!player.currentTrack) {
          player.queue.push(track);
          await player.playNext();
        } else {
          player.queue.push(track);
          const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setAuthor({ name: 'Track Queued • Empowering Sound Active', iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle(track.title ? track.title.substring(0, 90) : 'Track')
            .setURL(track.url || 'https://discord.gg')
            .setThumbnail(track.thumbnail || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500&q=80')
            .setDescription(
              `👤 **Artist:** \`${track.author || 'Artist'}\`\n` +
              `🕒 **Duration:** \`${formatTime(track.duration)}\`\n` +
              `🔢 **Queue Position:** \`#${player.queue.length}\`\n` +
              `🌐 **Source:** \`${track.source || 'Studio Hi-Fi'}\`\n` +
              `🔊 **Sound Profile:** \`Empowering Master Dynamic EQ\``
            )
            .setFooter({ text: `Requested by ${interaction.user.tag} • Prefix: ,` })
            .setTimestamp();

          const replyFunc = interaction.editReply || interaction.reply;
          return replyFunc.call(interaction, { embeds: [embed] });
        }
      }

    } catch (err) {
      console.error('Play error in play.js:', err);
      const replyFunc = interaction.editReply || interaction.reply;
      return replyFunc.call(interaction, `❌ Playback error: \`${err.message}\``);
    }
  }
};
