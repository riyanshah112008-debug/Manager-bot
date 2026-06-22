const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// The heartbeat to keep Render awake
const app = express();
app.get('/', (req, res) => res.send('Manager Bot is awake!'));
app.listen(process.env.PORT || 3000);

// Initialize the single connection
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates 
    ] 
});

// Load your 3 puzzle pieces
require('./vc.js')(client);
require('./automod.js')(client);
require('./premium.js')(client);

// Log in
client.once('ready', () => console.log(`Logged in as ${client.user.tag}`));
client.login(process.env.DISCORD_TOKEN);
  
