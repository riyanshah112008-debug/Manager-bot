const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
// Updated path: Both files are in the same folder
const { getConfig, saveConfig } = require('./logManager'); 

module.exports = {
    data: new SlashCommandBuilder()
        // ... (rest of the command remains exactly the same)
  
