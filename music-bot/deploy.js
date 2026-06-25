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

// Uses MUSIC_TOKEN for the API connection
const rest = new REST({ version: '10' }).setToken(process.env.MUSIC_TOKEN);

(async () => {
    try {
        console.log('🔄 Registering commands for Music Bot...');
        await rest.put(
            // Uses MUSIC_CLIENT_ID for the specific bot application
            Routes.applicationCommands(process.env.MUSIC_CLIENT_ID),
            { body: commands }
        );
        console.log('✅ /play command registered successfully!');
    } catch (error) {
        console.error(error);
    }
})();
