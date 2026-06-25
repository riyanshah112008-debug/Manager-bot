require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
    new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song in your voice channel')
        .addStringOption(option => 
            option.setName('song')
                .setDescription('Name or URL of the song')
                .setRequired(true)
        )
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
    try {
        console.log('🔄 Registering /play command for Manager Bot...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('✅ /play command registered successfully!');
    } catch (error) {
        console.error(error);
    }
})();
