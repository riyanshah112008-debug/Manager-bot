const mongoose = require('mongoose');

const goodbyeSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    channelId: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    title: { type: String, default: '🥀 FAREWELL FROM {server} 🥀' },
    description: { type: String, default: 'Goodbye {user}! We are sad to see you leave our community. We wish you the absolute best on your journey! ✨' },
    color: { type: String, default: '#7289DA' },
    image: { type: String, default: 'https://media.tenor.com/images/99208a68b444b0593457a82b3d39575e/tenor.gif' },
    thumbnail: { type: String, default: 'avatar' },
    footer: { type: String, default: 'We are now down to {count} members.' },
    pingContent: { type: String, default: '👋 Farewell, **{username}**.' }
});

module.exports = mongoose.models.GoodbyeSettings || mongoose.model('GoodbyeSettings', goodbyeSettingsSchema);
