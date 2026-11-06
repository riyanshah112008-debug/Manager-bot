const mongoose = require('mongoose');

const masterSecuritySchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    autoKick: { type: Boolean, default: false },
    autoBan: { type: Boolean, default: false },
    ownerBypass: { type: Boolean, default: true },
    modules: {
        antinuke: { type: Boolean, default: true },
        antiraid: { type: Boolean, default: true },
        altshield: { type: Boolean, default: false },
        automod: { type: Boolean, default: true }
    },
    userInfractions: { type: Map, of: Number, default: {} }
}, { timestamps: true });

module.exports = mongoose.models.MasterSecurity || mongoose.model('MasterSecurity', masterSecuritySchema);
