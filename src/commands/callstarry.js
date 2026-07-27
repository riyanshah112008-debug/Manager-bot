const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { 
  joinVoiceChannel, 
  createAudioPlayer, 
  createAudioResource, 
  AudioPlayerStatus,
  EndBehaviorType,
  getVoiceConnection,
  VoiceConnectionStatus
} = require('@discordjs/voice');
const prism = require('prism-media');
const { GoogleGenAI } = require('@google/genai');
const googleTTS = require('google-tts-api');
const mongoose = require('mongoose');

// Initialize Gemini SDK with your GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('callstarry')
    .setDescription('📞 Call Starry for a private 1-on-1 human-like AI voice call! (Premium Only)'),

  async execute(interaction) {
  async execute(interaction) {
    // ==========================================
    // 👑 1. INSTANT PREMIUM CHECK
    // ==========================================
    const isPremium = interaction.client.isPremium(interaction.guild.id, interaction.user.id);

    if (!isPremium) {
      const premiumEmbed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('✨ Starry Premium Feature')
        .setDescription(
          `📞 **\` /callstarry \` Voice AI is an exclusive Starry Premium feature!**\n\n` +
          `Unlock **1-on-1 real-time voice calls** with Starry, featuring human-like speech, emotions, dynamic listening, and seamless conversations.`
        )
        .addFields(
          { name: '💎 How to Unlock', value: 'Run `/activatepremium` or visit our web dashboard to activate Premium!', inline: false }
        )
        .setFooter({ text: 'Starry Voice AI • Powered by Gemini 2.5', iconURL: interaction.client.user.displayAvatarURL() })
        .setTimestamp();

      return interaction.reply({ embeds: [premiumEmbed], ephemeral: true });
    }

    // ... rest of callstarry execute function ...
 ==========================================
    // 🎙️ 2. VOICE CHANNEL VALIDATION & JOIN
    // ==========================================
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return interaction.reply({ 
        content: "❌ You need to be in a voice channel first to call me!", 
        ephemeral: true 
      });
    }

    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      return interaction.reply({ 
        content: "❌ I don't have permissions to connect and speak in your voice channel!", 
        ephemeral: true 
      });
    }

    const humanMembers = voiceChannel.members.filter(m => !m.user.bot);
    if (humanMembers.size > 1) {
      return interaction.reply({ 
        content: "🔒 `/callstarry` is for private 1-on-1 calls. Please call me when you are alone in VC!", 
        ephemeral: true 
      });
    }

    await interaction.reply({ 
      content: `📞 **Connecting to ${voiceChannel.name}...** Hey ${member.displayName}, Starry is on the line!` 
    });

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    let audioQueue = [];
    let isProcessing = false;
    let inactivityTimeout = null;

    const chatHistory = [
      {
        role: "user",
        parts: [{ 
          text: `You are Starry, a warm, witty, and empathetic AI friend having a 1-on-1 voice call on Discord. 
Rules for your voice responses:
- Speak naturally like a real human on a casual phone call.
- Keep responses short (1 to 2 sentences max; around 15-25 words).
- Use natural conversational fillers ("oh wow", "yeah", "hmm", "haha") when appropriate.
- DO NOT use markdown characters like asterisks, bullet points, or emojis since your words are read aloud by TTS.` 
        }]
      },
      {
        role: "model",
        parts: [{ text: "Hey! Starry here. I'm connected and ready to hang out. What's on your mind today?" }]
      }
    ];

    const playNextInQueue = () => {
      if (audioQueue.length > 0) {
        const nextUrl = audioQueue.shift();
        const resource = createAudioResource(nextUrl);
        player.play(resource);
      }
    };

    player.on(AudioPlayerStatus.Idle, () => {
      playNextInQueue();
    });

    const resetInactivityTimer = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        cleanupAndDisconnect();
      }, 3 * 60 * 1000);
    };

    const cleanupAndDisconnect = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      interaction.client.removeListener('voiceStateUpdate', channelListener);
      player.stop();
      const activeConn = getVoiceConnection(interaction.guild.id);
      if (activeConn && activeConn.state.status !== VoiceConnectionStatus.Destroyed) {
        activeConn.destroy();
      }
    };

    resetInactivityTimer();

    // ==========================================
    // 🎧 3. REAL-TIME VOICE PROCESSING ENGINE
    // ==========================================
    const receiver = connection.receiver;

    receiver.speaking.on('start', (speakingUserId) => {
      if (speakingUserId !== member.id) return;

      if (player.state.status === AudioPlayerStatus.Playing) {
        audioQueue = [];
        player.stop();
      }

      if (isProcessing) return;
      resetInactivityTimer();

      const audioStream = receiver.subscribe(member.id, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1200,
        },
      });

      const opusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
      const pcmChunks = [];

      audioStream.pipe(opusDecoder);
      opusDecoder.on('data', (chunk) => pcmChunks.push(chunk));

      opusDecoder.on('end', async () => {
        const buffer = Buffer.concat(pcmChunks);
        if (buffer.length < 12000) return;

        isProcessing = true;

        try {
          const wavBuffer = pcmToWav(buffer, 48000, 2);
          const base64Audio = wavBuffer.toString("base64");

          const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              ...chatHistory.map(h => ({ role: h.role, parts: h.parts })),
              {
                role: "user",
                parts: [
                  {
                    inlineData: {
                      mimeType: "audio/wav",
                      data: base64Audio
                    }
                  },
                  { text: "Listen to my speech and respond naturally as Starry in 1-2 spoken sentences." }
                ]
              }
            ]
          });

          let aiReply = response.text?.trim();
          if (!aiReply) {
            isProcessing = false;
            return;
          }

          aiReply = aiReply.replace(/[*_~#`]/g, '').trim();

          chatHistory.push({ role: "user", parts: [{ text: "[Voice Audio Message]" }] });
          chatHistory.push({ role: "model", parts: [{ text: aiReply }] });

          if (chatHistory.length > 10) chatHistory.splice(1, 2);

          const ttsUrls = googleTTS.getAllAudioUrls(aiReply, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
          });

          audioQueue = ttsUrls.map(item => item.url);
          playNextInQueue();

        } catch (error) {
          console.error("❌ Supreme CallStarry Error:", error);
        } finally {
          isProcessing = false;
        }
      });
    });

    const channelListener = (oldState, newState) => {
      if (oldState.channelId === voiceChannel.id || newState.channelId === voiceChannel.id) {
        const currentHumans = voiceChannel.members.filter(m => !m.user.bot);
        if (currentHumans.size !== 1) {
          cleanupAndDisconnect();
        }
      }
    };

    interaction.client.on('voiceStateUpdate', channelListener);
  }
};

function pcmToWav(pcmBuffer, sampleRate = 48000, channels = 2) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}
