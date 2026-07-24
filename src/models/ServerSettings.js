const mongoose = require('mongoose');

const serverSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    triggerWord: { type: String, default: 'Starry' } // Default name if they haven't changed it
});

module.exports = mongoose.model('ServerSettings', serverSettingsSchema);
