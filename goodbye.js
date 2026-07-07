const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'goodbyeData.json');

function getGoodbyeData() {
    if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({}));
    return JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
}

function saveGoodbyeData(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

module.exports = (client) => {
    // 1. Handle the Slash Command
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'setupgoodbye') return;
        
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
            return interaction.reply({ content: '❌ You need Manage Server permissions to do this.', ephemeral: true });
        }

        const channel = interaction.options.getChannel('channel');
        const data = getGoodbyeData();
        
        data[interaction.guild.id] = channel.id;
        saveGoodbyeData(data);

        await interaction.reply({ content: `✅ Goodbye messages will now be sent to ${channel}!`, ephemeral: true });
    });

    // 2. Handle the User Leaving
    client.on('guildMemberRemove', async (member) => {
        const data = getGoodbyeData();
        const channelId = data[member.guild.id];
        if (!channelId) return;

        const channel = member.guild.channels.cache.get(channelId);
        if (!channel) return;

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setTitle('👋 Someone left...')
            .setDescription(`**${member.user.tag}** has left the server. We are now down to **${member.guild.memberCount}** members.`)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

        await channel.send({ embeds: [embed] }).catch(() => {});
    });
};
              
