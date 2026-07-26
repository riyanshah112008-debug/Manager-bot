module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'clear') return;

        let amount = interaction.options.getInteger('amount');

        // Enforce the custom cap of up to 2000 messages
        if (amount > 2000) amount = 2000;
        if (amount < 1) return interaction.reply({ content: '❌ Please specify an amount greater than 0.', ephemeral: true });

        await interaction.deferReply({ ephemeral: true });

        try {
            let totalDeleted = 0;

            while (amount > 0) {
                // Discord allows a max of 100 per bulkDelete call
                const fetchSize = amount > 100 ? 100 : amount;
                const messages = await interaction.channel.messages.fetch({ limit: fetchSize });

                if (messages.size === 0) break;

                const deleted = await interaction.channel.bulkDelete(messages, true);
                totalDeleted += deleted.size;
                amount -= fetchSize;

                // If less than fetched were deleted, it means we hit older-than-14-days messages
                if (deleted.size < fetchSize) break;
            }

            await interaction.editReply({ content: `✅ Successfully deleted a total of **${totalDeleted}** messages!` });
        } catch (error) {
            console.error('[Clear Error]:', error);
            await interaction.editReply({ content: '❌ Could not delete messages. Ensure Starry has permission and messages are under 14 days old!' });
        }
    });
};
