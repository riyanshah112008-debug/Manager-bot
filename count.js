const { PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'countData.json');

module.exports = (client) => {
    const PREFIX = '.';

    // Helper Functions for Database
    function getCountData() {
        if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
        return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    }

    function saveCountData(data) {
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    }

    // ==========================================
    // 1. REGISTER SLASH COMMAND
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'setupcount',
                description: 'Set the channel for the Counting Game (Admin Only)',
                default_member_permissions: '8',
                options: [
                    { name: 'channel', description: 'The counting channel', type: 7, required: true }
                ]
            });
            console.log('✅ Counting Game Module Loaded');
        } catch (err) {}
    });

    // ==========================================
    // 2. SETUP COMMAND LOGIC
    // ==========================================
    
    // Slash Command
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setupcount') return;

        const channel = interaction.options.getChannel('channel');
        let data = getCountData();
        data[interaction.guild.id] = { channelId: channel.id, currentNumber: 1, lastUser: null };
        saveCountData(data);

        await interaction.reply({ content: `✅ <#${channel.id}> is now the Counting Game channel! Start by typing \`1\`.`, ephemeral: true }).catch(() => {});
        await channel.send('🔢 **Counting Game Started!** The next number is **1**.');
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Prefix Command (.setupcount #channel)
        if (message.content.toLowerCase().startsWith(PREFIX + 'setupcount')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
            
            const channel = message.mentions.channels.first() || message.channel;
            let data = getCountData();
            data[message.guild.id] = { channelId: channel.id, currentNumber: 1, lastUser: null };
            saveCountData(data);

            await message.reply(`✅ <#${channel.id}> is now the Counting Game channel! Start by typing \`1\`.`).catch(() => {});
            
            // Announce it in the target channel if they set it up from a different channel
            if (channel.id !== message.channel.id) {
                await channel.send('🔢 **Counting Game Started!** The next number is **1**.');
            }
            return;
        }

        // ==========================================
        // 3. THE COUNTING GAME RULES
        // ==========================================
        let data = getCountData();
        const guildData = data[message.guild.id];

        // If this isn't the counting channel, ignore the message
        if (!guildData || message.channel.id !== guildData.channelId) return;
        
        // Ignore commands in the counting channel
        if (message.content.startsWith(PREFIX) || message.content.startsWith('/')) return;

        const expectedNumber = guildData.currentNumber;
        const msgText = message.content.trim();
        
        // Check if the message starts with a number
        const numberMatch = msgText.match(/^\d+/);

        if (!numberMatch) {
            // They typed normal text, delete it to keep the counting channel perfectly clean
            return message.delete().catch(() => {});
        }

        const typedNumber = parseInt(numberMatch[0], 10);

        if (typedNumber === expectedNumber && message.author.id !== guildData.lastUser) {
            // ✅ CORRECT NUMBER
            message.react('✅').catch(() => {});
            guildData.currentNumber++;
            guildData.lastUser = message.author.id;
            saveCountData(data);
        } else {
            // ❌ WRONG NUMBER OR SAME PERSON TWICE
            message.react('❌').catch(() => {});
            
            const reason = message.author.id === guildData.lastUser 
                ? "You can't count two numbers in a row!" 
                : `You ruined the streak! The next number was supposed to be **${expectedNumber}**!`;

            await message.channel.send(`🚨 **STREAK RUINED BY <@${message.author.id}>!** 🚨\n${reason}\n\nThe count has been reset. Start again at **1**.`);
            
            // Delete the incorrect message after 2 seconds
            setTimeout(() => message.delete().catch(() => {}), 2000);
            
            // Reset the streak
            guildData.currentNumber = 1;
            guildData.lastUser = null;
            saveCountData(data);
        }
    });
};
