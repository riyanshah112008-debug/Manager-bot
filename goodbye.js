const { Events, AttachmentBuilder } = require('discord.js');
const Canvas = require('canvas');

module.exports = (client) => {
    // 1. SLASH COMMAND EXECUTION (Replies instantly to prevent Discord errors)
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'setgoodbye') {
            return interaction.reply({ 
                content: '✅ **Goodbye System is Active!**\nRight now, I am programmed to automatically look for a channel named `goodbye` or `leave`. Just name your channel one of those, and I will handle the rest!', 
                ephemeral: true 
            });
        }
    });

    // 2. GOODBYE IMAGE GENERATOR
    client.on(Events.GuildMemberRemove, async (member) => {
        // Find the goodbye channel. By default, it looks for a channel named 'goodbye' 
        // or falls back to the server's default system messages channel.
        const channel = member.guild.channels.cache.find(c => c.name === 'goodbye' || c.name === 'leave') || member.guild.systemChannel;
        if (!channel) return;

        try {
            // 1. Create a blank canvas
            const canvas = Canvas.createCanvas(1024, 450);
            const ctx = canvas.getContext('2d');

            // 2. Load your background image
            const bgURL = 'https://cdn.discordapp.com/attachments/1508799648154779772/1515357119564742847/lv_0_20260519173542.jpg?ex=6a4c5f8b&is=6a4b0e0b&hm=cff1d7636f0ef6d0c6b0d706dbe5e01327484f45922f3de181eecfd25bdbd420&';
            const background = await Canvas.loadImage(bgURL);
            ctx.drawImage(background, 0, 0, canvas.width, canvas.height);

            // Add a slight dark tint so white text is always readable over bright backgrounds
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // 3. Draw the "GOODBYE" text
            ctx.font = 'bold 80px sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText('GOODBYE', canvas.width / 2, canvas.height / 2 + 60);

            // 4. Draw the User's Tag (e.g., Username#1234)
            ctx.font = '40px sans-serif';
            ctx.fillStyle = '#cccccc';
            ctx.fillText(member.user.tag, canvas.width / 2, canvas.height / 2 + 120);

            // 5. Draw the User's Avatar in a circle
            ctx.beginPath();
            ctx.arc(canvas.width / 2, canvas.height / 2 - 80, 90, 0, Math.PI * 2, true);
            ctx.closePath();
            ctx.clip();

            const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await Canvas.loadImage(avatarURL);
            ctx.drawImage(avatar, canvas.width / 2 - 90, canvas.height / 2 - 170, 180, 180);

            // 6. Build and send the final image
            const attachment = new AttachmentBuilder(canvas.toBuffer(), { name: 'goodbye.png' });
            await channel.send({ content: `Farewell, **${member.user.username}**! 🌠`, files: [attachment] });

        } catch (err) {
            console.error('❌ Failed to generate goodbye image:', err);
        }
    });
};
