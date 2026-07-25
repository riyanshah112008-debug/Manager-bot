const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const GuildTelemetry = require('../../models/GuildTelemetry');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('telemetry')
        .setDescription('📡 Bot Owner Only: Receive an immediate telemetry report in your DMs.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Restrict usage to the Bot Owner
        if (process.env.OWNER_ID && interaction.user.id !== process.env.OWNER_ID) {
            return interaction.reply({ content: '❌ Only the Bot Owner can run this command!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const guild = interaction.guild;
            let telemetry = await GuildTelemetry.findOne({ guildId: guild.id });

            if (!telemetry) {
                telemetry = await GuildTelemetry.create({ guildId: guild.id, guildName: guild.name });
            }

            const vcHours = (telemetry.totalVcSeconds / 3600).toFixed(1);

            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle(`📩 On-Demand Telemetry: ${guild.name}`)
                .setThumbnail(guild.iconURL({ dynamic: true }) || null)
                .addFields(
                    { name: '👥 Member Velocity', value: `• Total Members: **${guild.memberCount}**\n• Joins Past Hour: **${telemetry.joinsThisHour}** /hr`, inline: true },
                    { name: '🎙️ Voice Active Time', value: `• Total VC Duration: **${vcHours} hrs**`, inline: true },
                    { name: '🛡️ Security Enforcements', value: `• Warns: **${telemetry.modStats.warns}**\n• Kicks: **${telemetry.modStats.kicks}**\n• Bans: **${telemetry.modStats.bans}**\n• AutoMod Actions: **${telemetry.modStats.automodTriggers}**`, inline: false }
                )
                .setFooter({ text: `Guild ID: ${guild.id} • Starry Network Intelligence` })
                .setTimestamp();

            // Send to DM
            await interaction.user.send({ embeds: [embed] });
            return interaction.editReply('✅ Telemetry report has been dispatched to your DMs!');

        } catch (error) {
            console.error('Telemetry Command Error:', error);
            return interaction.editReply('❌ Failed to send DM. Make sure your DMs are open for this server!');
        }
    }
};
