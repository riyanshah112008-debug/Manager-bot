const mongoose = require('mongoose');

const serverSettingsSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true },
    prefix: { type: String, default: ',' },
    triggerWord: { type: String, default: 'Starry' },
    
    // 🛡️ Starry Anti-Nuke & Security Guard Shield
    antinuke: {
        enabled: { type: Boolean, default: true },
        maxChannelDeletions: { type: Number, default: 3 },
        maxRoleDeletions: { type: Number, default: 3 },
        maxBans: { type: Number, default: 3 },
        maxKicks: { type: Number, default: 3 },
        blockUnapprovedBots: { type: Boolean, default: true },
        blockWebhookCreation: { type: Boolean, default: true },
        quarantineRoleId: { type: String, default: '' },
        action: { type: String, default: 'quarantine' }, // 'quarantine' | 'timeout' | 'kick' | 'ban'
        whitelistedUsers: { type: [String], default: [] },
        whitelistedRoles: { type: [String], default: [] },
        panicLockdown: { type: Boolean, default: false }
    },

    // 🤖 Starry AutoMod Pro
    automod: {
        enabled: { type: Boolean, default: true },
        antiSpam: { type: Boolean, default: true },
        spamThreshold: { type: Number, default: 5 }, // max messages per 5s
        antiMassPing: { type: Boolean, default: true },
        pingLimit: { type: Number, default: 5 },
        antiInvite: { type: Boolean, default: true },
        antiLink: { type: Boolean, default: false },
        antiScam: { type: Boolean, default: true },
        antiCaps: { type: Boolean, default: false },
        capsThreshold: { type: Number, default: 70 }, // % caps
        antiEmojiSpam: { type: Boolean, default: false },
        emojiLimit: { type: Number, default: 6 },
        ghostPingDetector: { type: Boolean, default: true },
        ignoredChannels: { type: [String], default: [] },
        ignoredRoles: { type: [String], default: [] },
        punishment: { type: String, default: 'timeout' } // 'timeout' | 'delete' | 'warn' | 'kick' | 'ban'
    },

    // 👑 Starry Verification & Gatekeeper Gateway
    verification: {
        enabled: { type: Boolean, default: false },
        roleId: { type: String, default: '' },
        unverifiedRoleId: { type: String, default: '' },
        captchaType: { type: String, default: 'web' }, // 'web' | 'button' | 'math'
        channelId: { type: String, default: '' },
        minAccountAgeDays: { type: Number, default: 3 },
        requireAvatar: { type: Boolean, default: false },
        autoKickUnverifiedMinutes: { type: Number, default: 0 } // 0 = disabled
    },

    // 🏷️ Starry AutoRoles & Sticky Roles
    autorole: {
        memberRoles: { type: [String], default: [] },
        botRoles: { type: [String], default: [] },
        stickyRoles: { type: Boolean, default: true }
    },

    // 📜 Starry Audit & Security Telemetry Logging
    logging: {
        modLogChannel: { type: String, default: '' },
        messageLogChannel: { type: String, default: '' },
        voiceLogChannel: { type: String, default: '' },
        memberLogChannel: { type: String, default: '' },
        serverLogChannel: { type: String, default: '' }
    },

    // 🎵 Starry Studio & 24/7 Music Settings
    music: {
        defaultVolume: { type: Number, default: 100 },
        is247: { type: Boolean, default: false },
        voiceChannelId: { type: String, default: '' },
        djRoleId: { type: String, default: '' },
        defaultFilter: { type: String, default: 'clear' }
    },

    // 🎫 Starry Support Tickets
    tickets: {
        enabled: { type: Boolean, default: false },
        categoryId: { type: String, default: '' },
        supportRoleId: { type: String, default: '' },
        transcriptsChannel: { type: String, default: '' },
        panelChannelId: { type: String, default: '' }
    },

    // 💎 Starry Premium Tier
    premium: {
        isPremium: { type: Boolean, default: false },
        tier: { type: String, default: 'none' }, // 'none' | 'shield_plus' | 'pro_cluster' | 'lifetime'
        expiresAt: { type: Date, default: null },
        activatedBy: { type: String, default: null },
        customBotToken: { type: String, default: null }
    }
}, { timestamps: true });

module.exports = mongoose.models.ServerSettings || mongoose.model('ServerSettings', serverSettingsSchema);
