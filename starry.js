const { Groq } = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.content) return;
        if (!message.mentions.has(client.user.id)) return;

        await message.channel.sendTyping().catch(() => {});
        
        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [{ role: "user", content: message.content }],
                model: "llama-3.1-8b-instant"
            });
            return message.reply(chatCompletion.choices[0].message.content).catch(()=>{});
        } catch (error) {
            console.error(error);
            return message.reply("❌ API Error: " + error.message).catch(()=>{});
        }
    });
};
                          
