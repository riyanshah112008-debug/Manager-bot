const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'welcomeData.json');

function getWelcomeData() {
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function saveWelcomeData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = (client) => {
    // 1. Handle the Slash Command
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setupwelcome') return;
        
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ You need Manage Server permissions to do this.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const data = getWelcomeData();
        
        data[interaction.guild.id] = channel.id;
        saveWelcomeData(data);

        await interaction.reply({ content: `✅ Welcome messages will now be sent to ${channel}!`, ephemeral: true });
    });

    // 2. Handle the User Joining
    client.on('guildMemberAdd', async (member) => {
        const data = getWelcomeData();
        const channelId = data[member.guild.id];
        if (!channelId) return;

        const channel = member.guild.channels.cache.get(channelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor('#FFD700')
            .setTitle(`✨ Welcome to ${member.guild.name} ✨`)
            .setDescription(`Hello <@${member.id}>, we are so glad you joined the server! Be sure to read the rules and enjoy your stay.`)
            .addFields(
                { name: '👤 Member Count', value: `You are member **#${member.guild.memberCount}**!` },
                { name: '📆 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>` }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `Enjoy your stay! | ${new Date().toLocaleDateString()}` });

        await channel.send({ content: `Hey <@${member.id}>! 👋`, embeds: [embed] }).catch(() => {});
    });
};
        
