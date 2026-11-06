const mongoose = require('mongoose');

const chestGuildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    enabled: { type: Boolean, default: true }
});

module.exports = mongoose.models.ChestGuild || mongoose.model('ChestGuild', chestGuildSchema);
