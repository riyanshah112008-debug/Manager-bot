const { REST, Routes, SlashCommandBuilder } = require('discord.js');
require('dotenv').config();

// Pre-built command list based on Starry's modules
const commands = [
    new SlashCommandBuilder().setName('help').setDescription('View all bot commands.'),
    new SlashCommandBuilder().setName('truthordare').setDescription('Play Truth or Dare!'),
    new SlashCommandBuilder().setName('leveling').setDescription('Check your current server level.'),
    new SlashCommandBuilder().setName('whois').setDescription('Get information about a specific user.'),
    new SlashCommandBuilder().setName('warning').setDescription('Manage user warnings.'),
    new SlashCommandBuilder().setName('clear').setDescription('Clear a specific number of messages.'),
    new SlashCommandBuilder().setName('serverstats').setDescription('View current server statistics.'),
    new SlashCommandBuilder().setName('afk').setDescription('Set your AFK status.'),
    new SlashCommandBuilder().setName('welcome').setDescription('Configure the welcome system.'),
    new SlashCommandBuilder().setName('protection').setDescription('Manage server protection settings.'),
    new SlashCommandBuilder().setName('setgoodbye').setDescription('Set up the goodbye channel.')
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        
        // Make sure CLIENT_ID is added to your Render Environment Variables!
        const data = await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID), 
            { body: commands },
        );

        console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
