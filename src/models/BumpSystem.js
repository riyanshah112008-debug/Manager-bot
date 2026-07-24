const mongoose = require('mongoose');

const bumpSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    reminderChannelId: { type: String, default: null }, 
    pingRoleId: { type: String, default: null },        
    nextBump: { type: Date, default: null },            
    isReady: { type: Boolean, default: true }           
});

module.exports = mongoose.model('BumpSystem', bumpSchema);