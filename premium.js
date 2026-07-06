new SlashCommandBuilder()
    .setName("activatepremium")
    .setDescription("Activate Premium for a server")
    .addStringOption(option =>
        option
            .setName("server_id")
            .setDescription("Server ID")
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName("removepremium")
    .setDescription("Remove Premium from a server")
    .addStringOption(option =>
        option
            .setName("server_id")
            .setDescription("Server ID")
            .setRequired(true)
    ),

new SlashCommandBuilder()
    .setName("premiumcheck")
    .setDescription("Check this server's Premium status"),

    client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const isOwner = interaction.user.id === process.env.OWNER_ID;

    // /premiumcheck
    if (interaction.commandName === "premiumcheck") {
        if (!interaction.guild)
            return interaction.reply({
                content: "❌ Use this command in a server.",
                ephemeral: true
            });

        const embed = new EmbedBuilder()
            .setColor(client.isPremium(interaction.guild.id) ? "#FFD700" : "#2b2d31")
            .setTitle("⭐ Premium Status")
            .setDescription(
                client.isPremium(interaction.guild.id)
                    ? "✅ **Premium is ACTIVE for this server!** All advanced features and Starry AI are unlocked."
                    : "❌ **Premium is NOT active.** Upgrade to unlock Starry AI and advanced protections."
            )
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }

    // /activatepremium
    if (interaction.commandName === "activatepremium") {
        if (!isOwner)
            return interaction.reply({
                content: "❌ Only the bot owner can use this command.",
                ephemeral: true
            });

        const targetServer = interaction.options.getString("server_id");

        if (!premiumData.servers.includes(targetServer)) {
            premiumData.servers.push(targetServer);
            savePremium();

            return interaction.reply(
                `✅ **SUCCESS:** Premium has been enabled for server \`${targetServer}\`!`
            );
        }

        return interaction.reply({
            content: "⚠️ That server already has Premium activated.",
            ephemeral: true
        });
    }

    // /removepremium
    if (interaction.commandName === "removepremium") {
        if (!isOwner)
            return interaction.reply({
                content: "❌ Only the bot owner can use this command.",
                ephemeral: true
            });

        const targetServer = interaction.options.getString("server_id");

        if (premiumData.servers.includes(targetServer)) {
            premiumData.servers = premiumData.servers.filter(id => id !== targetServer);
            savePremium();

            return interaction.reply(
                `❌ **REVOKED:** Premium has been removed for server \`${targetServer}\`.`
            );
        }

        return interaction.reply({
            content: "⚠️ That server does not currently have Premium.",
            ephemeral: true
        });
    }
});
