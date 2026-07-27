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
const googleTTS = require('google-tts-api');
const { Readable } = require('stream');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('callstarry')
    .setDescription('📞 Call Starry for a private 1-on-1 human-like AI voice call! (Premium Only)'),

  async execute(interaction, client) {
    // ⏱️ 1. DEFER IMMEDIATELY
    await interaction.deferReply({ ephemeral: false }).catch(() => {});

    try {
      // 👑 2. PREMIUM CHECK
      const isPremium = interaction.client.isPremium 
        ? interaction.client.isPremium(interaction.guild?.id, interaction.user.id)
        : false;

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
          .setFooter({ text: 'Starry Voice AI • Powered by Gemini', iconURL: interaction.client.user.displayAvatarURL() })
          .setTimestamp();

        return interaction.editReply({ embeds: [premiumEmbed] });
      }

      // 🎙️ 3. VOICE CHANNEL VALIDATION
      const member = interaction.member;
      const voiceChannel = member?.voice?.channel;

      if (!voiceChannel) {
        return interaction.editReply({ 
          content: "❌ You need to be in a voice channel first to call me!" 
        });
      }

      const permissions = voiceChannel.permissionsFor(interaction.client.user);
      if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
        return interaction.editReply({ 
          content: "❌ I don't have permissions to connect and speak in your voice channel!" 
        });
      }

      const humanMembers = voiceChannel.members.filter(m => !m.user.bot);
      if (humanMembers.size > 1) {
        return interaction.editReply({ 
          content: "🔒 `/callstarry` is for private 1-on-1 calls. Please call me when you are alone in VC!" 
        });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return interaction.editReply({
          content: "❌ `GEMINI_API_KEY` is missing in Environment Variables on Render!"
        });
      }

      await interaction.editReply({ 
        content: `📞 **Connecting to ${voiceChannel.name}...** Hey ${member.displayName}, Starry is on the line!` 
      });

      // 4. JOIN VOICE CHANNEL
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false
      });

      const player = createAudioPlayer();
      connection.subscribe(player);

      player.on('error', error => {
        console.error('❌ [CallStarry Audio Player Error]:', error.message);
      });

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

      // Download audio buffer safely with browser headers to avoid 403 blocks
      const fetchTTSBuffer = async (url) => {
        const res = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        if (!res.ok) throw new Error(`TTS HTTP error: ${res.status}`);
        const arrayBuf = await res.arrayBuffer();
        return Buffer.from(arrayBuf);
      };

      const playNextInQueue = async () => {
        if (audioQueue.length > 0) {
          const nextUrl = audioQueue.shift();
          try {
            const mp3Buffer = await fetchTTSBuffer(nextUrl);
            const resource = createAudioResource(Readable.from(mp3Buffer));
            player.play(resource);
          } catch (err) {
            console.error('❌ [CallStarry TTS Fetch Error]:', err);
            playNextInQueue();
          }
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

      // 5. OPUS -> PCM DECODING VOICE ENGINE
      const receiver = connection.receiver;

      receiver.speaking.on('start', (speakingUserId) => {
        if (speakingUserId !== member.id) return;

        console.log(`🎙️ [CallStarry] User ${speakingUserId} started speaking...`);

        if (player.state.status === AudioPlayerStatus.Playing) {
          audioQueue = [];
          player.stop();
        }

        if (isProcessing) return;
        resetInactivityTimer();

        const audioStream = receiver.subscribe(member.id, {
          end: {
            behavior: EndBehaviorType.AfterSilence,
            duration: 1000,
          },
        });

        const opusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
        const pcmChunks = [];

        audioStream.pipe(opusDecoder);
        opusDecoder.on('data', (chunk) => pcmChunks.push(chunk));

        opusDecoder.on('end', async () => {
          const buffer = Buffer.concat(pcmChunks);
          console.log(`🎙️ [CallStarry] Captured PCM Audio: ${buffer.length} bytes`);
          
          if (buffer.length < 4000) {
            console.log(`⚠️ [CallStarry] Audio too short/quiet (${buffer.length} bytes), skipping.`);
            return;
          }

          isProcessing = true;

          try {
            const wavBuffer = pcmToWav(buffer, 48000, 2);
            const base64Audio = wavBuffer.toString("base64");

            const callGemini = async (modelName) => {
              const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
              const payload = {
                contents: [
                  ...chatHistory,
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
              };

              const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
              });

              return await res.json();
            };

            let data = await callGemini("gemini-2.5-flash");

            if (data.error) {
              console.warn("⚠️ [CallStarry] gemini-2.5-flash failed, trying gemini-1.5-flash:", data.error.message);
              data = await callGemini("gemini-1.5-flash");
            }

            let aiReply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (!aiReply) {
              console.error("❌ [CallStarry] Gemini returned empty response:", JSON.stringify(data));
              isProcessing = false;
              return;
            }

            console.log(`🗣️ [Starry Reply]: "${aiReply}"`);

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
            console.error("❌ [CallStarry Engine Error]:", error);
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

    } catch (err) {
      console.error("❌ Error executing /callstarry:", err);
      await interaction.editReply({ 
        content: "❌ An error occurred while trying to start the voice call!" 
      }).catch(() => {});
    }
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
