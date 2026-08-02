// ==========================================
// 🔢 STARRY ADVANCED COUNTING ENGINE (modules/count.js)
// ==========================================
const { PermissionsBitField, SlashCommandBuilder, EmbedBuilder, ChannelType, MessageFlags } = require('discord.js');
const mongoose = require('mongoose');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

// MONGODB SCHEMA
const CountSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    currentNumber: { type: Number, default: 1 },
    highScore: { type: Number, default: 0 },
    lastUser: { type: String, default: null }
});

const CountGuild = mongoose.models.CountGuild || mongoose.model('CountGuild', CountSchema);

// SLASH COMMAND PAYLOADS
const countSetupPayload = new SlashCommandBuilder()
    .setName('setupcount')
    .setDescription('🔢 Configure the server counting game channel.')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('The text channel where members will count')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
    );

const countStatsPayload = new SlashCommandBuilder()
    .setName('countstats')
    .setDescription('📊 View the current counting game statistics and high score.');

module.exports = (client) => {
    const PREFIX = '.';
    const countCache = new Map();

    // Load Database into Memory Cache
    (async () => {
        try {
            const data = await CountGuild.find().lean();
            data.forEach(g => countCache.set(g.guildId, {
                channelId: g.channelId,
                currentNumber: g.currentNumber,
                highScore: g.highScore || 0,
                lastUser: g.lastUser
            }));
            console.log('✅ Counting Game Engine Active (MongoDB Synced & Cached)');
        } catch (err) {
            console.error('❌ Failed to load counting data:', err.message);
        }
    })();

    // 1. SLASH COMMAND INTERACTION ROUTER
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'setupcount') {
            const channel = interaction.options.getChannel('channel');
            const existing = countCache.get(interaction.guild.id);
            const highScore = existing ? existing.highScore : 0;
            const newData = { channelId: channel.id, currentNumber: 1, highScore: highScore, lastUser: null };

            countCache.set(interaction.guild.id, newData);
            await CountGuild.findOneAndUpdate({ guildId: interaction.guild.id }, newData, { upsert: true });

            await interaction.reply({ content: `✅ <#${channel.id}> is now configured as the Counting Game channel! Start by typing \`1\`.`, flags: [EPHEMERAL_FLAG] }).catch(() => {});
            
            const startEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🔢 Counting Game Started!')
                .setDescription('Rules:\n1. Count up starting from **1**.\n2. You cannot count two numbers in a row!\n3. Math expressions (e.g. `5+5`) are allowed.\n\nNext Number: **1**')
                .setFooter({ text: 'Starry Counting Engine' });

            await channel.send({ embeds: [startEmbed] }).catch(() => {});
        }

        if (interaction.commandName === 'countstats') {
            const guildData = countCache.get(interaction.guild.id);
            if (!guildData) {
                return interaction.reply({ content: '❌ The counting game has not been set up in this server yet! Use `/setupcount`.', flags: [EPHEMERAL_FLAG] }).catch(() => {});
            }

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 Counting Game Statistics')
                .addFields(
                    { name: '🔢 Current Target Number', value: `\`${guildData.currentNumber}\``, inline: true },
                    { name: '🏆 Server High Score', value: `\`${guildData.highScore}\``, inline: true },
                    { name: '💬 Counting Channel', value: `<#${guildData.channelId}>`, inline: false }
                )
                .setFooter({ text: 'Starry Counting Engine • Keep the streak alive!' })
                .setTimestamp();

            return interaction.reply({ embeds: [embed] }).catch(() => {});
        }
    });

    // 2. MESSAGE LISTENER & MATH EVALUATION ENGINE
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Prefix Command (.setupcount / .countstats)
        if (message.content.toLowerCase().startsWith(PREFIX + 'setupcount')) {
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

            const channel = message.mentions.channels.first() || message.channel;
            const existing = countCache.get(message.guild.id);
            const highScore = existing ? existing.highScore : 0;
            const newData = { channelId: channel.id, currentNumber: 1, highScore: highScore, lastUser: null };

            countCache.set(message.guild.id, newData);
            await CountGuild.findOneAndUpdate({ guildId: message.guild.id }, newData, { upsert: true });

            await message.reply(`✅ <#${channel.id}> is now configured as the Counting Game channel! Start by typing \`1\`.`).catch(() => {});
            return;
        }

        if (message.content.toLowerCase() === PREFIX + 'countstats') {
            const guildData = countCache.get(message.guild.id);
            if (!guildData) return message.reply('❌ Counting game not configured. Use `.setupcount` or `/setupcount`.');

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 Counting Game Statistics')
                .addFields(
                    { name: '🔢 Current Target Number', value: `\`${guildData.currentNumber}\``, inline: true },
                    { name: '🏆 Server High Score', value: `\`${guildData.highScore}\``, inline: true },
                    { name: '💬 Channel', value: `<#${guildData.channelId}>`, inline: false }
                )
                .setFooter({ text: 'Starry Counting Engine' });

            return message.reply({ embeds: [embed] }).catch(() => {});
        }

        const guildData = countCache.get(message.guild.id);
        if (!guildData || message.channel.id !== guildData.channelId) return;
        if (message.content.startsWith(PREFIX) || message.content.startsWith('/')) return;

        const expectedNumber = guildData.currentNumber;
        const msgText = message.content.trim();

        // Safe Math Evaluator
        let typedNumber = NaN;
        try {
            if (/^[\d+\-*/().\s]+$/.test(msgText)) {
                typedNumber = Math.floor(eval(msgText));
            }
        } catch (e) {
            typedNumber = NaN;
        }

        if (isNaN(typedNumber)) {
            // Silently remove non-numeric chatter to keep channel clean
            return message.delete().catch(() => {});
        }

        if (typedNumber === expectedNumber && message.author.id !== guildData.lastUser) {
            // ✅ CORRECT COUNT
            message.react('✅').catch(() => {});

            guildData.currentNumber++;
            guildData.lastUser = message.author.id;

            // Check & Update High Score
            const currentStreak = guildData.currentNumber - 1;
            if (currentStreak > guildData.highScore) {
                guildData.highScore = currentStreak;
            }

            if (currentStreak % 25 === 0 && currentStreak > 0) {
                message.channel.send(`🎉 **New Milestone Reached!** This server hit a counting streak of **${currentStreak}**! 🚀`).catch(() => {});
            }

            countCache.set(message.guild.id, guildData);

            CountGuild.updateOne(
                { guildId: message.guild.id }, 
                { currentNumber: guildData.currentNumber, highScore: guildData.highScore, lastUser: guildData.lastUser }
            ).catch(() => {});

        } else {
            // ❌ WRONG NUMBER OR SAME USER REPEAT
            message.react('❌').catch(() => {});

            const reason = message.author.id === guildData.lastUser 
                ? "You cannot count two numbers in a row!" 
                : `Incorrect number! Expected **${expectedNumber}**.`;

            const previousScore = guildData.currentNumber - 1;

            const embed = new EmbedBuilder()
                .setColor('#ED4245')
                .setTitle('🚨 STREAK RUINED!')
                .setDescription(`Ruined by <@${message.author.id}>\n**Reason:** ${reason}\n\n📉 **Streak Reached:** \`${previousScore}\`\n🏆 **Server Record (High Score):** \`${guildData.highScore}\``)
                .setFooter({ text: 'Count reset to 1. Start again with 1!' })
                .setTimestamp();

            await message.channel.send({ embeds: [embed] });

            // Reset streak
            guildData.currentNumber = 1;
            guildData.lastUser = null;
            countCache.set(message.guild.id, guildData);

            CountGuild.updateOne(
                { guildId: message.guild.id }, 
                { currentNumber: 1, lastUser: null }
            ).catch(() => {});
        }
    });
};

module.exports.countSlashCommands = [countSetupPayload, countStatsPayload];
