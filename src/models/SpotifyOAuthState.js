'use strict';

const mongoose = require('mongoose');

const spotifyOAuthStateSchema = new mongoose.Schema({
    stateHash: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    codeVerifierEncrypted: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.SpotifyOAuthState ||
    mongoose.model('SpotifyOAuthState', spotifyOAuthStateSchema);
