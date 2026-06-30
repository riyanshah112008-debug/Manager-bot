const { Events, EmbedBuilder } = require('discord.js');
// Updated path: Both files are in the same folder
const { getConfig } = require('./logManager');

module.exports = {
    name: Events.MessageDelete,
    async execute(message) {
        // ... (rest of the event remains exactly the same)
  
