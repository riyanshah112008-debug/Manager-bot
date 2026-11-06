const mongoose = require('mongoose');

const welcomeSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, required: true },
    title: { type: String, default: '✨ WELCOME TO {server} ✨' },
    description: { type: String, default: '💖 Hello {user}! We are so overjoyed to have you join our family! Make sure to read the guidelines and have an amazing time here. 🌟' },
    color: { type: String, default: '#FF73FA' },
    image: { type: String, default: 'https://cdn.otakugifs.xyz/gifs/wave/61621fefb2bce465.gif' },
    thumbnail: { type: String, default: 'avatar' },
    footer: { type: String, default: '✨ Enjoy your stellar journey in {server}! ✨' },
    pingContent: { type: String, default: '💫 Welcome {user}! Grab a seat and enjoy your stay! 🥂' }
}, { timestamps: true });

module.exports = mongoose.models.WelcomeSettings || mongoose.model('WelcomeSettings', welcomeSettingsSchema);
