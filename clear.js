module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'clear',
                description: 'Bulk delete messages (Admin Only)',
                default_member_permissions: '8', 
                options: [
                    {
                        name: 'amount',
                        description: 'Number of messages to delete (1-100)',
                        type: 4, 
                        required: true,
                        min_value: 1,
                        max_value: 100
                    }
                ]
            });
            console.log('✅ Clear Slash Command Added');
        } catch (err) {}
    });

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
