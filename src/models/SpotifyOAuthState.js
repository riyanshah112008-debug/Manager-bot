'use strict';

const mongoose = require('mongoose');

const spotifyOAuthStateSchema = new mongoose.Schema({
    stateHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, expires: 0 }
}, { timestamps: true });

module.exports = mongoose.models.SpotifyOAuthState ||
    mongoose.model('SpotifyOAuthState', spotifyOAuthStateSchema);
