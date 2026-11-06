const mongoose = require('mongoose');

const chestGuildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.models.ChestGuild || mongoose.model('ChestGuild', chestGuildSchema);
