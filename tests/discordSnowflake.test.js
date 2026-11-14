const assert = require('node:assert/strict');
const { requireDiscordSnowflake, buildBirthdayFilter } = require('../src/utils/discordSnowflake');

assert.equal(requireDiscordSnowflake('12345678901234567'), '12345678901234567');
assert.deepEqual(buildBirthdayFilter('12345678901234567', '98765432109876543'), {
    guildId: '12345678901234567',
    userId: '98765432109876543'
});
for (const invalid of [null, undefined, 12345678901234567, {}, { $ne: null }, '', 'not-a-snowflake', '123']) {
    assert.throws(() => requireDiscordSnowflake(invalid), TypeError);
}
assert.throws(() => buildBirthdayFilter({ $ne: null }, '98765432109876543'), TypeError);
console.log('Discord snowflake validation tests passed.');
