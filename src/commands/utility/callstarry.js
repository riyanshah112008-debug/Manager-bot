const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
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

// Initialize Gemini SDK with your existing GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('callstarry')
    .setDescription('Call Starry for a private 1-on-1 human-like voice call!'),

  async execute(interaction) {
    const member = interaction.member;
    const voiceChannel = member.voice?.channel;

    // 1. Validation Checks
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

    // 2. Join Voice Channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false, // Critical: must be false to listen to user voice
      selfMute: false
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    // Audio Playback Queue for smooth multi-sentence TTS playback
    let audioQueue = [];
    let isProcessing = false;
    let inactivityTimeout = null;

    // Chat context for realistic voice conversation
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

    // Play next audio chunk in queue
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

    // Reset inactivity timer (Disconnects after 3 minutes of silence)
    const resetInactivityTimer = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        cleanupAndDisconnect();
      }, 3 * 60 * 1000);
    };

    // Full cleanup function to prevent memory leaks
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

    // 3. Audio Receiver Engine
    const receiver = connection.receiver;

    receiver.speaking.on('start', (speakingUserId) => {
      if (speakingUserId !== member.id) return;

      // Barge-in capability: Stop current speech if user starts talking
      if (player.state.status === AudioPlayerStatus.Playing) {
        audioQueue = [];
        player.stop();
      }

      if (isProcessing) return;
      resetInactivityTimer();

      const audioStream = receiver.subscribe(member.id, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 1200, // Detects 1.2s of silence as end of user speech
        },
      });

      const opusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
      const pcmChunks = [];

      audioStream.pipe(opusDecoder);
      opusDecoder.on('data', (chunk) => pcmChunks.push(chunk));

      opusDecoder.on('end', async () => {
        const buffer = Buffer.concat(pcmChunks);
        if (buffer.length < 12000) return; // Skip minor background noise or mic pops

        isProcessing = true;

        try {
          const wavBuffer = pcmToWav(buffer, 48000, 2);
          const base64Audio = wavBuffer.toString("base64");

          // Step A: Pass voice audio directly to Gemini 2.5 Flash
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

          // Clean markdown tokens (*, _, ~, #) from Gemini response
          aiReply = aiReply.replace(/[*_~#`]/g, '').trim();

          // Store in conversation history
          chatHistory.push({ role: "user", parts: [{ text: "[Voice Audio Message]" }] });
          chatHistory.push({ role: "model", parts: [{ text: aiReply }] });

          // Trim history to avoid context buffer bloating
          if (chatHistory.length > 10) chatHistory.splice(1, 2);

          // Step B: Split text into safe TTS chunks
          const ttsUrls = googleTTS.getAllAudioUrls(aiReply, {
            lang: 'en',
            slow: false,
            host: 'https://translate.google.com',
            timeout: 10000,
          });

          // Step C: Load audio queue & trigger playback
          audioQueue = ttsUrls.map(item => item.url);
          playNextInQueue();

        } catch (error) {
          console.error("❌ Supreme CallStarry Error:", error);
        } finally {
          isProcessing = false;
        }
      });
    });

    // 4. Auto-Leave Listener (if user leaves or someone else joins)
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

/**
 * Converts raw 16-bit PCM buffer into valid WAV header format for Gemini API
 */
function pcmToWav(pcmBuffer, sampleRate = 48000, channels = 2) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM format
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34); // 16-bit
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}
