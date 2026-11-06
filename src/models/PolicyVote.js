const mongoose = require('mongoose');

const policyVoteSchema = new mongoose.Schema({
    guildId: { type: String, required: true, index: true },
    messageId: { type: String, required: true, unique: true },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    yesVotes: { type: [String], default: [] },
    noVotes: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.models.PolicyVote || mongoose.model('PolicyVote', policyVoteSchema);
