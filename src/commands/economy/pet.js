const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const User = require('../../models/User');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription('Manage your virtual pets!')
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('Check your active pet and its happiness level')
        )
        .addSubcommand(sub => sub
            .setName('equip')
            .setDescription('Equip a different pet from your inventory')
            .addStringOption(opt => 
                opt.setName('name')
                    .setDescription('The exact name of the pet you want to equip')
                    .setRequired(true)
            )
        ),

    async execute(interaction, client) {
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;
        
        const userData = await User.findOne({ userId, guildId });

        if (!userData || !userData.inventory || userData.inventory.length === 0) {
            return interaction.reply({ content: '❌ You don\'t own any pets yet! Buy one from the `/shop`.', ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        // ==========================================
        // 🐾 PET STATUS SUBCOMMAND
        // ==========================================
        if (sub === 'status') {
            const activePet = userData.activePet;
            if (!activePet) {
                return interaction.reply({ content: 'You own pets, but don\'t have one equipped! Use `/pet equip`.', ephemeral: true });
            }

            const happiness = userData.petHappiness || 0;
            
            // Build the visual progress bar
            const filledCount = Math.round(happiness / 10);
            const emptyCount = 10 - filledCount;
            const progressBar = '🟩'.repeat(filledCount) + '⬛'.repeat(emptyCount);

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🐾 Pet Status')
                .setDescription(`**Active Pet:** ${activePet}\n\n**Happiness Meter:**\n${progressBar} **${happiness}%**\n\n*Keep chatting to raise happiness and earn up to 35% more credits from chests!*`)
                .addFields({ name: '🎒 Your Pet Inventory', value: userData.inventory.join(', ') || 'None' })
                .setFooter({ text: 'Starry Pet System', iconURL: client.user.displayAvatarURL() });

            return interaction.reply({ embeds: [embed] });
        }

        // ==========================================
        // 🎒 PET EQUIP SUBCOMMAND
        // ==========================================
        if (sub === 'equip') {
            const petName = interaction.options.getString('name');
            
            // Case-insensitive search so users don't have to capitalize perfectly
            const foundPet = userData.inventory.find(p => p.toLowerCase() === petName.toLowerCase());
            
            if (!foundPet) {
                return interaction.reply({ content: `❌ You don't own a pet named "${petName}". Check your inventory with \`/pet status\`.`, ephemeral: true });
            }

            if (userData.activePet === foundPet) {
                return interaction.reply({ content: `⚠️ **${foundPet}** is already equipped!`, ephemeral: true });
            }

            // Equip the new pet
            userData.activePet = foundPet;
            await userData.save();

            return interaction.reply(`✅ You have successfully equipped your **${foundPet}**!`);
        }
    }
};
