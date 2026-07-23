const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggles automatic music playback'),
        
    async execute(interaction, client) {
        const player = client.manager.getPlayer(interaction.guild.id);
        
        if (!player) return interaction.reply({ content: 'Nothing is playing right now. Play a song first!', ephemeral: true });
        if (interaction.member.voice.channelId !== player.voiceId) return interaction.reply({ content: 'You are not in my voice channel!', ephemeral: true });

        // Check current autoplay status and flip it
        const autoplayState = player.data.get('autoplay') || false;
        player.data.set('autoplay', !autoplayState);

        return interaction.reply(`📻 Autoplay has been **${!autoplayState ? 'ENABLED' : 'DISABLED'}**.`);
    }
};
