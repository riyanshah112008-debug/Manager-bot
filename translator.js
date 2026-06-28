const translate = require('google-translate-api-x');
const { EmbedBuilder, REST, Routes } = require('discord.js');

const languageMap = {
    'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
    'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja',
    'korean': 'ko', 'chinese': 'zh-cn', 'hindi': 'hi', 'arabic': 'ar',
    'dutch': 'nl', 'turkish': 'tr', 'polish': 'pl', 'ukrainian': 'uk'
};

module.exports = (client, app) => {
    const PREFIX = '.';

    // ==========================================
    // 1. EXPRESS WEB API (For external bots)
    // ==========================================
    if (app) {
        app.get('/api/translate', async (req, res) => {
            const text = req.query.text;
            const requestedLang = req.query.to || 'en';
            if (!text) return res.status(400).json({ error: 'No text provided' });
            
            const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();
            try {
                const result = await translate(text, { to: targetCode });
                res.json({ success: true, translatedText: result.text, sourceLanguage: result.raw.src });
            } catch (error) {
                res.status(500).json({ error: 'Google API rate limit or error' });
            }
        });
    }

    // ==========================================
    // 2. DISCORD SLASH COMMAND SYNC (Updated to clientReady)
    // ==========================================
    client.on('clientReady', async () => {
        const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
        try {
            await rest.put(
                Routes.applicationCommands(client.user.id),
                { body: [{
                    name: 'translate',
                    description: 'Translate text to another language',
                    options: [
                        { name: 'language', description: 'Language to translate to (e.g., german)', type: 3, required: true },
                        { name: 'text', description: 'The text to translate', type: 3, required: true }
                    ]
                }] },
            );
            console.log('✅ Translator Slash Commands Synced');
        } catch (error) {
            console.error('❌ Failed to sync translator slash commands:', error);
        }
    });

    // ==========================================
    // 3. DISCORD PREFIX COMMAND (.translate)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        // Clean up the input and split by spaces
        const args = message.content.trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === PREFIX + 'translate') {
            console.log(`[Translator Context] Executing command from ${message.author.username}`);

            const requestedLang = args.shift(); 
            let text = args.join(' '); 

            // If they didn't even provide a language
            if (!requestedLang) {
                return message.reply('❌ **Usage:** `.translate <language> <text>`\n💡 *Tip: You can also reply to someone else\'s message with* `.translate <language>`');
            }

            // If no text was typed, check if they replied to a message
            if (!text && message.reference) {
                try {
                    const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                    text = repliedMessage.content;
                } catch (err) {
                    return message.reply('❌ I could not read the message you replied to.');
                }
            }

            // If there is STILL no text (none typed and not a reply)
            if (!text) {
                return message.reply('❌ You forgot to tell me what to translate! Either type text after the language or reply to a message.');
            }

            const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();
            const waitMessage = await message.reply('🔄 Translating...');

            try {
                const result = await translate(text, { to: targetCode });
                
                const embed = new EmbedBuilder()
                    .setColor('#7289DA')
                    .setTitle('🌐 Translation')
                    .addFields(
                        { name: `To ${requestedLang.charAt(0).toUpperCase() + requestedLang.slice(1)}`, value: result.text },
                        { name: 'Original', value: text.length > 1024 ? text.substring(0, 1020) + '...' : text }
                    )
                    .setFooter({ text: 'Powered by Google Translate' });

                await waitMessage.edit({ content: null, embeds: [embed] });
            } catch (error) {
                console.error('[Translator Error]', error);
                await waitMessage.edit('❌ Failed to translate. Please ensure the language name is correct.');
            }
        }
    });

    // ==========================================
    // 4. DISCORD SLASH COMMAND (/translate)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;
        if (interaction.commandName !== 'translate') return;

        const requestedLang = interaction.options.getString('language');
        const text = interaction.options.getString('text');
        const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();

        await interaction.deferReply();

        try {
            const result = await translate(text, { to: targetCode });
            
            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle('🌐 Translation')
                .addFields(
                    { name: `To ${requestedLang.charAt(0).toUpperCase() + requestedLang.slice(1)}`, value: result.text },
                    { name: 'Original', value: text }
                )
                .setFooter({ text: 'Powered by Google Translate' });

            await interaction.followUp({ embeds: [embed] });
        } catch (error) {
            console.error('[Translator Slash Error]', error);
            await interaction.followUp('❌ Failed to translate. Please ensure the language name is correct.');
        }
    });
};
    
