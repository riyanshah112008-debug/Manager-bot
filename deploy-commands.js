// ==========================================
// 🧹 TEST GUILD CACHE PURGE SCRIPT
// ==========================================
require('dotenv').config();
const { REST, Routes } = require('discord.js');

async function purgeGuildCache() {
    const token = process.env.DISCORD_TOKEN || process.env.BOT_TOKEN || process.env.TOKEN;
    let clientId = process.env.CLIENT_ID || process.env.APPLICATION_ID;
    const TEST_GUILD_ID = "1465243680754634939";

    if (!token) throw new Error('🛑 CRITICAL: Token missing.');
    if (!clientId) clientId = Buffer.from(token.split('.')[0], 'base64').toString('utf-8');

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log(`🧹 Wiping all application commands from test guild ${TEST_GUILD_ID}...`);
        
        // Sending an empty array [] completely wipes the guild command override table
        const result = await rest.put(Routes.applicationGuildCommands(clientId, TEST_GUILD_ID), { body: [] });
        
        console.log(`✅ Success! Test guild command cache has been completely cleared.`);
    } catch (error) {
        console.error('❌ Failed to wipe guild cache:', error);
    }
}

purgeGuildCache();
