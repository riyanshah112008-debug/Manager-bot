const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const User = require('../../models/User');

// Define Shop Items (Role IDs & Prices)
const SHOP_ITEMS = [
    { label: 'VIP Role', value: 'role_vip', price: 1000, roleName: 'VIP', description: 'Unlock special VIP access' },
    { label: 'High Roller', value: 'role_highroller', price: 5000, roleName: 'High Roller', description: 'Show off your massive credit wealth' },
    { label: 'Server Legend', value: 'role_legend', price: 15000, roleName: 'Legend', description: 'The ultimate luxury role' }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Open the server shop to buy exclusive roles with your Credits!'),

    async execute(interaction, client) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        let userData = await User.findOne({ userId, guildId });
        const balance = userData ? userData.credits : 0;

        const embed = new EmbedBuilder()
            .setColor('#23a559')
            .setTitle('🛍️ Starry Credit Shop')
            .setDescription(
                `Your Current Balance: 💳 **${balance.toLocaleString()} Credits**\n\n` +
                `Select an item from the menu below to purchase exclusive roles!`
            )
            .setFooter({ text: 'Starry Economy', iconURL: client.user.displayAvatarURL() });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('shop_buy_menu')
            .setPlaceholder('Choose a role to purchase...')
            .addOptions(
                SHOP_ITEMS.map(item => ({
                    label: `${item.label} — 💳 ${item.price.toLocaleString()} Credits`,
                    description: item.description,
                    value: item.value
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        return interaction.reply({ embeds: [embed], components: [row] });
    }
};

// Export item configuration for shop processing
module.exports.SHOP_ITEMS = SHOP_ITEMS;
