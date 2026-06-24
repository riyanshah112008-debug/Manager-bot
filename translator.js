const translate = require('google-translate-api-x');

// Map common typed language names to their API language codes
const languageMap = {
    'english': 'en', 'spanish': 'es', 'french': 'fr', 'german': 'de',
    'italian': 'it', 'portuguese': 'pt', 'russian': 'ru', 'japanese': 'ja',
    'korean': 'ko', 'chinese': 'zh-cn', 'hindi': 'hi', 'arabic': 'ar',
    'dutch': 'nl', 'turkish': 'tr', 'polish': 'pl', 'ukrainian': 'uk'
};

module.exports = (app) => {
    // This creates a web endpoint your BDFD bot can talk to
    app.get('/api/translate', async (req, res) => {
        const text = req.query.text;
        const requestedLang = req.query.to || 'en';

        // 1. Check if the BDFD bot actually sent text
        if (!text) {
            return res.status(400).json({ error: 'No text provided' });
        }

        const targetCode = languageMap[requestedLang.toLowerCase()] || requestedLang.toLowerCase();

        try {
            // 2. Translate the text
            const result = await translate(text, { to: targetCode });

            // 3. Send the successful translation back to BDFD as JSON
            res.json({
                success: true,
                translatedText: result.text,
                sourceLanguage: result.raw.src
            });

        } catch (error) {
            console.error('[API Error] Translation failed:', error);
            res.status(500).json({ error: 'Google API rate limit or error' });
        }
    });
};
