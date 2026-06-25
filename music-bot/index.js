require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Player } = require('discord-player');
const { DefaultExtractors } = require('@discord-player/extractor');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const player = new Player(client);
player.extractors.loadMulti(DefaultExtractors);

client.on('ready', () => {
    console.log(`🎶 Music Bot fully online as ${client.user.tag}`);
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== 'play') return;

    const query = interaction.options.getString('song');
    const channel = interaction.member.voice.channel;

    if (!channel) {
        return interaction.reply({ 
            content: '❌ Join a voice channel first!', 
            ephemeral: true 
        });
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

// Logs in using the MUSIC_TOKEN you will set in Render
client.login(process.env.MUSIC_TOKEN);
