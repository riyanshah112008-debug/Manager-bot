const mongoose = require('mongoose');

const policyVoteSchema = new mongoose.Schema({
    guildId: String,
    messageId: String,
    title: String,
    description: String,
    yesVotes: { type: Array, default: [] },
    noVotes: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.PolicyVote || mongoose.model('PolicyVote', policyVoteSchema);
