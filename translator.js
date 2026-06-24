const { EmbedBuilder } = require('discord.js');
const { translate } = require('@vitalets/google-translate-api');

// ==========================================
// FULL GLOBAL FLAG TO LANGUAGE MAP (~197 COUNTRIES)
// ==========================================
const flagMap = {
    // 🌎 North & Central America
    '🇨🇦': 'en', '🇺🇸': 'en', '🇲🇽': 'es', '🇬🇹': 'es', '🇧🇿': 'en', 
    '🇸🇻': 'es', '🇭🇳': 'es', '🇳🇮': 'es', '🇨🇷': 'es', '🇵🇦': 'es',

    // 🏝️ Caribbean
    '🇨🇺': 'es', '🇯🇲': 'en', '🇭🇹': 'ht', '🇩🇴': 'es', '🇵🇷': 'es', 
    '🇧🇸': 'en', '🇹🇹': 'en', '🇧🇧': 'en', '🇱🇨': 'en', '🇻🇨': 'en', 
    '🇬🇩': 'en', '🇦🇬': 'en', '🇩🇲': 'en', '🇰🇳': 'en',

    // 🌎 South America
    '🇨🇴': 'es', '🇻🇪': 'es', '🇬🇾': 'en', '🇸🇷': 'nl', '🇪🇨': 'es', 
    '🇵🇪': 'es', '🇧🇷': 'pt', '🇧🇴': 'es', '🇵🇾': 'es', '🇨🇱': 'es', 
    '🇦🇷': 'es', '🇺🇾': 'es',

    // 🌍 Europe (West & North)
    '🇬🇧': 'en', '🇮🇪': 'en', '🇮🇸': 'is', '🇳🇴': 'no', '🇸🇪': 'sv', 
    '🇫🇮': 'fi', '🇩🇰': 'da', '🇳🇱': 'nl', '🇧🇪': 'fr', '🇱🇺': 'lb', 
    '🇩🇪': 'de', '🇫🇷': 'fr', '🇨🇭': 'de', '🇦🇹': 'de', '🇮🇹': 'it', 
    '🇪🇸': 'es', '🇵🇹': 'pt', '🇦🇩': 'ca', '🇲🇨': 'fr', '🇱🇮': 'de', 
    '🇸🇲': 'it', '🇻🇦': 'it', '🇲🇹': 'mt',

    // 🌍 Europe (East & South)
    '🇬🇷': 'el', '🇨🇾': 'el', '🇹🇷': 'tr', '🇧🇬': 'bg', '🇷🇴': 'ro', 
    '🇲🇩': 'ro', '🇷🇸': 'sr', '🇲🇪': 'sr', '🇽🇰': 'sq', '🇦🇱': 'sq', 
    '🇲🇰': 'mk', '🇧🇦': 'bs', '🇭🇷': 'hr', '🇸🇮': 'sl', '🇭🇺': 'hu', 
    '🇸🇰': 'sk', '🇨🇿': 'cs', '🇵🇱': 'pl', '🇱🇹': 'lt', '🇱🇻': 'lv', 
    '🇪🇪': 'et', '🇧🇾': 'be', '🇺🇦': 'uk', '🇷🇺': 'ru',

    // 🌏 Middle East & Caucasus
    '🇬🇪': 'ka', '🇦🇲': 'hy', '🇦🇿': 'az', '🇸🇾': 'ar', '🇱🇧': 'ar', 
    '🇮🇱': 'he', '🇵🇸': 'ar', '🇯🇴': 'ar', '🇮🇶': 'ar', '🇰🇼': 'ar', 
    '🇸🇦': 'ar', '🇧🇭': 'ar', '🇶🇦': 'ar', '🇦🇪': 'ar', '🇴🇲': 'ar', 
    '🇾🇪': 'ar', '🇮🇷': 'fa',

    // 🌏 Central & South Asia
    '🇰🇿': 'kk', '🇺🇿': 'uz', '🇹🇲': 'tk', '🇰🇬': 'ky', '🇹🇯': 'tg', 
    '🇦🇫': 'ps', '🇵🇰': 'ur', '🇮🇳': 'hi', '🇳🇵': 'ne', '🇧🇹': 'dz', 
    '🇧🇩': 'bn', '🇱🇰': 'si', '🇲🇻': 'dv',

    // 🌏 East & Southeast Asia
    '🇨🇳': 'zh-cn', '🇹🇼': 'zh-tw', '🇭🇰': 'zh-tw', '🇲🇴': 'zh-tw', 
    '🇰🇵': 'ko', '🇰🇷': 'ko', '🇯🇵': 'ja', '🇲🇳': 'mn', '🇲🇲': 'my', 
    '🇹🇭': 'th', '🇱🇦': 'lo', '🇻🇳': 'vi', '🇰🇭': 'km', '🇲🇾': 'ms', 
    '🇸🇬': 'en', '🇮🇩': 'id', '🇧🇳': 'ms', '🇵🇭': 'tl', '🇹🇱': 'pt',

    // 🌊 Oceania
    '🇦🇺': 'en', '🇳🇿': 'en', '🇵🇬': 'en', '🇸🇧': 'en', '🇻🇺': 'en', 
    '🇫🇯': 'en', '🇼🇸': 'sm', '🇹🇴': 'en', '🇹🇻': 'en', '🇰🇮': 'en', 
    '🇲🇭': 'en', '🇫🇲': 'en', '🇵🇼': 'en', '🇳🇷': 'en',

    // 🌍 Africa (North & West)
    '🇪🇬': 'ar', '🇱🇾': 'ar', '🇹🇳': 'ar', '🇩🇿': 'ar', '🇲🇦': 'ar', 
    '🇲🇷': 'ar', '🇲🇱': 'fr', '🇳🇪': 'fr', '🇹🇩': 'fr', '🇸🇳': 'fr', 
    '🇬🇲': 'en', '🇬🇼': 'pt', '🇬🇳': 'fr', '🇸🇱': 'en', '🇱🇷': 'en', 
    '🇨🇮': 'fr', '🇧🇫': 'fr', '🇬🇭': 'en', '🇹🇬': 'fr', '🇧🇯': 'fr', 
    '🇳🇬': 'en', '🇨🇻': 'pt',

    // 🌍 Africa (Central & East)
    '🇨🇲': 'fr', '🇨🇫': 'fr', '🇬🇶': 'es', '🇸🇹': 'pt', '🇬🇦': 'fr', 
    '🇨🇬': 'fr', '🇨🇩': 'fr', '🇦🇴': 'pt', '🇸🇩': 'ar', '🇸🇸': 'en', 
    '🇪🇷': 'ti', '🇩🇯': 'fr', '🇪🇹': 'am', '🇸🇴': 'so', '🇰🇪': 'sw', 
    '🇺🇬': 'en', '🇷🇼': 'rw', '🇧🇮': 'fr', '🇹🇿': 'sw', '🇲🇿': 'pt', 
    '🇲🇼': 'ny', '🇿🇲': 'en', '🇿🇼': 'en', '🇲🇬': 'mg', '🇰🇲': 'ar', 
    '🇸🇨': 'fr', '🇲🇺': 'en',

    // 🌍 Africa (South)
    '🇳🇦': 'en', '🇧🇼': 'en', '🇿🇦': 'en', '🇱🇸': 'st', '🇸🇿': 'en'
};

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
                                         
