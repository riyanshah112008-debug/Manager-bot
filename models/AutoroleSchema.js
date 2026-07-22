const mongoose = require('mongoose');

// Stores the setup for each server
const configSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    roleId: { type: String, default: null },
    stickyRolesEnabled: { type: Boolean, default: true }
});

// Stores the roles of a user when they leave
const stickySchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    roles: { type: Array, default: [] }
});

module.exports = {
    AutoroleConfig: mongoose.models.AutoroleConfig || mongoose.model('AutoroleConfig', configSchema),
    StickyRole: mongoose.models.StickyRole || mongoose.model('StickyRole', stickySchema)
};
      
