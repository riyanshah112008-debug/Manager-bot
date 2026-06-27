// moderation.js

// Function to handle auto-kicking
async function autoKick(member, reason = "Automated Kick") {
    if (!member.kickable) return false;
    
    try {
        await member.kick(reason);
        return true;
    } catch (error) {
        console.error("Kick error:", error);
        return false;
    }
}

// Function to handle auto-banning
async function autoBan(member, reason = "Automated Ban") {
    if (!member.bannable) return false;
    
    try {
        await member.ban({ reason: reason });
        return true;
    } catch (error) {
        console.error("Ban error:", error);
        return false;
    }
}

// Export the functions so your main bot can use them
module.exports = { autoKick, autoBan };
