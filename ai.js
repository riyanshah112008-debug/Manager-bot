const { GoogleGenerativeAI } = require('@google/generative-ai');

module.exports = (client) => {
    const PREFIX = '.';
    
    // Initialize the Gemini API using the key from Render
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const args = message.content.trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === PREFIX + 'ai') {
            const prompt = args.join(' ');

            if (!prompt) {
                return message.reply('❌ You need to give me a prompt! Example: `.ai write a poem about space`');
            }

            const waitMessage = await message.reply('🧠 Gemini is thinking...');

            try {
                // Call the Gemini 1.5 Pro model
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                
                const result = await model.generateContent(prompt);
                const response = await result.response;
                let replyText = response.text();

                if (!replyText || replyText.trim() === '') {
                    throw new Error('API returned an empty response.');
                }

                // Prevent Discord's 2000 character limit from crashing the bot
                if (replyText.length > 2000) {
                    replyText = replyText.substring(0, 1995) + '...';
                }

                await waitMessage.edit(replyText);
            } catch (error) {
                console.error('[Gemini Error]', error);
                await waitMessage.edit('❌ **Error:** The Gemini API failed to generate a response. Please double-check that your GEMINI_API_KEY is correct in Render!');
            }
        }
    });
};
                
