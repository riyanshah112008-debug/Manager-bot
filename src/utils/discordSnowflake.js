/**
 * Accept only Discord snowflake strings before they are used in database filters.
 * This prevents objects/operators or malformed values from crossing into Mongo queries.
 */
function requireDiscordSnowflake(value, fieldName = 'Discord ID') {
    if (typeof value !== 'string' || !/^\d{17,20}$/.test(value)) {
        throw new TypeError(`Invalid ${fieldName}; expected a Discord snowflake.`);
    }
    return value;
}

function buildBirthdayFilter(guildId, userId) {
    return Object.freeze({
        guildId: requireDiscordSnowflake(guildId, 'guild ID'),
        userId: requireDiscordSnowflake(userId, 'user ID')
    });
}

module.exports = { requireDiscordSnowflake, buildBirthdayFilter };
