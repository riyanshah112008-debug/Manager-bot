const { Groq } = require('groq-sdk');

// Initialize Groq with your API key from the .env file
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Create a simple cooldown tracker to prevent spam
const aiCooldowns = new Set();

module.exports = (client) => {
    // Listen for any new messages
    client.on('messageCreate', async (message) => {
        // Ignore other bots to prevent infinite loops
        if (message.author.bot || !message.content) return;

        // Trigger the AI ONLY when the bot is @mentioned
        if (message.mentions.has(client.user.id)) {
            
            // 1. Check Cooldown
            if (aiCooldowns.has(message.author.id)) {
                return message.reply('⏳ Please wait 5 seconds before asking me another question!');
            }

            // Clean the prompt (remove the bot mention from the text)
            const prompt = message.content.replace(`<@${client.user.id}>`, '').trim();
            
            if (!prompt) {
                return message.reply("Hi there! What can I help you with today?");
            }

            // 2. Add user to cooldown for 5 seconds
            aiCooldowns.add(message.author.id);
            setTimeout(() => aiCooldowns.delete(message.author.id), 5000);

            // Send a typing indicator so the user knows Starry is thinking
            await message.channel.sendTyping();

            try {
                // 3. Call the Groq API
                const chatCompletion = await groq.chat.completions.create({
                    messages: [
                        // The system prompt tells the bot how to act
                        { role: "system", content: "You are Starry, a helpful, friendly, and concise Discord bot." },
                        { role: "user", content: prompt }
                    ],
                    // Llama 3 8B is blazing fast and has massive free rate limits
                    model: "llama3-8b-8192", 
                });

                const replyText = chatCompletion.choices[0]?.message?.content || "I couldn't think of anything to say.";

                // Discord limits messages to 2000 characters. Slice it if it's too long.
                if (replyText.length > 2000) {
                    return message.reply(replyText.slice(0, 1995) + "...");
                }

                // Send the final response
                return message.reply(replyText);

            } catch (error) {
                console.error("Groq AI Error:", error.message);

                // Clean Error Handling (No ugly logs for users!)
                if (error.status === 429) {
                    return message.reply('⏳ **Whoa, slow down!** Even I have limits. Please wait a minute and try again.');
                }

                return message.reply('❌ **System Malfunction:** I am having trouble connecting to my AI brain right now.');
            }
        }
    });
};
                // Initialize the AI with a conversational memory bank
                const systemInstruction = "You are Starry, a highly advanced and loyal Discord AI assistant. You were created by Riyan. Act as his personal digital butler. Keep responses conversational, natural, and directly address him.";
                const model = genAI.getGenerativeModel({ 
                    model: "gemini-2.5-flash", 
                    systemInstruction: systemInstruction 
                });
                
                chatSession = model.startChat({ history: [] });
                return message.reply('🌟 I am online and listening to your every word.');
            }

            if (content.toLowerCase() === 'go to sleep' || content.toLowerCase() === 'sleep') {
                isAwake = false;
                return message.reply('🌙 Shutting down conversational matrix. Standing by.');
            }

            // ==========================================
            // 🧠 3. CONTINUOUS CONVERSATION
            // ==========================================
            // If Starry is awake, she treats EVERY message you send as a conversation
            if (isAwake) {
                await message.channel.sendTyping();
                
                // Send the message to the active chat session (so she remembers context)
                const result = await chatSession.sendMessage(content);
                let replyText = await result.response.text();
                
                if (replyText.length > 2000) replyText = replyText.substring(0, 1995) + '...';
                
                return message.reply(replyText);
            }

        } catch (err) {
            console.error('[Starry AI/Dev Error]', err);
            return message.reply(`❌ **System Malfunction:** \`${err.message}\``);
        }
    });
};
        
