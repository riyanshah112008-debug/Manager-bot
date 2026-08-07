// ==========================================
// 🌐 STARRY SUPREME TRANSLATOR ENGINE
// File Path: ./modules/translator.js
// ==========================================

const { 
    EmbedBuilder, 
    SlashCommandBuilder, 
    ContextMenuCommandBuilder, 
    ApplicationCommandType, 
    ApplicationIntegrationType, 
    InteractionContextType, 
    ActionRowBuilder, 
    StringSelectMenuBuilder, 
    Events,
    MessageFlags 
} = require('discord.js');

const EPHEMERAL_FLAG = MessageFlags.Ephemeral || 6;

const languageMap = {
    'english': 'en', 'en': 'en', '🇺🇸': 'en', '🇬🇧': 'en',
    'spanish': 'es', 'es': 'es', '🇪🇸': 'es',
    'french': 'fr', 'fr': 'fr', '🇫🇷': 'fr',
    'german': 'de', 'de': 'de', '🇩🇪': 'de',
    'italian': 'it', 'it': 'it', '🇮🇹': 'it',
    'portuguese': 'pt', 'pt': 'pt', '🇧🇷': 'pt', '🇵🇹': 'pt',
    'russian': 'ru', 'ru': 'ru',The reason slash commands appear in **#💬-general** (like NEKOTINA’s `/translate`) but fail to suggest or register in **#👀-confessions** is usually due to channel-specific permissions or bot settings.

Here are the most common reasons and how to fix it:

### 1. Missing "Use Application Commands" Channel Permission
If members or bots lack the permission to use slash commands in `#👀-confessions`, Discord will not auto-complete `/` commands.
* **Fix:** Go to **Channel Settings** for `#👀-confessions` $\rightarrow$ **Permissions** $\rightarrow$ **Advanced Permissions** $\rightarrow$ Ensure **Use Application Commands** is set to **Allow** ($\checkmark$) for `@everyone` (or relevant roles) and the bot itself.

### 2. Bot Command Scope Restricted in Server Settings
Discord allows server admins to restrict specific bots or commands to specific channels.
* **Fix:** Go to **Server Settings** $\rightarrow$ **Integrations** $\rightarrow$ Select the Confession bot $\rightarrow$ Check **Command Permissions** to make sure the bot/commands are enabled in `#👀-confessions`.

### 3. Bot Missing Read/View Permissions
If the bot cannot view `#👀-confessions`, it cannot register its slash commands there.
* **Fix:** Ensure the bot has **View Channel** and **Send Messages** permissions enabled in `#👀-confessions`.

### 4. Discord Mobile App Cache/Sync Bug
The Discord mobile app frequently fails to load slash command menus in newly created or recently modified channels.
* **Fix:** Fully close and restart the Discord app, or switch to desktop/web Discord to run `/confessionsetup`.
