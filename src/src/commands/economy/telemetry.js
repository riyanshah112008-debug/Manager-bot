const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const GuildTelemetry = require('../../models/GuildTelemetry');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('telemetry')
        .setDescription('📡 Bot Owner Only: View the Global Network Dashboard.')
        .setDMPermission(true),

    async execute(interaction) {
        // Restrict usage strictly to the Bot Owner
        if (process.env.OWNER_ID && interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '❌ Only the Bot Owner can run this command!', ephemeral: true });
        }

        // Defer reply so Discord doesn't timeout while calculating
        await interaction.deferReply();

        try {
            // Fetch ALL telemetry data from MongoDB
            const allData = await GuildTelemetry.find({});
            const totalServers = interaction.client.guilds.cache.size;
            
            // Calculate total users across all servers combined
            const totalGlobalMembers = interaction.client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            
            let globalJoins = 0, globalVc = 0;
            let globalWarns = 0, globalKicks = 0, globalBans = 0, globalAutomod = 0;

            // Tally up all the stats
            allData.forEach(t => {
                globalJoins += t.joinsThisHour || 0;
                globalVc += t.totalVcSeconds || 0;
                globalWarns += t.modStats?.warns || 0;
                globalKicks += t.modStats?.kicks || 0;
                globalBans += t.modStats?.bans || 0;
                globalAutomod += t.modStats?.automodTriggers || 0;
            });

            const globalVcHours = (globalVc / 3600).toFixed(1);

            const embed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🌐 Starry Global Network Intelligence')
                .setDescription(`Live overview of Starry's entire ecosystem.`)
                .addFields(
                    { name: '🌍 Ecosystem', value: `• **${totalServers}** Active Servers\n• **${totalGlobalMembers.toLocaleString()}** Total Users`, inline: true },
                    { name: '👥 Network Joins (Past Hour)', value: `• **${globalJoins}** new users globally`, inline: true },
                    { name: '🎙️ Voice Engagement', value: `• **${globalVcHours}** hours tracked globally`, inline: true },
                    { name: '🛡️ Global Enforcements', value: `• Warns: **${globalWarns}**\n• Kicks: **${globalKicks}**\n• Bans: **${globalBans}**\n• AutoMod Stops: **${globalAutomod}**`, inline: false }
                )
                .setFooter({ text: 'Starry Central Command', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();
            
            // Send the dashboard directly in Starry's DMs
            return interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('Telemetry Command Error:', error);
            return interaction.editReply('❌ A database error occurred while fetching the global dashboard.');
        }
    }
};
