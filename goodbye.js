const { EmbedBuilder, PermissionsBitField, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

const dbPath = path.join(__dirname, 'goodbyeData.json');
// The path to your blank background image
const bgPath = path.join(__dirname, 'goodbye_bg.png'); 

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

        try {
            // --- Canvas Image Generation ---
            // Standard banner resolution (matches your image aspect ratio)
            const canvas = createCanvas(1024, 450); 
            const ctx = canvas.getContext('2d');

            // Load the blank starry background
            const background = await loadImage(bgPath);
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            // Draw the user's actual username at the bottom center
            ctx.font = '36px sans-serif'; 
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(member.user.username, 512, 380); 

            // Create a circular clipping mask for the avatar
            ctx.beginPath();
            ctx.arc(512, 140, 90, 0, Math.PI * 2, true); 
            ctx.closePath();
            ctx.clip();
            
            // Load and draw the leaving user's avatar
            const avatar = await loadImage(member.user.displayAvatarURL({ extension: 'png', size: 256 }));
            ctx.drawImage(avatar, 422, 50, 180, 180);

            // Convert canvas to a Discord attachment
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'goodbye-image.png' });

            // --- Embed Creation ---
            const embed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('👋 Someone left...')
                .setDescription(`**${member.user.tag}** has left the server. We are now down to **${member.guild.memberCount}** members.`)
                .setImage('attachment://goodbye-image.png');

            await channel.send({ embeds: [embed], files: [attachment] }).catch(console.error);

        } catch (error) {
            console.error('Error generating goodbye canvas:', error);
            
            // Fallback embed if the image fails to generate (e.g., missing background file)
            const fallbackEmbed = new EmbedBuilder()
                .setColor('#2b2d31')
                .setTitle('👋 Someone left...')
                .setDescription(`**${member.user.tag}** has left the server. We are now down to **${member.guild.memberCount}** members.`)
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true }));

            await channel.send({ embeds: [fallbackEmbed] }).catch(() => {});
        }
    });
};
