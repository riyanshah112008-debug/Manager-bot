module.exports = (client) => {
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'clear') return;

        const amount = interaction.options.getInteger('amount');

        try {
            // Bulk delete ignores messages older than 14 days due to Discord API limits
            const deleted = await interaction.channel.bulkDelete(amount, true);
            await interaction.reply({ content: `✅ Successfully deleted **${deleted.size}** messages!`, ephemeral: true }).catch(() => {});
        } catch (error) {
            await interaction.reply({ content: '❌ Could not delete messages. Ensure Starry has permission!', ephemeral: true }).catch(() => {});
        }
    });
};
    
