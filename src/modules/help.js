// ==========================================
// 📖 FLAVI & STARRY HELP ENGINE MODULE
// File Path: src/modules/help.js
// Fixed Comma Prefix (,), 1-Year Interactive Category Select & Buttons
// ==========================================
const config = require('../config');
const { CommandContext } = require('../utils/contextHelper');
const utilityCommands = require('../commands/bundles/utilityCommands');

module.exports = (client) => {
    const helpCmd = utilityCommands.find(c => c.name === 'help');

    // Handle Prefix ',help'
    client.on('messageCreate', async (message) => {
        if (message.author.bot || !message.guild) return;
        const prefix = config.DEFAULT_PREFIX || ',';

        if (message.content.trim().toLowerCase() === `${prefix}help` || message.content.trim().toLowerCase() === `${prefix}commands`) {
            if (helpCmd) {
                const ctx = new CommandContext(message, client, []);
                await helpCmd.execute(ctx);
            }
        }
    });

    // Handle Slash Command '/help'
    client.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'ping') {
            const pingCmd = utilityCommands.find(c => c.name === 'ping');
            if (pingCmd) {
                const ctx = new CommandContext(interaction, client, []);
                return await pingCmd.execute(ctx);
            }
        }

        if (interaction.commandName === 'help') {
            if (helpCmd) {
                const ctx = new CommandContext(interaction, client, []);
                return await helpCmd.execute(ctx);
            }
        }
    });
};
