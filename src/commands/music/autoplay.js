const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggles automatic music playback (Premium Only)'),
        
    async execute(interaction, client) {
        // ==========================================
        // 💎 PREMIUM CHECK 
        // ==========================================
        // Paste your MongoDB premium check here. Example:
        // const isPremium = await PremiumModel.findOne({ guildId: interaction.guild.id });
        // if (!isPremium) return interaction.reply({ content: '❌ This command is restricted to Premium servers!', ephemeral: true });
        
        const player = client.manager.getPlayer(interaction.guild.id);
        
        if (!player) return interaction.reply({ content: 'Nothing is playing right now.', ephemeral: true });
        if (interaction.member.voice.channelId !== player.voiceId) return interaction.reply({ content: 'You are not in my voice channel!', ephemeral: true });

        // Toggle the autoplay state inside the Lavalink player data
        const autoplayState = player.data.get('autoplay') || false;
        player.data.set('autoplay', !autoplayState);

        return interaction.reply(`📻 Autoplay has been **${!autoplayState ? 'ENABLED' : 'DISABLED'}**.`);
    }
};
