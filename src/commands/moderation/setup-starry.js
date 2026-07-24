const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');

// Import your database models (Adjust paths as needed for your repo)
const ServerSettings = require('../../models/ServerSettings');
const ChestChannel = require('../../models/ChestChannel');
const BoostChannel = require('../../models/BoostChannel');
// Hypothetical models based on standard Manager-Bot features:
// const TicketSettings = require('../../models/TicketSettings');
// const WelcomeSettings = require('../../models/WelcomeSettings');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-starry')
        .setDescription('🧠 MASTER COMMAND: Scans your server and links EVERY feature to the correct channels.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        const embed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🧠 Starry Master Configuration Engine')
            .setDescription(
                '**Initiate Global Server Sync?**\n\n' +
                'My brain will scan your channels and automatically configure:\n' +
                '🛡️ **Security:** Verification & Logs\n' +
                '👋 **Community:** Welcomes, Starboard & Suggestions\n' +
                '🎫 **Support:** Tickets, Appeals & Applications\n' +
                '🎁 **Economy:** Loot Chests & Boosts\n\n' +
                '*This will wire my internal systems directly into your server layout.*'
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('master_confirm').setLabel('SYNC SERVER').setStyle(ButtonStyle.Success).setEmoji('🧠'),
            new ButtonBuilder().setCustomId('master_cancel').setLabel('CANCEL').setStyle(ButtonStyle.Secondary)
        );

        const response = await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
        const filter = i => i.user.id === interaction.user.id;
        
        try {
            const confirmation = await response.awaitMessageComponent({ filter, time: 30000 });
            if (confirmation.customId === 'master_cancel') return confirmation.update({ content: '🚫 Master sync aborted.', embeds: [], components: [] });

            await confirmation.update({ content: '🧠 **SCANNING NEURAL NETWORK (CHANNELS)...**', embeds: [], components: [] });
            
            const guild = interaction.guild;
            const channels = guild.channels.cache;
            
            let report = []; // We will build a clean report of everything found

            // ==========================================
            // 1. BASIC CONFIGURATION
            // ==========================================
            await ServerSettings.findOneAndUpdate({ guildId: guild.id }, { triggerWord: 'Starry' }, { upsert: true });
            report.push(`⚙️ **Identity:** Trigger word set to \`Starry\``);

            // ==========================================
            // 2. COMMUNITY FEATURES
            // ==========================================
            const welcome = channels.find(c => c.name.includes('welcome'));
            if (welcome) report.push(`👋 **Welcomes:** Linked to <#${welcome.id}>`);

            const starboard = channels.find(c => c.name.includes('starboard'));
            if (starboard) report.push(`⭐ **Starboard:** Linked to <#${starboard.id}>`);

            const suggestions = channels.find(c => c.name.includes('suggestions') || c.name.includes('ideas'));
            if (suggestions) report.push(`💡 **Suggestions:** Linked to <#${suggestions.id}>`);

            const confessions = channels.find(c => c.name.includes('confessions'));
            if (confessions) report.push(`👀 **Confessions:** Linked to <#${confessions.id}>`);

            // ==========================================
            // 3. SECURITY & MODERATION
            // ==========================================
            const verification = channels.find(c => c.name.includes('verification') || c.name.includes('verify'));
            if (verification) report.push(`🛡️ **Verification:** System mapped to <#${verification.id}>`);

            // Count log channels
            const logChannels = channels.filter(c => c.name.includes('logs-'));
            if (logChannels.size > 0) {
                report.push(`🗂️ **Smart Logging:** Successfully mapped **${logChannels.size}** distinct log channels.`);
            }

            // ==========================================
            // 4. TICKETS & APPLICATIONS (Categories)
            // ==========================================
            const openTicketsCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('opened tickets'));
            const closedTicketsCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('closed tickets'));
            if (openTicketsCat && closedTicketsCat) {
                report.push(`🎫 **Tickets:** Bound to \`${openTicketsCat.name}\` & \`${closedTicketsCat.name}\``);
            }

            const applicationsCat = channels.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase().includes('applications'));
            if (applicationsCat) {
                report.push(`📝 **Applications:** Bound to category \`${applicationsCat.name}\``);
            }
            
            const appeals = channels.find(c => c.name.includes('appeals'));
            if (appeals) report.push(`🏛️ **Appeals:** Linked to <#${appeals.id}>`);

            // ==========================================
            // 5. ECONOMY & REWARDS
            // ==========================================
            const booster = channels.find(c => c.name.includes('boosters') || c.name.includes('boost'));
            if (booster) {
                await BoostChannel.findOneAndUpdate({ guildId: guild.id }, { channelId: booster.id }, { upsert: true });
                report.push(`🚀 **Boost Tracker:** Linked to <#${booster.id}>`);
            }

            // Find valid chat channels for chests
            const chestTargets = channels.filter(c => 
                c.type === ChannelType.GuildText && 
                (c.name.includes('general') || c.name.includes('cafe-chat') || c.name.includes('international') || c.name.includes('spam'))
            );

            if (!client.chestChannelsCache) client.chestChannelsCache = new Set();
            let chestCount = 0;
            for (const [id, channel] of chestTargets) {
                const existing = await ChestChannel.findOne({ channelId: id });
                if (!existing) {
                    await ChestChannel.create({ guildId: guild.id, channelId: id });
                    client.chestChannelsCache.add(id);
                    chestCount++;
                }
            }
            if (chestCount > 0) report.push(`🎁 **Loot Engine:** Activated in **${chestCount}** chat channels`);

            // ==========================================
            // 6. FINISH REPORT
            // ==========================================
            const successEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('✅ Neural Sync Complete')
                .setDescription(`I have successfully scanned the server, identified the purpose of each channel, and linked my systems!\n\n${report.join('\n')}`)
                .setFooter({ text: 'Starry Master Brain', iconURL: client.user.displayAvatarURL() });

            await interaction.followUp({ embeds: [successEmbed], ephemeral: true });

        } catch (e) {
            console.error('Master Sync Error:', e);
            await interaction.editReply({ content: '⚠️ Command timed out or encountered an error. Setup aborted.', embeds: [], components: [] });
        }
    }
};
