const { EmbedBuilder } = require('discord.js');
const { translate } = require('@vitalets/google-translate-api');

// ==========================================
// FLAG TO LANGUAGE MAP
// ==========================================
const flagMap = {
    // English
    '🇺🇸': 'en', '🇬🇧': 'en', '🇨🇦': 'en', '🇦🇺': 'en',
    // Spanish
    '🇪🇸': 'es', '🇲🇽': 'es', '🇦🇷': 'es', '🇨🇴': 'es', '🇨🇱': 'es',
    // French
    '🇫🇷': 'fr', '🇨🇵': 'fr', '🇧🇪': 'fr',
    // Portuguese
    '🇧🇷': 'pt', '🇵🇹': 'pt',
    // Asian Languages
    '🇯🇵': 'ja', // Japanese
    '🇰🇷': 'ko', // Korean
    '🇨🇳': 'zh-cn', '🇹🇼': 'zh-tw', // Chinese
    '🇮🇳': 'hi', // Hindi
    // European Languages
    '🇩🇪': 'de', // German
    '🇮🇹': 'it', // Italian
    '🇷🇺': 'ru', // Russian
    '🇳🇱': 'nl', // Dutch
    '🇸🇪': 'sv', // Swedish
    '🇹🇷': 'tr', // Turkish
    '🇵🇱': 'pl', // Polish
    '🇺🇦': 'uk', // Ukrainian
    // Arabic
    '🇸🇦': 'ar', '🇦🇪': 'ar', '🇪🇬': 'ar'
};

module.exports = (client) => {
  client.on('messageReactionAdd', async (reaction, user) => {
    // 1. Ignore bot reactions
    if (user.bot) return;

    // 2. Resolve partials (for messages sent before the bot started)
    try {
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();
    } catch (error) {
      console.error('Error fetching partial message/reaction:', error);
      return;
    }

    const message = reaction.message;

    //
                                         
