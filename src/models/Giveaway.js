'use strict';

const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    channelId: { type: String, required: true },
    messageId: { type: String, required: true, unique: true },
    prize: { type: String, required: true, trim: true, maxlength: 150 },
    winners: { type: Number, required: true, min: 1, max: 20, default: 1 },
    endsAt: { type: Date, required: true, index: true },
    hostId: { type: String, required: true },
    status: { type: String, enum: ['active', 'processing', 'ended', 'cancelled'], default: 'active', index: true },
    winnerIds: { type: [String], default: [] },
    endedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

giveawaySchema.index({ guildId: 1, status: 1, endsAt: 1 });

module.exports = mongoose.models.Giveaway || mongoose.model('Giveaway', giveawaySchema);
