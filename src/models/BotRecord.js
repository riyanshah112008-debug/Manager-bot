'use strict';

const mongoose = require('mongoose');

const botRecordSchema = new mongoose.Schema({
    namespace: { type: String, required: true, trim: true },
    recordId: { type: String, required: true, trim: true },
    schemaVersion: { type: Number, required: true, default: 1 },
    revision: { type: Number, required: true, default: 0 },
    data: { type: mongoose.Schema.Types.Mixed, required: true, default: {} }
}, {
    timestamps: true,
    minimize: false,
    versionKey: false
});

botRecordSchema.index({ namespace: 1, recordId: 1 }, { unique: true });

module.exports = mongoose.models.BotRecord || mongoose.model('BotRecord', botRecordSchema);
