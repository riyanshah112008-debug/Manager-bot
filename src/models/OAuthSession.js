const mongoose = require('mongoose');

const oauthSessionSchema = new mongoose.Schema({
    tokenHash: { type: String, required: true, unique: true, index: true },
    user: { type: mongoose.Schema.Types.Mixed, required: true },
    guilds: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Encrypted Discord OAuth refresh token; used only to refresh the user's live guild list.
    discordRefreshTokenEncrypted: { type: String, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.OAuthSession || mongoose.model('OAuthSession', oauthSessionSchema);
