const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'tod',
                description: 'Play a game of Truth or Dare!',
                options: [
                    {
                        name: 'choice',
                        description: 'Choose Truth or Dare',
                        type: 3, 
                        required: true,
                        choices: [
                            { name: 'Truth', value: 'truth' },
                            { name: 'Dare', value: 'dare' }
                        ]
                    }
                ]
            });
            console.log('✅ Truth or Dare Slash Command Added');
        } catch (err) {
            console.log('❌ Failed to add Truth or Dare command');
        }
    });

    const truths = [
        "What is your biggest fear?",
        "What is the most embarrassing thing you've ever done?",
        "Who is your secret crush?",
        "What is a lie you've told that no one knows about?",
        "What is the weirdest habit you have?"
    ];

    const dares = [
        "Send a voice message of you barking like a dog.",
        "Type your next 5 messages with your eyes closed.",
        "Ping a random person in the server and say 'I know what you did'.",
        "Change your Discord status to 'I love eating bugs' for 10 minutes.",
        "Confess something embarrassing in the general chat."
    ];

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'tod') return;

        const choice = interaction.options.getString('choice');
        const isTruth = choice === 'truth';
        const randomItem = isTruth
            ? truths[Math.floor(Math.random() * truths.length)]
            : dares[Math.floor(Math.random() * dares.length)];

        const embed = new EmbedBuilder()
            .setColor(isTruth ? 'Blue' : 'Red')
            .setTitle(isTruth ? '🔵 Truth Selected!' : '🔴 Dare Selected!')
            .setDescription(`**${interaction.user.username}**, here is your ${choice}:\n\n> **${randomItem}**`)
            .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
            .setFooter({ text: 'You must complete it!' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] }).catch(() => {});
    });
};
