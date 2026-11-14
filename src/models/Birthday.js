const mongoose = require('mongoose');

const birthdaySchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    day: { type: Number, required: true, min: 1, max: 31 },
    lastAnnouncedDate: { type: String, default: '' },
    birthdayRoleGrantedDate: { type: String, default: '' },
    birthdayRoleId: { type: String, default: '' }
}, { timestamps: true });

birthdaySchema.index({ guildId: 1, userId: 1 }, { unique: true });
birthdaySchema.index({ month: 1, day: 1 });

module.exports = mongoose.models.Birthday || mongoose.model('Birthday', birthdaySchema);
