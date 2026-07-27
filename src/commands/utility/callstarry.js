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
const { OpenAI } = require('openai');
const { Readable } = require('stream');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = {
  data: new SlashCommandBuilder()
    .setName('callstarry')
    .setDescription('Call Starry for a private 1-on-1 voice conversation!'),

  async execute(interaction) {
    const member = interaction.member;
    const voiceChannel = member.voice.channel;

    // 1. Check if user is in a Voice Channel
    if (!voiceChannel) {
      return interaction.reply({ 
        content: "❌ You need to be in a voice channel first to call me!", 
        ephemeral: true 
      });
    }

    // 2. Check bot permissions
    const permissions = voiceChannel.permissionsFor(interaction.client.user);
    if (!permissions.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
      return interaction.reply({
        content: "❌ I don't have permissions to connect and speak in your voice channel!",
        ephemeral: true
      });
    }

    // 3. Verify user is ALONE in VC (excluding bots)
    const humanMembers = voiceChannel.members.filter(m => !m.user.bot);
    if (humanMembers.size > 1) {
      return interaction.reply({ 
        content: "🔒 `/callstarry` is for 1-on-1 private calls. Please call me when you're alone in VC, or join an empty voice channel!", 
        ephemeral: true 
      });
    }

    await interaction.reply({ 
      content: `📞 **Connecting to ${voiceChannel.name}...** Hey ${member.displayName}, Starry is on the line!` 
    });

    // 4. Connect to VC with undeafened audio receiver
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guild.id,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false, // Critical: must be false to listen to user speech
      selfMute: false
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    // Initial conversation context giving Starry human-like behavior and emotions
    const conversationHistory = [
      { 
        role: "system", 
        content: `You are Starry, a warm, energetic, and deeply empathetic AI friend chatting on a Discord voice call.
Personality traits:
- Speak casually like a real friend on a phone call.
- Keep responses short and conversational (1 to 3 short sentences max) so the dialogue feels natural.
- Express human emotions: use gentle laughter, enthusiasm, sympathy, and conversational starters ("Oh wow", "Yeah totally", "Hmm, let me think").
- Do NOT sound like an AI assistant or give long bulleted lists.` 
      }
    ];

    let isProcessing = false;
    let inactivityTimeout = null;

    // Reset inactivity timer (disconnects after 3 mins of silence)
    const resetInactivityTimer = () => {
      if (inactivityTimeout) clearTimeout(inactivityTimeout);
      inactivityTimeout = setTimeout(() => {
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
          connection.destroy();
        }
      }, 3 * 60 * 1000);
    };

    resetInactivityTimer();

    // 5. Setup Audio Listener
    const receiver = connection.receiver;

    receiver.speaking.on('start', (speakingUserId) => {
      if (speakingUserId !== member.id || isProcessing) return;

      resetInactivityTimer();

      // Subscribe to user audio stream; stops 1 second after user stops talking
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
        if (buffer.length < 12000) return; // Skip minor background noise / mic clicks

        isProcessing = true;

        try {
          // A. Convert PCM to WAV and Transcribe (Whisper)
          const wavBuffer = pcmToWav(buffer, 48000, 2);
          const audioFile = new File([wavBuffer], "speech.wav", { type: "audio/wav" });

          const transcription = await openai.audio.transcriptions.create({
            file: audioFile,
            model: "whisper-1",
            language: "en"
          });

          const userText = transcription.text?.trim();
          if (!userText || userText.length < 2) {
            isProcessing = false;
            return;
          }

          // B. Get Human-like Response from LLM
          conversationHistory.push({ role: "user", content: userText });

          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: conversationHistory,
            max_tokens: 100,
            temperature: 0.8
          });

          const aiReply = completion.choices[0].message.content;
          conversationHistory.push({ role: "assistant", content: aiReply });

          // Keep history compact (last 10 turns max)
          if (conversationHistory.length > 12) {
            conversationHistory.splice(1, 2);
          }

          // C. Generate Human-like Audio via Text-To-Speech
          const ttsResponse = await openai.audio.speech.create({
            model: "tts-1",
            voice: "nova", // Emotional & warm voice (Options: nova, shimmer, alloy, echo)
            input: aiReply,
            speed: 1.05
          });

          const arrayBuffer = await ttsResponse.arrayBuffer();
          const audioBuffer = Buffer.from(arrayBuffer);

          // D. Play Audio back in VC
          const resource = createAudioResource(Readable.from(audioBuffer));
          player.play(resource);

        } catch (error) {
          console.error("CallStarry voice error:", error);
        } finally {
          isProcessing = false;
        }
      });
    });

    // 6. Leave automatically if user leaves or someone else joins
    const channelListener = (oldState, newState) => {
      if (oldState.channelId === voiceChannel.id || newState.channelId === voiceChannel.id) {
        const currentHumans = voiceChannel.members.filter(m => !m.user.bot);
        if (currentHumans.size !== 1) {
          interaction.client.removeListener('voiceStateUpdate', channelListener);
          if (inactivityTimeout) clearTimeout(inactivityTimeout);
          const activeConn = getVoiceConnection(interaction.guild.id);
          if (activeConn) activeConn.destroy();
        }
      }
    };

    interaction.client.on('voiceStateUpdate', channelListener);
  }
};

/**
 * Helper: Converts raw 16-bit PCM buffer into valid WAV format for OpenAI Whisper API
 */
function pcmToWav(pcmBuffer, sampleRate = 48000, channels = 2) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}
