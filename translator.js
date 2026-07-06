const translate = require('google-translate-api-x');
const { EmbedBuilder } = require('discord.js');

const languageMap = {
    'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
    'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja',
    'korean': 'ko', 'chinese': 'zh-cn', 'hindi': 'hi', 'arabic': 'ar',
    'dutch': 'nl', 'turkish': 'tr', 'polish': 'pl', 'ukrainian': 'uk'
};

module.exports = (client, app) => {
    const PREFIX = '.';

    // ==========================================
    // 1. EXPRESS WEB API (Premium Locked)
    // ==========================================
    if (app) {
        app.get('/api/translate', async (req, res) => {
            const text = req.query.text;
            const requestedLang = req.query.to || 'en';
            const guildId = req.query.guildId; // Expecting guildId in request

            if (!guildId || !client.isPremium(guildId)) {
                return res.status(403).json({ error: 'Premium required' });
            }
            
            if (!text) return res.status(400).json({ error: 'No text provided' });
            
            const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();
            try {
                const result = await translate(text, { to: targetCode, client: 'gtx' });
                res.json({ success: true, translatedText: result.text });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    // ==========================================
    // 2. DISCORD COMMANDS
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        if (!message.content.startsWith(PREFIX + 'translate')) return;

        // 🔒 PREMIUM LOCK
        if (!client.isPremium(message.guild.id)) {
            return message.reply('❌ **Translator is a Premium feature!** Use `.premium` to upgrade.').catch(() => {});
        }

        const args = message.content.slice(PREFIX.length + 9).trim().split(/ +/);
        const requestedLang = args.shift(); 
        let text = args.join(' '); 

        if (!requestedLang) return message.reply('🔹 **Usage:** `.translate <language> <text>`');
        if (!text && message.reference) {
            const repliedMessage = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
            text = repliedMessage?.content;
        }

        if (!text) return message.reply('❌ Please provide text to translate.');

        const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();
        const waitMessage = await message.reply('🔄 Translating...');

        try {
            const result = await translate(text, { to: targetCode, client: 'gtx' });
            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle('🌐 Translation')
                .addFields(
                    { name: `To ${requestedLang}`, value: result.text },
                    { name: 'Original', value: text.substring(0, 1000) }
                );
            await waitMessage.edit({ content: null, embeds: [embed] });
        } catch (error) {
            await waitMessage.edit(`❌ Translation Failed: \`${error.message}\``);
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'translate') return;

        // 🔒 PREMIUM LOCK
        if (!client.isPremium(interaction.guild.id)) {
            return interaction.reply({ content: '❌ **Translator is a Premium feature!** Use `.premium` to upgrade.', ephemeral: true });
        }

        const requestedLang = interaction.options.getString('language');
        const text = interaction.options.getString('text');
        const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();

        await interaction.deferReply();

        try {
            const result = await translate(text, { to: targetCode, client: 'gtx' });
            const embed = new EmbedBuilder()
                .setColor('#7289DA')
                .setTitle('🌐 Translation')
                .addFields(
                    { name: `To ${requestedLang}`, value: result.text },
                    { name: 'Original', value: text }
                );
            await interaction.followUp({ embeds: [embed] });
        } catch (error) {
            await interaction.followUp(`❌ Translation Failed: \`${error.message}\``);
        }
    });
};
            
