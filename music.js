const { Player } = require('discord-player');
const { YoutubeiExtractor } = require('discord-player-youtubei'); // Import the stable extractor

module.exports = (client) => {
    const player = new Player(client);
    
    // Register the stable plugin and filter out the old YouTubeExtractor
    player.extractors.register(YoutubeiExtractor, {})
        .then(() => player.extractors.loadDefault((ext) => ext !== 'YouTubeExtractor'))
        .then(() => {
            console.log('🎶 Audio extractors loaded for Starry!');
        })
        .catch(err => console.error('Failed to load extractors:', err));

    // PREFIX COMMAND (.play)
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        if (message.content.toLowerCase().startsWith('.play')) {
            const query = message.content.slice(5).trim();
            const channel = message.member.voice.channel;

            if (!channel) return message.reply('❌ Join a voice channel first!');
            if (!query) return message.reply('❌ Please provide a song! Example: `.play blinding lights`');

            const waitMessage = await message.reply('🔍 Searching...');

            try {
                const { track } = await player.play(channel, query, {
                    nodeOptions: { metadata: message }
                });
                return waitMessage.edit(`✅ Playing: **${track.title}**`);
            } catch (error) {
                console.error(error);
                return waitMessage.edit('❌ Failed to play song. Make sure I have permissions!');
            }
        }
    });

    // SLASH COMMAND (/play)
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'play') return;

        const query = interaction.options.getString('song');
        const channel = interaction.member.voice.channel;

        if (!channel) return interaction.reply({ content: '❌ Join a voice channel first!', ephemeral: true });

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
};
            
