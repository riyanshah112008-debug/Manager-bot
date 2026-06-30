const { Groq } = require('groq-sdk');

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const aiCooldowns = new Set();

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // 1. Ignore other bots and empty messages
        if (message.author.bot || !message.content) return;

        // 2. Check for natural conversational triggers
        const text = message.content.toLowerCase();
        const mentionsBot = message.mentions.has(client.user.id);
        const containsName = text.includes('starry');
        
        // Check if the user is using Discord's "Reply" feature on the bot's message
        let isReplyToBot = false;
        if (message.reference) {
            try {
                const repliedMessage = await message.channel.messages.fetch(message.reference.messageId);
                if (repliedMessage.author.id === client.user.id) {
                    isReplyToBot = true;
                }
            } catch (err) {
                console.error("Could not fetch replied message:", err);
            }
        }

        // If NONE of the triggers are met, ignore the message
        if (!mentionsBot && !containsName && !isReplyToBot) return;
            
        // 3. Check Cooldown
        if (aiCooldowns.has(message.author.id)) {
            return message.reply('⏳ Give me a second to process that!');
        }

        // Clean the prompt (remove mentions and the bot's name so it doesn't get confused)
        let prompt = message.content.replace(`<@${client.user.id}>`, '');
        // Optionally remove the word "starry" from the prompt so it just reads the question
        prompt = prompt.replace(/starry/ig, '').trim();
        
        if (!prompt) {
            return message.reply("Hey there! Did you need me?");
        }

        // 4. Add user to cooldown for 5 seconds
        aiCooldowns.add(message.author.id);
        setTimeout(() => aiCooldowns.delete(message.author.id), 5000);

        await message.channel.sendTyping();

        try {
            // 5. Call the Groq API
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    { role: "system", content: "You are Starry, a helpful, friendly, and concise Discord bot. Talk like a normal person in a chat room." },
                    { role: "user", content: prompt }
                ],model: "llama3-8b-8192", 

            });

            const replyText = chatCompletion.choices[0]?.message?.content || "I'm drawing a blank right now.";

            if (replyText.length > 2000) {
                return message.reply(replyText.slice(0, 1995) + "...");
            }

            return message.reply(replyText);

        } catch (error) {
            console.error("Groq AI Error:", error.message);

            if (error.status === 429) {
                return message.reply('⏳ **Whoa, slow down!** Even I have limits. Please wait a minute and try again.');
            }

            return message.reply('❌ I am having trouble connecting to my AI brain right now.');
        }
    });
};
                   
