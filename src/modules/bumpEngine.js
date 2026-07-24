const { EmbedBuilder } = require('discord.js');
const BumpSystem = require('../models/BumpSystem');

module.exports = (client) => {

    // ==========================================
    // ⏰ BACKGROUND TIMER (Checks every 60 seconds)
    // ==========================================
    setInterval(async () => {
        try {
            const dueBumps = await BumpSystem.find({ nextBump: { $lte: new Date() }, isReady: false });

            for (const data of dueBumps) {
                data.isReady = true;
                await data.save();

                const guild = client.guilds.cache.get(data.guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(data.reminderChannelId) || guild.systemChannel;
                if (!channel) continue;

                const pingText = data.pingRoleId ? `<@&${data.pingRoleId}>` : '';

                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🚀 It is time to Bump!')
                    .setDescription('The 2-hour cooldown is over! Please run `/bump` (for Starry) and `/bump` (for Disboard) to help our server grow.')
                    .setThumbnail('https://cdn-icons-png.flaticon.com/512/2852/2852825.png') 
                    .setFooter({ text: 'Starry Auto-Bumper' });

                await channel.send({ content: pingText, embeds: [embed] }).catch(() => {});
            }
        } catch (error) {
            console.error('Bump Engine Error:', error);
        }
    }, 60000); 

    // ==========================================
    // 📡 DETECT DISBOARD & DISCADIA BUMPS
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (!message.guild) return;

        let isBump = false;

        // --- 1. DISBOARD DETECTION ---
        if (message.author.id === '302050872383242240') { 
            if (message.embeds.length > 0 && message.embeds[0].description?.toLowerCase().includes('bump done')) {
                isBump = true;
            }
        }

        // --- 2. DISCADIA DETECTION ---
        const lowerName = message.author.username.toLowerCase();
        if (lowerName.includes('discardia') || lowerName.includes('discadia')) {
            const embed = message.embeds[0];
            if (embed && ((embed.description?.toLowerCase().includes('bump')) || (embed.title?.toLowerCase().includes('bump')))) {
                isBump = true;
            }
        }

        // --- 3. REGISTER THE TIMER ---
        if (isBump) {
            const nextTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // Exactly 2 hours

            let bumpData = await BumpSystem.findOne({ guildId: message.guild.id });
            if (!bumpData) bumpData = new BumpSystem({ guildId: message.guild.id });

            if (!bumpData.reminderChannelId) bumpData.reminderChannelId = message.channel.id;
            
            bumpData.nextBump = nextTime;
            bumpData.isReady = false;
            await bumpData.save();

            const embed = new EmbedBuilder()
                .setColor('#3498db')
                .setTitle('✅ Disboard Bump Registered!')
                .setDescription(`Thank you for bumping! I will remind you again in exactly 2 hours (<t:${Math.floor(nextTime.getTime() / 1000)}:R>).`);
            
            await message.channel.send({ embeds: [embed] }).catch(()=>{});
        }
    });
};
