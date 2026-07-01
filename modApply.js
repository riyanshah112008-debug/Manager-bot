const { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'apply',
                description: 'Apply for a moderator position in the server!'
            });
            console.log('✅ Mod Apply Slash Command Added');
        } catch (err) {}
    });

    client.on('interactionCreate', async (interaction) => {
        // 1. Show the Application Form
        if (interaction.isChatInputCommand() && interaction.commandName === 'apply') {
            const modal = new ModalBuilder()
                .setCustomId('mod_application')
                .setTitle('Moderator Application');

            const ageInput = new TextInputBuilder()
                .setCustomId('age')
                .setLabel('How old are you?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const experienceInput = new TextInputBuilder()
                .setCustomId('experience')
                .setLabel('Do you have previous experience?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            const reasonInput = new TextInputBuilder()
                .setCustomId('reason')
                .setLabel('Why should we choose you?')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(ageInput),
                new ActionRowBuilder().addComponents(experienceInput),
                new ActionRowBuilder().addComponents(reasonInput)
            );

            await interaction.showModal(modal).catch(() => {});
        }

        // 2. Process the Submitted Form
        if (interaction.isModalSubmit() && interaction.customId === 'mod_application') {
            const age = interaction.fields.getTextInputValue('age');
            const experience = interaction.fields.getTextInputValue('experience');
            const reason = interaction.fields.getTextInputValue('reason');

            const embed = new EmbedBuilder()
                .setColor('Gold')
                .setTitle('📝 New Moderator Application')
                .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
                .addFields(
                    { name: 'Age', value: age },
                    { name: 'Experience', value: experience },
                    { name: 'Reason', value: reason }
                )
                .setFooter({ text: `User ID: ${interaction.user.id}` })
                .setTimestamp();

            await interaction.reply({ content: '✅ Your application has been submitted successfully!', ephemeral: true }).catch(() => {});
            await interaction.channel.send({ embeds: [embed] }).catch(() => {});
        }
    });
};
