// moderation.js

module.exports = (client) => {
    
    // ==========================================
    // MODERATION ACTIONS
    // ==========================================
    client.autoKick = async function(member, reason = "Automated Kick") {
        if (!member.kickable) return false;
        
        try {
            await member.kick(reason);
            console.log(`[AutoMod] Kicked ${member.user.tag}: ${reason}`);
            return true;
        } catch (error) {
            console.error("Kick error:", error);
            return false;
        }
    };

    client.autoBan = async function(member, reason = "Automated Ban") {
        if (!member.bannable) return false;
        
        try {
            await member.ban({ reason: reason });
            console.log(`[AutoMod] Banned ${member.user.tag}: ${reason}`);
            return true;
        } catch (error) {
            console.error("Ban error:", error);
            return false;
        }
    };

    // ==========================================
    // SUS PROFILE DETECTION
    // ==========================================
    client.on('guildMemberAdd', async (member) => {
        // 1. Calculate how many days old the account is
        const accountAgeMs = Date.now() - member.user.createdAt.getTime();
        const accountAgeDays = accountAgeMs / (1000 * 60 * 60 * 24);

        // 2. Check if they have a custom avatar
        const hasNoAvatar = member.user.avatarURL() === null;

        // 3. Check for scam keywords in their name
        const susKeywords = ["nitro", "free", "gift", "scam", "steam", "promo"];
        const lowerCaseName = member.user.username.toLowerCase();
        const hasSusName = susKeywords.some(keyword => lowerCaseName.includes(keyword));

        // --- THE PUNISHMENT LOGIC ---
        
        // BAN TRIGGER: Name has scam keywords OR (account is less than 1 day old AND has no avatar)
        if (hasSusName || (accountAgeDays < 1 && hasNoAvatar)) {
            await client.autoBan(member, "Auto-Banned: Suspicious profile detected (Anti-Scam/Raid)");
            return; // Stop here so we don't also try to kick them
        }

        // KICK TRIGGER: Account is just really new (under 3 days old)
        if (accountAgeDays < 3) {
            await client.autoKick(member, "Auto-Kicked: Account is too new. Please try joining again in a few days.");
            return;
        }
    });
    
};
        
