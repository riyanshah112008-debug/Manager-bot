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

        const embed = new EmbedBuilder()
          .setColor(config.EMBED_COLORS.PRIMARY)
          .setTitle('📚 Playlist Loaded')
          .setDescription(`✅ Added **${result.tracks.length}** tracks from **${result.playlistName || 'Playlist'}** to queue!`)
          .addFields(
            { name: '🔠 Total Queue', value: `\`${player.queue.length}\` tracks`, inline: true },
            { name: '👤 Requester', value: `${interaction.user}`, inline: true }
          )
          .setFooter({ text: 'Starry Native Audio Engine • Prefix: ,' })
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
            .setColor(config.EMBED_COLORS.PRIMARY)
            .setAuthor({ name: 'Track Queued', iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle(track.title ? track.title.substring(0, 90) : 'Track')
            .setURL(track.url || 'https://discord.gg')
            .setThumbnail(track.thumbnail || 'https://i.imgur.com/8QJ8zuz.png')
            .setDescription(`👤 **Author:** \`${track.author || 'Artist'}\`\n🕒 **Duration:** \`${formatTime(track.duration)}\`\n🔢 **Queue Position:** \`#${player.queue.length}\``)
            .setFooter({ text: 'Use ,queue to view songs • Prefix: ,' })
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
