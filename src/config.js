// ==========================================
// 🛡️ Starry BOT CONFIGURATION
// ==========================================

module.exports = {
    // Fixed comma prefix by default across the entire bot
    DEFAULT_PREFIX: ',',
    PREFIX: ',',

    // Maximum 32-bit signed integer supported by Node.js event loop (~24.8 days)
    INTERACTION_TIMEOUT: 2147483647,
    ONE_YEAR_MS: 2147483647,

    // Bot owner user IDs for unrestricted administrative access
    BOT_OWNERS: ['1465049039153135639', '1257676837249617971'],

    // Default Embed Colors
    EMBED_COLORS: {
        PRIMARY: '#5865F2',
        SUCCESS: '#2ECC71',
        WARNING: '#F1C40F',
        DANGER: '#ED4245',
        DARK: '#2B2D31',
        MUSIC: '#1DB954',
        SOCIAL: '#FF79C6',
        ECONOMY: '#F39C12'
    },

    // Multi-bot cluster metadata
    CLUSTER_NAME: 'Starry-Starry-Network'
};
