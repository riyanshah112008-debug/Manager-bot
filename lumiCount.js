const fs = require('fs');
const path = require('path');
const dataPath = path.join(__dirname, 'countData.json');

module.exports = (client) => {
    client.on('clientReady', async () => {
        try {
            await client.application.commands.create({
                name: 'setupcount',
                description: 'Set the current channel as the Counting Game channel (Admin Only)',
                default_member_permissions: '8'
            });
            console.log('✅ Counting Game Module Loaded');
        } catch (err) {}
    });

    function getCountData() {
        if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, JSON.stringify({}));
        return JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }

    function saveCountData(data) {
        fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
    }

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setupcount') return;
        
        let data = getCountData();
        data[interaction.guild.id] = { channelId: interaction.channel.id, currentNumber: 1, lastUser: null };
        saveCountData(data);

        await interaction.reply({ content: '✅ This channel is now the official Counting Game channel! Start by typing `1`.' }).catch(() => {});
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        let data = getCountData();
        const guildData = data[message.guild.id];

        if (!guildData || message.channel.id !== guildData.channelId) return;

        // Ensure the message starts with the exact number and no leading spaces
        const expectedNumber = guildData.currentNumber;
        const msgText = message.content.trim();
        const numberMatch = msgText.match(/^\d+/);

        if (!numberMatch) {
            // Not a number, delete it to keep chat clean
            return message.delete().catch(() => {});
        }

        const typedNumber = parseInt(numberMatch[0], 10);

        if (typedNumber === expectedNumber && message.author.id !== guildData.lastUser) {
            // Valid count!
            message.react('✅').catch(() => {});
            guildData.currentNumber++;
            guildData.lastUser = message.author.id;
            saveCountData(data);
        } else {
            // Wrong count OR same user twice!
            message.react('❌').catch(() => {});
            
            const reason = message.author.id === guildData.lastUser 
                ? "You can't count two numbers in a row!" 
                : `You ruined the streak! The next number was supposed to be **${expectedNumber}**!`;

            await message.channel.send(`🚨 **STREAK RUINED BY <@${message.author.id}>!** 🚨\n${reason}\n\nThe count has been reset. Start again at **1**.`);
            
            // Delete the incorrect message and reset
            setTimeout(() => message.delete().catch(() => {}), 2000);
            
            guildData.currentNumber = 1;
            guildData.lastUser = null;
            saveCountData(data);
        }
    });
};
