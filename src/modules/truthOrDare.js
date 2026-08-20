const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client) => {
    // Fallback pool in case the external API is unreachable
    const fallbacks = {
        truth: [
            "What is something you have never told anyone?",
            "What is your biggest regret from the past year?",
            "Who in this server would you trust with your life?"
        ],
        dare: [
            "Send the last photo in your camera roll to this chat.",
            "Speak in an accent of the chat's choice in VC for 5 minutes.",
            "Send a message to your 3rd recent DM saying only 'I know what you did'."
        ]
    };

    // Helper: Create the 3-button control row
    function createTodRow() {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('tod_truth')
                .setLabel('Truth')
                .setEmoji('🔵')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('tod_dare')
                .setLabel('Dare')
                .setEmoji('🔴')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('tod_random')
                .setLabel('Random')
                .setEmoji('🎲')
                .setStyle(ButtonStyle.Success)
        );
    }

    // Helper: Fetch random question from external Truth or Dare API
    async function fetchPromptFromWeb(type, rating = 'pg13') {
        try {
            const res = await fetch(`https://api.truthordarebot.xyz/v1/${type}?rating=${rating}`);
            if (!res.ok) throw new Error(`API response status: ${res.status}`);
            const data = await res.json();
            return data.question;
        } catch (error) {
            console.error(`[ToD] Failed to fetch ${type} from API, using fallback:`, error.message);
            const pool = fallbacks[type];
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }

    client.on('interactionCreate', async (interaction) => {
        // Setup Command
        if (interaction.isChatInputCommand() && interaction.commandName === 'tod') {
            const setupEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🎭 Truth or Dare')
                .setDescription('Click a button below to generate a live prompt from the web!')
                .addFields(
                    { name: '🔵 Truth', value: 'Answer an honest question.', inline: true },
                    { name: '🔴 Dare', value: 'Complete a challenge.', inline: true },
                    { name: '🎲 Random', value: 'Let fate decide.', inline: true }
                )
                .setFooter({ text: 'Click any button to take a turn.' });

            return interaction.reply({ embeds: [setupEmbed], components: [createTodRow()] });
        }

        // Button Clicks
        if (interaction.isButton() && interaction.customId.startsWith('tod_')) {
            // Defer reply to prevent 3-second Discord timeouts while fetching from the web
            await interaction.deferReply();

            const rawChoice = interaction.customId.split('_')[1]; // truth, dare, or random
            const isTruth = rawChoice === 'random' ? Math.random() < 0.5 : rawChoice === 'truth';
            const promptType = isTruth ? 'truth' : 'dare';
            const resolvedLabel = isTruth ? 'Truth' : 'Dare';

            // Check if server/channel allows NSFW or has premium enabled
            const isNsfw = interaction.channel?.nsfw;
            const rating = isNsfw ? 'r' : 'pg13';

            // Fetch dynamic prompt from the web API
            const question = await fetchPromptFromWeb(promptType, rating);

            const responseEmbed = new EmbedBuilder()
                .setColor(isTruth ? '#3498DB' : '#E74C3C')
                .setAuthor({
                    name: `${interaction.user.displayName}'s Turn`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTitle(`${isTruth ? '🔵' : '🔴'} ${resolvedLabel}`)
                .setDescription(
                    `**Player:** ${interaction.user}\n` +
                    `**Mode:** ${rawChoice === 'random' ? `🎲 Random (${resolvedLabel})` : resolvedLabel}\n\n` +
                    `> **${question}**`
                )
                .setFooter({
                    text: `Rating: ${rating.toUpperCase()} • Click a button below for the next turn`,
                    iconURL: interaction.guild.iconURL({ dynamic: true })
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [responseEmbed],
                components: [createTodRow()]
            });
        }
    });
};
