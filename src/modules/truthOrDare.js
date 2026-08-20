// ==========================================
// 🎭 TRUTH OR DARE ENGINE - modules/truthOrDare.js
// ==========================================
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = (client, app) => {
    // Local fallback database in case external web API is unreachable
    const fallbacks = {
        truth: [
            "What is your biggest irrational fear?",
            "What is a secret you have never told anyone in this server?",
            "What is the most embarrassing thing in your search history?",
            "If you had to delete one person from your friend list, who would it be?",
            "What is the biggest lie you ever told your parents without getting caught?"
        ],
        dare: [
            "Send the 4th photo in your camera roll to this chat.",
            "Speak with an accent chosen by the server in VC for 5 minutes.",
            "Change your nickname in this server to whatever the next person says for 2 hours.",
            "Send a message to your 3rd most recent DM saying only 'We need to talk.'",
            "Type your next 5 messages in chat using only emojis."
        ]
    };

    // Builds the 3 interactive game buttons
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

    // Dynamic fetch from external API with PG-13 vs R rating detection
    async function fetchPromptFromWeb(type, rating = 'pg13') {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch(`https://api.truthordarebot.xyz/v1/${type}?rating=${rating}`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`API responded with status: ${res.status}`);
            const data = await res.json();
            return data.question;
        } catch (error) {
            console.warn(`[TruthOrDare] Web fetch fallback invoked (${error.message})`);
            const pool = fallbacks[type] || fallbacks.truth;
            return pool[Math.floor(Math.random() * pool.length)];
        }
    }

    client.on('interactionCreate', async (interaction) => {
        // 1. Slash Command Initializer (/tod)
        if (interaction.isChatInputCommand() && interaction.commandName === 'tod') {
            const setupEmbed = new EmbedBuilder()
                .setColor('#5865F2')
                .setAuthor({ 
                    name: 'Truth or Dare • Interactive Hub', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTitle('🎭 Pick Your Poison!')
                .setDescription(
                    'Welcome to the live Truth or Dare engine. Click any button below to draw a prompt directly from the global web database!'
                )
                .addFields(
                    { name: '🔵 Truth', value: 'Answer an honest prompt', inline: true },
                    { name: '🔴 Dare', value: 'Face a challenge', inline: true },
                    { name: '🎲 Random', value: 'Let fate decide', inline: true }
                )
                .setFooter({ text: 'Anyone in this channel can click to take a turn.' });

            return interaction.reply({ embeds: [setupEmbed], components: [createTodRow()] });
        }

        // 2. Button Turn Handler
        if (interaction.isButton() && interaction.customId.startsWith('tod_')) {
            await interaction.deferReply();

            const rawChoice = interaction.customId.split('_')[1]; // truth, dare, or random
            const isTruth = rawChoice === 'random' ? Math.random() < 0.5 : rawChoice === 'truth';
            const promptType = isTruth ? 'truth' : 'dare';
            const resolvedLabel = isTruth ? 'Truth' : 'Dare';

            // Check channel content rating
            const isNsfw = interaction.channel?.nsfw ?? false;
            const rating = isNsfw ? 'r' : 'pg13';

            const question = await fetchPromptFromWeb(promptType, rating);

            const promptEmbed = new EmbedBuilder()
                .setColor(isTruth ? '#3498DB' : '#E74C3C')
                .setAuthor({
                    name: `${interaction.user.displayName || interaction.user.username}'s Turn`,
                    iconURL: interaction.user.displayAvatarURL({ dynamic: true })
                })
                .setTitle(`${isTruth ? '🔵' : '🔴'} Selected: ${resolvedLabel}`)
                .setDescription(
                    `👤 **Player:** ${interaction.user} (\`${interaction.user.username}\`)\n` +
                    `🕹️ **Choice:** ${rawChoice === 'random' ? `🎲 Random (${resolvedLabel})` : resolvedLabel}\n\n` +
                    `> **${question}**`
                )
                .setFooter({
                    text: `Rating: ${rating.toUpperCase()} • Click a button below for the next turn`,
                    iconURL: interaction.guild?.iconURL({ dynamic: true }) || undefined
                })
                .setTimestamp();

            await interaction.editReply({
                embeds: [promptEmbed],
                components: [createTodRow()]
            });
        }
    });
};
