'use strict';

const mongoose = require('mongoose');

const dashboardPreferencesSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    showSuccessFeedback: { type: Boolean, default: true },
    showErrorFeedback: { type: Boolean, default: true }
}, { timestamps: true, versionKey: false });

module.exports = mongoose.models.DashboardPreferences ||
    mongoose.model('DashboardPreferences', dashboardPreferencesSchema);
