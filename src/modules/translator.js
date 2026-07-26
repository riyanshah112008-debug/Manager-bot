const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');

const languageMap = {
    'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
    'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja',
    'korean': 'ko', 'chinese': 'zh-cn', 'hindi': 'hi', 'arabic': 'ar',
    'dutch': 'nl', 'turkish': 'tr', 'polish': 'pl', 'ukrainian': 'uk',
    'vietnamese': 'vi', 'thai': 'th', 'indonesian': 'id', 'tagalog': 'tl'
};

// ==========================================
// 🚀 NATIVE TRANSLATION ENGINE (Zero Dependency)
// ==========================================
async function translateText(text, targetLangCode) {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Translation API rejected the request.');
    
    const data = await response.json();
    const translatedText = data[0].map(item => item[0]).join('');
    const sourceLang = data[2]; // Auto-detected original language

    return { translatedText, sourceLang };
}

module.exports = (client, app) => {
    const PREFIX = '.';

    // ==========================================
    // 1. EXPRESS WEB API (Premium Locked)
    // ==========================================
    if (app) {
        app.get('/api/translate', async (req, res) => {
            const text = req.query.text;
            const requestedLang = req.query.to || 'en';
            const guildId = req.query.guildId; 

            if (!guildId || (typeof client.isPremium === 'function' && !client.isPremium(guildId))) {
                return res.status(403).json({ error: 'Premium required' });
            }
            if (!text) return res.status(400).json({ error: 'No text provided' });

            const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();
            try {
                const result = await translateText(text, targetCode);
                res.json({ success: true, translatedText: result.translatedText, sourceLang: result.sourceLang });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    // ==========================================
    // 2. DYNAMIC SLASH COMMAND INJECTION
    // ==========================================
    // We inject this directly into client.commands so index.js finds it perfectly!
    client.commands.set('translate', {
        data: new SlashCommandBuilder()
            .setName('translate')
            .setDescription('🌐 Translate text from any language (Premium)')
            .setContexts([0, 1, 2])
            .setIntegrationTypes([0, 1])
            .addStringOption(option => 
                option.setName('language')
                    .setDescription('Target language (e.g., english, es, ja)')
                    .setRequired(true)
            )
            .addStringOption(option => 
                option.setName('text')
                    .setDescription('The text to translate')
                    .setRequired(true)
            ),

        async execute(interaction) {
            // 🔒 PREMIUM LOCK
            if (typeof client.isPremium === 'function' && !client.isPremium(interaction.guildId)) {
                return interaction.reply({ content: '❌ **Translator is a Premium feature!** Use `/premium` to upgrade.', ephemeral: true });
            }

            await interaction.deferReply();
            const requestedLang = interaction.options.getString('language');
            const text = interaction.options.getString('text');
            const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();

            try {
                const result = await translateText(text, targetCode);
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🌐 Starry Translator')
                    .addFields(
                        { name: `Original (${result.sourceLang})`, value: `\`\`\`\n${text}\n\`\`\``, inline: false },
                        { name: `Translated (${targetCode})`, value: `\`\`\`\n${result.translatedText}\n\`\`\``, inline: false }
                    )
                    .setFooter({ text: 'Powered by Google Neural Machine Translation' });

                await interaction.editReply({ embeds: [embed] });
            } catch (error) {
                await interaction.editReply(`❌ Translation Failed: \`Invalid language code or API timeout.\``);
            }
        }
    });

    // ==========================================
    // 3. PREFIX COMMAND (.translate)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (!message.content.toLowerCase().startsWith(PREFIX + 'translate')) return;

        // 🔒 PREMIUM LOCK
        if (typeof client.isPremium === 'function' && !client.isPremium(message.guild.id)) {
            return message.reply('❌ **Translator is a Premium feature!** Use `.premium` to upgrade.').catch(() => {});
        }

        const args = message.content.slice(PREFIX.length + 9).trim().split(/ +/);
        const requestedLang = args.shift(); 
        let text = args.join(' '); 

        if (!requestedLang) return message.reply('🔹 **Usage:** `.translate <language> <text>`\n*Tip: You can also reply to a message and type `.translate en`*');
        
        // Auto-fetch text if replying to a message
        if (!text && message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            text = repliedMessage?.content;
        }

        if (!text) return message.reply('❌ Please provide text to translate or reply to a message.');

        const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();
        const waitMessage = await message.reply('🔄 Translating text...');

        try {
            const result = await translateText(text, targetCode);
            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('🌐 Starry Translator')
                .addFields(
                    { name: `Original (${result.sourceLang})`, value: `\`\`\`\n${text.substring(0, 1000)}\n\`\`\``, inline: false },
                    { name: `Translated (${targetCode})`, value: `\`\`\`\n${result.translatedText.substring(0, 1000)}\n\`\`\``, inline: false }
                );
            await waitMessage.edit({ content: null, embeds: [embed] });
        } catch (error) {
            await waitMessage.edit(`❌ Translation Failed: \`Invalid language code or API timeout.\``);
        }
    });
};
