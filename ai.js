module.exports = (client) => {
    const PREFIX = '.';

    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;

        const args = message.content.trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (command === PREFIX + 'ai' || command === PREFIX + 'imagine') {
            const prompt = args.join(' ');

            if (!prompt) {
                return message.reply('❌ You need to give me a prompt! Example: `.ai hello`');
            }

            const waitMessage = await message.reply('🧠 Thinking...');

            try {
                // 🛑 THE KILL SWITCH: Force a timeout after 60 seconds
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);

                // Add the signal to the fetch request
                const response = await fetch(`https://froozen-1.onrender.com/chat?msg=${encodeURIComponent(prompt)}`, {
                    signal: controller.signal
                });
                
                // Clear the timeout if the API actually responds in time
                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`API returned status: ${response.status}`);
                }

                const data = await response.text();
                let replyText = data;

                try {
                    const json = JSON.parse(data);
                    replyText = json.reply || json.response || json.message || data;
                } catch (e) {
                    // Keep plain text if not JSON
                }

                // If the API sends back a completely empty response
                if (!replyText || replyText.trim() === '') {
                    throw new Error('API returned an empty response.');
                }

                if (replyText.length > 2000) {
                    replyText = replyText.substring(0, 1995) + '...';
                }

                await waitMessage.edit(replyText);
            } catch (error) {
                console.error('[AI Error]', error);
                
                let errorMessage = '❌ **Error:** The AI server is offline or returned bad data. Please try again later.';
                
                // If our 60-second kill switch was triggered
                if (error.name === 'AbortError') {
                    errorMessage = '❌ **API Timeout:** The `froozen-1` server took longer than 60 seconds to respond and the request was cancelled. The API is likely crashed or overloaded.';
                }

                await waitMessage.edit(errorMessage);
            }
        }
    });
};
