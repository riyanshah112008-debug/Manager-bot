// ==========================================
// 🛡️ STARRY & FLAVI BOT CONFIGURATION
// ==========================================

module.exports = {
    // Fixed comma prefix by default across the entire bot
    DEFAULT_PREFIX: ',',
    PREFIX: ',',

    // High interaction timing up to 1 year in milliseconds (365 days)
    // 365 * 24 * 60 * 60 * 1000 = 31,536,000,000 ms
    INTERACTION_TIMEOUT: 31536000000,
    ONE_YEAR_MS: 31536000000,

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
    CLUSTER_NAME: 'Starry-Flavi-Network'
};
