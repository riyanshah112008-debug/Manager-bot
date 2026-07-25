const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildTelemetry = require('../../models/GuildTelemetry');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('telemetry')
        .setDescription('📡 Bot Owner Only: Receive an immediate telemetry report in your DMs.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .setDMPermission(true),

    async execute(interaction) {
        // Restrict usage to the Bot Owner
        if (process.env.OWNER_ID && interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '❌ Only the Bot Owner can run this command!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // IF RUN INSIDE A SERVER: Send that specific server's stats
            if (interaction.guild) {
                let telemetry = await GuildTelemetry.findOne({ guildId: interaction.guild.id });
                if (!telemetry) telemetry = await GuildTelemetry.create({ guildId: interaction.guild.id, guildName: interaction.guild.name });

                const vcHours = (telemetry.totalVcSeconds / 3600).toFixed(1);
                const embed = new EmbedBuilder()
                    .setColor('#7289DA')
                    .setTitle(`📩 On-Demand Telemetry: ${interaction.guild.name}`)
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }) || null)
                    .addFields(
                        { name: '👥 Member Velocity', value: `• Total Members: **${interaction.guild.memberCount}**\n• Joins Past Hour: **${telemetry.joinsThisHour}** /hr`, inline: true },
                        { name: '🎙️ Voice Active Time', value: `• Total VC Duration: **${vcHours} hrs**`, inline: true },
                        { name: '🛡️ Security Enforcements', value: `• Warns: **${telemetry.modStats.warns}**\n• Kicks: **${telemetry.modStats.kicks}**\n• Bans: **${telemetry.modStats.bans}**\n• AutoMod Actions: **${telemetry.modStats.automodTriggers}**`, inline: false }
                    )
                    .setFooter({ text: `Guild ID: ${interaction.guild.id} • Starry Network Intelligence` })
                    .setTimestamp();

                await interaction.user.send({ embeds: [embed] });
                return interaction.editReply('✅ Telemetry report dispatched to your DMs!');
            } 
            
            // IF RUN IN DMs: Send a Global Network Summary of ALL servers
            else {
                const allData = await GuildTelemetry.find({});
                const totalServers = interaction.client.guilds.cache.size;
                
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
                    .setTitle('🌐 Global Network Telemetry')
                    .setDescription(`Live overview across all **${totalServers}** connected servers.`)
                    .addFields(
                        { name: '👥 Network Joins (Past Hour)', value: `**${globalJoins}** new members`, inline: true },
                        { name: '🎙️ Network Voice Time', value: `**${globalVcHours}** total hours`, inline: true },
                        { name: '🛡️ Global Enforcements', value: `• Warns: **${globalWarns}**\n• Kicks: **${globalKicks}**\n• Bans: **${globalBans}**\n• AutoMod Stops: **${globalAutomod}**`, inline: false }
                    )
                    .setFooter({ text: 'Starry Global Intelligence Network' })
                    .setTimestamp();
                
                await interaction.user.send({ embeds: [embed] });
                return interaction.editReply('✅ Global network report delivered!');
            }

        } catch (error) {
            console.error('Telemetry Command Error:', error);
            return interaction.editReply('❌ Failed to send DM. Make sure your DMs are open!');
        }
    }
};
