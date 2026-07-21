const { PermissionsBitField } = require('discord.js');
const mongoose = require('mongoose');

// 🗄️ MONGODB SCHEMA (Replaces countData.json)
const CountSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    currentNumber: { type: Number, default: 1 },
    lastUser: { type: String, default: null }
});

const CountGuild = mongoose.models.CountGuild || mongoose.model('CountGuild', CountSchema);

module.exports = (client) => {
    const PREFIX = '.';

    // 🧠 FAST MEMORY CACHE (Prevents file locking and database spam)
    const countCache = new Map();

    // Fetch database into memory immediately when the module loads
    (async () => {
        try {
            const data = await CountGuild.find();
            data.forEach(g => countCache.set(g.guildId, {
                channelId: g.channelId,
                currentNumber: g.currentNumber,
                lastUser: g.lastUser
            }));
            console.log('✅ Counting Game Module Loaded (MongoDB Synced)');
        } catch (err) {
            console.error('❌ Failed to load counting data:', err);
        }
    })();

    // ==========================================
    // 1. SETUP COMMAND LOGIC
    // ==========================================
    
    // Slash Command
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setupcount') return;

        const channel = interaction.options.getChannel('channel');
        const newData = { channelId: channel.id, currentNumber: 1, lastUser: null };
        
        // Update Cache & Database
        countCache.set(interaction.guild.id, newData);
        await CountGuild.findOneAndUpdate({ guildId: interaction.guild.id }, newData, { upsert: true });

        await interaction.reply({ content: `✅ <#${channel.id}> is now the Counting Game channel! Start by typing \`1\`.`, ephemeral: true }).catch(() => {});
        await channel.send('🔢 **Counting Game Started!** The next number is **1**.');
    });

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Prefix Command (.setupcount #channel)
        if (message.content.toLowerCase().startsWith(PREFIX + 'setupcount')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;
            
            const channel = message.mentions.channels.first() || message.channel;
            const newData = { channelId: channel.id, currentNumber: 1, lastUser: null };
            
            // Update Cache & Database
            countCache.set(message.guild.id, newData);
            await CountGuild.findOneAndUpdate({ guildId: message.guild.id }, newData, { upsert: true });

            await message.reply(`✅ <#${channel.id}> is now the Counting Game channel! Start by typing \`1\`.`).catch(() => {});
            
            if (channel.id !== message.channel.id) {
                await channel.send('🔢 **Counting Game Started!** The next number is **1**.');
            }
            return;
        }

        // ==========================================
        // 2. THE COUNTING GAME RULES
        // ==========================================
        const guildData = countCache.get(message.guild.id);

        // If this isn't the counting channel, ignore the message
        if (!guildData || message.channel.id !== guildData.channelId) return;
        
        // Ignore commands in the counting channel
        if (message.content.startsWith(PREFIX) || message.content.startsWith('/')) return;

        const expectedNumber = guildData.currentNumber;
        const msgText = message.content.trim();
        
        // Check if the message starts with a number
        const numberMatch = msgText.match(/^\d+/);

        if (!numberMatch) {
            // Normal text — delete to keep the counting channel clean
            return message.delete().catch(() => {});
        }

        const typedNumber = parseInt(numberMatch[0], 10);

        if (typedNumber === expectedNumber && message.author.id !== guildData.lastUser) {
            // ✅ CORRECT NUMBER
            message.react('✅').catch(() => {});
            
            guildData.currentNumber++;
            guildData.lastUser = message.author.id;
            countCache.set(message.guild.id, guildData);
            
            // Save to DB in the background (does not block the bot)
            CountGuild.updateOne(
                { guildId: message.guild.id }, 
                { currentNumber: guildData.currentNumber, lastUser: guildData.lastUser }
            ).catch(() => {});

        } else {
            // ❌ WRONG NUMBER OR SAME PERSON TWICE
            message.react('❌').catch(() => {});
            
            const reason = message.author.id === guildData.lastUser 
                ? "You can't count two numbers in a row!" 
                : `You ruined the streak! The next number was supposed to be **${expectedNumber}**!`;

            await message.channel.send(`🚨 **STREAK RUINED BY <@${message.author.id}>!** 🚨\n${reason}\n\nThe count has been reset. Start again at **1**.`);
            
            setTimeout(() => message.delete().catch(() => {}), 2000);
            
            // Reset the streak in memory
            guildData.currentNumber = 1;
            guildData.lastUser = null;
            countCache.set(message.guild.id, guildData);
            
            // Sync reset to DB
            CountGuild.updateOne(
                { guildId: message.guild.id }, 
                { currentNumber: 1, lastUser: null }
            ).catch(() => {});
        }
    });
};
            
