const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const ServerListing = require('../../models/ServerListing');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('set-listing')
        .setDescription('Configure how your server appears on the Starry Server Web List!')
        .addStringOption(option => 
            option.setName('description')
            .setDescription('A short description of your server (Max 150 chars)')
            .setRequired(true)
            .setMaxLength(150))
        .addStringOption(option => 
            option.setName('tags')
            .setDescription('Comma-separated tags (e.g., Gaming, Anime, Chill)')
            .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        const description = interaction.options.getString('description');
        const tagsInput = interaction.options.getString('tags') || '';
        const tags = tagsInput.split(',').map(tag => tag.trim().substring(0, 15)).filter(t => t.length > 0).slice(0, 4);

        let listing = await ServerListing.findOne({ guildId: interaction.guild.id });
        
        if (!listing) {
            // They haven't bumped yet, but we will save their config anyway
            listing = new ServerListing({
                guildId: interaction.guild.id,
                name: interaction.guild.name,
                inviteLink: 'Not generated yet (Run /bump)'
            });
        }

        listing.description = description;
        listing.tags = tags;
        listing.iconUrl = interaction.guild.iconURL({ extension: 'png', size: 256 }) || null;
        await listing.save();

        const embed = new EmbedBuilder()
            .setColor('#5865F2')
            .setTitle('🌐 Web Listing Updated!')
            .setDescription('Your server profile has been updated on the Starry global network.')
            .addFields(
                { name: 'Description', value: description },
                { name: 'Tags', value: tags.length > 0 ? tags.map(t => `\`${t}\``).join(' ') : 'None' }
            )
            .setThumbnail(listing.iconUrl);

        return interaction.editReply({ embeds: [embed] });
    }
};
