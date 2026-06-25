require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent 
    ]
});

const player = new Player(client);

client.on('ready', async () => {
    // ❗ FIXED: This is the new, correct way to load extractors in v6+
    await player.extractors.loadDefault();
    console.log(`🎶 Music Bot fully online as ${client.user.tag}`);
});

// ==========================================
// 1. PREFIX COMMAND (.play)
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content.toLowerCase().startsWith('.play')) {
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
            return waitMessage.edit('❌ Failed to play song. Make sure I have permissions to join!');
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

// ==========================================
// 3. ANTI-CRASH SYSTEM
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

client.login(process.env.DISCORD_TOKEN);
                          
