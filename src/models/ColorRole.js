// ==========================================
// 🎨 STARRY HEX BLEND & NAME COLOR SCHEMA
// File Path: src/models/ColorRole.js
// Multi-Tenant Custom Vanity Color Role Model
// Supports: Hex Blends, Solid Hex, Native Gradients, Presets
// ==========================================
const mongoose = require('mongoose');

const colorRoleSchema = new mongoose.Schema({
    guildId: { 
        type: String, 
        required: true, 
        index: true 
    },
    userId: { 
        type: String, 
        required: true, 
        index: true 
    },
    roleId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true 
    },
    colorType: {
        type: String,
        enum: ['blend', 'solid', 'gradient', 'preset', 'random'],
        default: 'blend'
    },
    primaryColor: { 
        type: String, 
        required: true,
        trim: true
    },
    secondaryColor: { 
        type: String, 
        default: null,
        trim: true
    },
    blendedColor: { 
        type: String, 
        required: true,
        trim: true
    },
    ratio: {
        type: Number,
        default: 50,
        min: 0,
        max: 100
    },
    presetName: {
        type: String,
        default: null,
        trim: true
    },
    isNativeGradient: {
        type: Boolean,
        default: false
    },
    active: { 
        type: Boolean, 
        default: true 
    }
}, { 
    timestamps: true 
});

// Compound unique index: each user has at most one personal color role per guild
colorRoleSchema.index({ guildId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.models.ColorRole || mongoose.model('ColorRole', colorRoleSchema);
