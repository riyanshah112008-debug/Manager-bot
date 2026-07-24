const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
// Path updated to ../../ because we moved it into the economy folder!
const ServerListing = require('../../models/ServerListing');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('bump')
        .setDescription('Bump this server to the top of the Starry Global Web List!'),

    async execute(interaction) {
        await interaction.deferReply();
        const guild = interaction.guild;

        if (!guild.members.me.permissions.has(PermissionFlagsBits.CreateInstantInvite)) {
            return interaction.editReply('❌ I need the **Create Invites** permission to list this server!');
        }

        let listing = await ServerListing.findOne({ guildId: guild.id });
        const cooldown = 2 * 60 * 60 * 1000; // 2 hours

        if (listing && listing.lastBump && (Date.now() - listing.lastBump.getTime() < cooldown)) {
            const nextBump = Math.floor((listing.lastBump.getTime() + cooldown) / 1000);
            return interaction.editReply(`⏳ **Cooldown Active!** You can bump this server again <t:${nextBump}:R>.`);
        }

        let invite;
        try {
            invite = await interaction.channel.createInvite({ maxAge: 0, maxUses: 0, reason: 'Starry Server Listing' });
        } catch (e) {
            return interaction.editReply('❌ I could not create an invite link for this channel.');
        }

        if (!listing) listing = new ServerListing({ guildId: guild.id });

        listing.name = guild.name;
        listing.iconUrl = guild.iconURL({ extension: 'png', size: 256 }) || null;
        listing.inviteLink = invite.url;
        listing.memberCount = guild.memberCount;
        listing.bumps += 1;
        listing.lastBump = new Date();

        await listing.save();

        const embed = new EmbedBuilder()
            .setColor('#3BA55C')
            .setTitle('🚀 Server Bumped!')
            .setDescription(`**${guild.name}** has been pushed to the top of the Global Web List!`)
            .addFields(
                { name: 'Total Bumps', value: `📈 ${listing.bumps}`, inline: true },
                { name: 'Next Bump', value: `⏳ <t:${Math.floor((Date.now() + cooldown) / 1000)}:R>`, inline: true }
            )
            .setThumbnail(listing.iconUrl)
            .setFooter({ text: 'Starry Global Directory' });

        return interaction.editReply({ embeds: [embed] });
    }
};
            
