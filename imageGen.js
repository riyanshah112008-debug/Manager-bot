const { AttachmentBuilder, EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignore bots and DMs
        if (message.author.bot || !message.guild) return;

        // Command: .imagine <your prompt>
        if (message.content.startsWith('.imagine')) {
            
            // Extract the prompt by removing the ".imagine " part
            const prompt = message.content.slice(8).trim();

            if (!prompt) {
                return message.reply('❌ **Usage:** `.imagine <what you want to see>`\nExample: `.imagine a futuristic cyberpunk city with flying cars`');
            }

            // Send a waiting message so the user knows the bot didn't freeze
            const waitMsg = await message.reply('⏳ **Painting your image...** *(This usually takes about 5 to 10 seconds)*');
            await message.channel.sendTyping();

            try {
                // 1. Clean the prompt so it can be safely put into a web URL
                const encodedPrompt = encodeURIComponent(prompt);
                
                // 2. Generate a random number so typing the same prompt twice gives a different image!
                const randomSeed = Math.floor(Math.random() * 1000000);

                // 3. The free Pollinations AI endpoint
                // We request a 1024x1024 high-resolution image with no watermarks
                const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?seed=${randomSeed}&width=1024&height=1024&nologo=true`;

                // 4. Download the image directly from the AI and attach it
                const attachment = new AttachmentBuilder(imageUrl, { name: 'ai-art.png' });

                // 5. Build a beautiful embed to display the artwork
                const embed = new EmbedBuilder()
                    .setColor('Purple')
                    .setTitle('🎨 AI Image Generator')
                    .setDescription(`**Prompt:** "${prompt}"`)
                    .setFooter({ 
                        text: `Requested by ${message.author.username}`, 
                        iconURL: message.author.displayAvatarURL({ dynamic: true }) 
                    });

                // 6. Edit the original waiting message to show the final result!
                await waitMsg.edit({ content: null, embeds: [embed], files: [attachment] });

            } catch (error) {
                console.error('AI Image Generation Error:', error);
                await waitMsg.edit('❌ **Error:** The AI engine failed to generate an image right now. It might be overloaded. Please try again in a minute!');
            }
        }
    });
};
                              
