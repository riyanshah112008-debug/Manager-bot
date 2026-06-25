require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages, // ❗ Required to see messages in channels
        GatewayIntentBits.MessageContent // ❗ Required to read what the message says
    ]
});

const player = new Player(client);
player.extractors.loadMulti(DefaultExtractors);

client.on('ready', () => {
    console.log(`🎶 Music Bot fully online as ${client.user.tag}`);
});

// ==========================================
// 1. PREFIX COMMAND (.play)
// ==========================================
client.on('messageCreate', async (message) => {
    // Ignore other bots and DMs
    if (message.author.bot || !message.guild) return;

    if (message.content.toLowerCase().startsWith('.play')) {
        // Extract the song name after ".play "
        const query = message.content.slice(5).trim();
        const channel = message.member.voice.channel;

        if (!channel) {
            return message.reply('❌ Join a voice channel first!');
        }
        if (!query) {
            return message.reply('❌ Please provide a song! Example: `.play blinding lights`');
        }

        const waitMessage = await message.reply('🔍 Searching...');

        try {
            const { track } = await player.play(channel, query, {
                nodeOptions: { metadata: message }
            });
            return waitMessage.edit(`✅ Playing: **${track.title}**`);
        } catch (error) {
            console.error(error);
            return waitMessage.edit('❌ Failed to play song.');
        }
    }
});

// ==========================================
// 2. SLASH COMMAND (/play)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'play') return;

    const query = interaction.options.getString('song');
    const channel = interaction.member.voice.channel;

    if (!channel) {
        return interaction.reply({ content: '❌ Join a voice channel first!', ephemeral: true });
    }

    await interaction.deferReply();

    try {
        const { track } = await player.play(channel, query, {
            nodeOptions: { metadata: interaction }
        });
        return interaction.followUp(`✅ Playing: **${track.title}**`);
    } catch (error) {
        console.error(error);
        return interaction.followUp('❌ Failed to play song.');
    }
});

client.login(process.env.MUSIC_TOKEN);
    
