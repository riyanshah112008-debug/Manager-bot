const { EmbedBuilder } = require('discord.js');
const translate = require('google-translate-api-x');

// Map common typed language names to their API language codes
const languageMap = {
    'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
    'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja',
    'korean': 'ko', 'chinese': 'zh-cn', 'hindi': 'hi', 'arabic': 'ar',
    'dutch': 'nl', 'turkish': 'tr', 'polish': 'pl', 'ukrainian': 'uk'
};

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // 1. Ignore bot messages and DMs
        if (message.author.bot || !message.guild) return;

        const content = message.content.toLowerCase().trim();

        // 2. Listen specifically for the command
        if (content.startsWith('.translate')) {
            console.log(`[DEBUG] Received command from ${message.author.username}: ${message.content}`);
            
            // REQUIREMENT: The user MUST reply to a message
            if (!message.reference || !message.reference.messageId) {
                return message.reply('❌ **Usage:** You must **reply** to the specific message you want to translate and type `.translate <language>`.');
            }

            // Extract the requested language (e.g., "english")
            const args = content.split(/\s+/);
            const requestedLang = args[1];

            if (!requestedLang) {
                return message.reply('❌ **Error:** Please specify a language. Example: `.translate english`');
            }

            // Convert the typed name to a language code
            const targetCode = languageMap[requestedLang] || requestedLang;

            try {
                // 3. Fetch the EXACT message the user replied to
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

                if (!repliedMessage.content) {
                    return message.reply("❌ The message you replied to doesn't contain any text.");
                }

                console.log(`[DEBUG] Fetching translation for text: "${repliedMessage.content}"`);
                await message.channel.sendTyping();

                // 4. Translate the content of the replied message
                const result = await translate(repliedMessage.content, { to: targetCode });

                // 5. Build the embed showing the original author's name
                const embed = new EmbedBuilder()
                    .setColor('Green')
                    .setAuthor({ 
                        name: `${repliedMessage.author.username} said:`, 
                        iconURL: repliedMessage.author.displayAvatarURL({ dynamic: true }) 
                    })
                    .setDescription(result.text)
                    .setFooter({ text: `Translated to ${targetCode.toUpperCase()}` });

                // 6. Send the translation back to the chat!
                await message.reply({ embeds: [embed] });
                console.log(`[DEBUG] Translation sent successfully.`);

            } catch (error) {
                console.error('[ERROR] Translation failed:', error);
                
                if (error.message && error.message.includes('not supported')) {
                    return message.reply(`❌ **Error:** "${requestedLang}" is not a recognized language or code.`);
                }
                
                return message.reply('❌ **Error:** I could not translate that right now. The API might be rate-limiting.');
            }
        }
    });
};
                
