const { EmbedBuilder } = require('discord.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// 👑 THE MASTER LOCK
const OWNER_ID = '1465049039153135639'; 

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Memory Variables
let isAwake = false; // Starry starts asleep so she doesn't spam your server
let chatSession = null; 

module.exports = (client) => {
    client.on('messageCreate', async (message) => {
        // Ignore other bots and DMs
        if (message.author.bot || !message.guild) return;

        // 🛑 THE ULTIMATE GUARD: If the message isn't from you, stop immediately
        if (message.author.id !== OWNER_ID) return;

        const content = message.content.trim();

        // Ignore standard prefix commands (so she doesn't reply when you type .help)
        if (content.startsWith('.') || content.startsWith('/')) return;

        const args = content.split(/ +/);
        const command = args.shift()?.toLowerCase();
        const text = args.join(' ');

        try {
            // ==========================================
            // 💻 1. TERMINAL OVERRIDES (Always Active)
            // ==========================================
            // You can use these whether Starry is awake or asleep
            if (command === 'say') {
                await message.delete();
                return message.channel.send(text);
            }
            if (command === 'setstatus') {
                client.user.setActivity(text);
                return message.reply(`✅ System activity updated to: **${text}**`);
            }
            if (command === 'eval') {
                if (!text) return message.reply('❌ Awaiting instructions.');
                let evaled = eval(text);
                if (evaled instanceof Promise) evaled = await evaled;
                if (typeof evaled !== 'string') evaled = require('util').inspect(evaled, { depth: 0 });

                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('🌟 Starry System Terminal')
                    .addFields(
                        { name: '📥 Input', value: `\`\`\`js\n${text}\n\`\`\`` },
                        { name: '📤 Output', value: `\`\`\`js\n${evaled.substring(0, 1000)}\n\`\`\`` }
                    )
                    .setTimestamp();
                return message.reply({ embeds: [embed] });
            }

            // ==========================================
            // 🎙️ 2. VOICE ACTIVATION CONTROLS
            // ==========================================
            if (content.toLowerCase() === 'wake up') {
                isAwake = true;
                
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
        
