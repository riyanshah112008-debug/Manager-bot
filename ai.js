module.exports = (client) => {
    const PREFIX = '.';

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const args = message.content.trim().split(/ +/);
        const command = args.shift().toLowerCase();

        // Triggers for both .ai and .imagine
        if (command === PREFIX + 'ai' || command === PREFIX + 'imagine') {
            const prompt = args.join(' ');

            if (!prompt) {
                return message.reply('❌ You need to give me a prompt! Example: `.ai hello`');
            }

            // Buy time so the API can wake up without timing out!
            const waitMessage = await message.reply('🧠 Thinking... *(If the AI is asleep, this may take up to 50 seconds to wake up!)*');

            try {
                // Fetch from your specific API
                const response = await fetch(`https://froozen-1.onrender.com/chat?msg=${encodeURIComponent(prompt)}`);
                
                if (!response.ok) {
                    throw new Error(`API Error: ${response.status}`);
                }

                const data = await response.text();
                let replyText = data;

                // If the API returns JSON, parse it to find the actual message
                try {
                    const json = JSON.parse(data);
                    replyText = json.reply || json.response || json.message || data;
                } catch (e) {
                    // Keep plain text if it's not JSON
                }

                // Prevent Discord's 2000 character limit from crashing the bot
                if (replyText.length > 2000) {
                    replyText = replyText.substring(0, 1995) + '...';
                }

                await waitMessage.edit(replyText);
            } catch (error) {
                console.error('[AI Error]', error);
                await waitMessage.edit('❌ **Connection Timeout:** The AI server is currently booting up from sleep mode. Please try your command again in about 60 seconds!');
            }
        }
    });
};
