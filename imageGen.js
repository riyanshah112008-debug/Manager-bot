const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    const PREFIX = '.';

    // ==========================================
    // 1. REGISTER THE COMMAND
    // ==========================================
    client.on('ready', async () => {
        try {
            await client.application.commands.create({
                name: 'imagine',
                description: 'Generate an AI image based on your prompt',
                options: [{ name: 'prompt', description: 'What do you want to see?', type: 3, required: true }]
            });
            console.log('✅ Canvas Image Gen Module Loaded (1-Image Mode)');
        } catch (err) {}
    });

    // ==========================================
    // 2. HELPER TO GENERATE THE URL
    // ==========================================
    // Using Pollinations AI for instant, free, 1-image generation
    const generateImage = (prompt) => {
        const encodedPrompt = encodeURIComponent(prompt);
        // Added a random seed at the end so the same prompt generates a new image each time
        const randomSeed = Math.floor(Math.random() * 100000);
        return `https://pollinations.ai/p/${encodedPrompt}?width=1024&height=1024&nologo=true&seed=${randomSeed}`;
    };

    // ==========================================
    // 3. SLASH COMMAND (/imagine)
    // ==========================================
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand() || interaction.commandName !== 'imagine') return;
        
        const prompt = interaction.options.getString('prompt');
        
        // Defer the reply so Discord knows the bot is "thinking"
        await interaction.deferReply(); 

        const imageUrl = generateImage(prompt);
        
        const embed = new EmbedBuilder()
            .setColor('Purple')
            .setTitle(`🎨 ${prompt}`)
            .setImage(imageUrl)
            .setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [embed] }).catch(() => {});
    });

    // ==========================================
    // 4. PREFIX COMMAND (.imagine)
    // ==========================================
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        
        if (message.content.toLowerCase().startsWith(PREFIX + 'imagine')) {
            const prompt = message.content.slice(PREFIX.length + 8).trim();
            if (!prompt) return message.reply('🔹 **Usage:** `.imagine <prompt>`').catch(() => {});

            const loadingMsg = await message.reply('⏳ **Painting your image...**').catch(() => null);
            if (!loadingMsg) return;
            
            const imageUrl = generateImage(prompt);
            
            const embed = new EmbedBuilder()
                .setColor('Purple')
                .setTitle(`🎨 ${prompt}`)
                .setImage(imageUrl)
                .setFooter({ text: `Requested by ${message.author.username}`, iconURL: message.author.displayAvatarURL() });

            await loadingMsg.edit({ content: null, embeds: [embed] }).catch(() => {});
        }
    });
};
