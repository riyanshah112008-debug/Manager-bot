const mongoose = require('mongoose');

const multiBotTokenSchema = new mongoose.Schema({
    token: { type: String, required: true, unique: true },
    name: { type: String, default: 'Secondary Worker Bot' },
    addedBy: { type: String, default: 'System' },
    enabled: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.MultiBotToken || mongoose.model('MultiBotToken', multiBotTokenSchema);
