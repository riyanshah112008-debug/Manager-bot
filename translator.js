const { EmbedBuilder } = require('discord.js');
const { translate } = require('@vitalets/google-translate-api');

// Map common typed language names to their API language codes
const languageMap = {
    'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
    'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja',
    'korean': 'ko', 'chinese': 'zh-cn', 'hindi': 'hi', 'arabic': 'ar',
    'dutch': 'nl', 'turkish': 'tr', 'polish': 'pl', 'ukrainian': 'uk',
    'vietnamese': 'vi', 'thai': 'th', 'indonesian': 'id', 'greek': 'el',
    'swedish': 'sv', 'danish': 'da', 'finnish': 'fi', 'norwegian': 'no',
    'czech': 'cs', 'romanian': 'ro', 'hungarian': 'hu', 'hebrew': 'he'
};

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignore bot messages and DMs
        if (message.author.bot || !message.guild) return;

        const content = message.content.toLowerCase();

        // Check if the message starts with the command
        if (content.startsWith('.translate')) {
            
            // 1. Check if the user is actually replying to a message
            if (!message.reference) {
                return message.reply('❌ **Usage:** You must reply to the message you want to translate and type `.translate <language>`.');
            }

            // 2. Extract the requested language from the command
            const args = content.split(/\s+/);
            const requestedLang = args[1];

            if (!requestedLang) {
                return message.reply('❌ **Error:** Please specify a language. Example: `.translate english` or `.translate es`');
            }

            // 3. Convert the typed name to a language code (or use what they typed if it's already a code)
            const targetCode = languageMap[requestedLang] || requestedLang;

            try {
                // 4. Fetch the original message that the user replied to
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);

                if (!repliedMessage.content) {
                    return message.reply("❌ That message doesn't contain any text to translate.");
                }

                // Let the user know the bot is working (translation can take a second)
                await message.channel.sendTyping();

                // 5. Run the translation API
                const result = await translate(repliedMessage.content, { to: targetCode });

                // 6. Build a beautiful embed for the output
                const embed = new EmbedBuilder()
                    .setColor('Blue')
                    .setAuthor({ 
                        name: `${repliedMessage.author.username} said:`, 
                        iconURL: repliedMessage.author.displayAvatarURL({ dynamic: true }) 
                    })
                    .setDescription(result.text)
                    .setFooter({ text: `Translated from ${result.raw.src.toUpperCase()} to ${targetCode.toUpperCase()}` });

                // 7. Send the translation!
                await message.reply({ embeds: [embed] });

            } catch (error) {
                console.error('Translation Command Error:', error.message);
                
                // If the error is about a bad language code, give a specific warning
                if (error.message.includes('not supported')) {
                    return message.reply(`❌ **Error:** "${requestedLang}" is not a recognized language or code.`);
                }
                
                return message.reply('❌ **Error:** I could not translate that message right now. The API might be rate-limiting.');
            }
        }
    });
};
            
