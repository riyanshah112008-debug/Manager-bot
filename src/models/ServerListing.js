const mongoose = require('mongoose');

const serverListingSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "A mysterious server with no description." },
    iconUrl: { type: String, default: null },
    inviteLink: { type: String, required: true },
    memberCount: { type: Number, default: 0 },
    tags: { type: [String], default: [] },
    bumps: { type: Number, default: 0 },
    lastBump: { type: Date, default: null }
});

module.exports = mongoose.model('ServerListing', serverListingSchema);
