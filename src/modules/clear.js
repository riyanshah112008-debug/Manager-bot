const Transcript = require('../models/Transcript'); // Adjust path to your model if needed

module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'clear') return;

        let amount = interaction.options.getInteger('amount');

        if (amount > 2000) amount = 2000;
        if (amount < 1) return interaction.reply({ content: '❌ Please specify an amount greater than 0.', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        try {
            let totalDeleted = 0;
            let collectedMessages = [];

            while (amount > 0) {
                const fetchSize = amount > 100 ? 100 : amount;
                const messages = await interaction.channel.messages.fetch({ limit: fetchSize });

                if (messages.size === 0) break;

                // Save message details for the transcript before deleting
                messages.forEach(m => {
                    collectedMessages.push({
                        authorId: m.author.id,
                        authorTag: m.author.tag,
                        content: m.content || '[Embed / Attachment]',
                        timestamp: m.createdAt
                    });
                });

                const deleted = await interaction.channel.bulkDelete(messages, true);
                totalDeleted += deleted.size;
                amount -= fetchSize;

                if (deleted.size < fetchSize) break;
            }

            // Save Transcript to MongoDB
            if (collectedMessages.length > 0) {
                await Transcript.create({
                    guildId: interaction.guild.id,
                    channelId: interaction.channel.id,
                    moderatorId: interaction.user.id,
                    deletedCount: totalDeleted,
                    messages: collectedMessages
                });
            }

            await interaction.editReply({ content: `✅ Successfully deleted and archived **${totalDeleted}** messages to the database transcript log!` });
        } catch (error) {
            console.error('[Clear & Transcript Error]:', error);
            await interaction.editReply({ content: '❌ Could not delete messages or save transcript. Ensure messages are under 14 days old and bot permissions are correct.' });
        }
    });
};
