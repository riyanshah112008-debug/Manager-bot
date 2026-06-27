// moderation.js

module.exports = (client) => {
    
    // Attach autoKick directly to the client
    client.autoKick = async function(member, reason = "Automated Kick") {
        if (!member.kickable) return false;
        
        try {
            await member.kick(reason);
            return true;
        } catch (error) {
            console.error("Kick error:", error);
            return false;
        }
    };

    // Attach autoBan directly to the client
    client.autoBan = async function(member, reason = "Automated Ban") {
        if (!member.bannable) return false;
        
        try {
            await member.ban({ reason: reason });
            return true;
        } catch (error) {
            console.error("Ban error:", error);
            return false;
        }
    };
    
};
