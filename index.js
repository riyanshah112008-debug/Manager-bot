const { EmbedBuilder } = require('discord.js');

// 👑 THE MASTER LOCK: Only your exact Discord ID can trigger this file
const OWNER_ID = '1465049039153135639'; 

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignore other bots and DMs
        if (message.author.bot || !message.guild) return;

        // 🛑 THE ULTIMATE GUARD: If the message isn't from you, stop immediately
        if (message.author.id !== OWNER_ID) return;

        const content = message.content;

        // Listen for the "starry" trigger word
        if (content.toLowerCase().startsWith('starry, ')) {
            // 'starry, ' is exactly 8 characters long, so we slice from index 8
            const args = content.slice(8).trim().split(/ +/);
            const command = args.shift().toLowerCase();
            const text = args.join(' ');

            try {
                // ==========================================
                // 🗣️ 1. ECHO COMMAND (Make the bot speak)
                // ==========================================
                // Usage: starry, say Hello everyone!
                if (command === 'say') {
                    await message.delete(); // Silently delete your trigger message
                    return message.channel.send(text);
                }

                // ==========================================
                // 🎮 2. STATUS COMMAND (Change bot activity)
                // ==========================================
                // Usage: starry, setstatus Watching over the server
                if (command === 'setstatus') {
                    client.user.setActivity(text);
                    return message.reply(`✅ System activity updated to: **${text}**`);
                }

                // ==========================================
                // 💻 3. EVAL COMMAND (Absolute God Mode)
                // ==========================================
                // Usage: starry, eval message.channel.send('I am alive!')
                if (command === 'eval') {
                    if (!text) return message.reply('❌ Awaiting instructions, boss.');
                    
                    // Evaluate the raw javascript code
                    let evaled = eval(text);
                    
                    // If the code returns a promise, await it
                    if (evaled instanceof Promise) evaled = await evaled;
                    
                    // Convert object outputs to readable strings
                    if (typeof evaled !== 'string') {
                        evaled = require('util').inspect(evaled, { depth: 0 });
                    }

                    // Format the output cleanly
                    const embed = new EmbedBuilder()
                        .setColor('#5865F2')
                        .setTitle('🌟 Starry System Terminal')
                        .addFields(
                            { name: '📥 Input', value: `\`\`\`js\n${text}\n\`\`\`` },
                            { name: '📤 Output', value: `\`\`\`js\n${evaled.substring(0, 1000)}\n\`\`\`` }
                        )
                        .setTimestamp();
                    
                    return message.reply({ embeds: [embed] });
                }

            } catch (err) {
                // If your code fails, Starry tells you what went wrong
                return message.reply(`❌ **System Malfunction:** \`${err.message}\``);
            }
        }
    });
};
              
