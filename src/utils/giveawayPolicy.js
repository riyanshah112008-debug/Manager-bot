'use strict';

const MAX_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

function parseGiveawayDuration(input) {
    if (typeof input !== 'string') return null;
    const match = input.trim().match(/^(\\d{1,6})(s|m|h|d|w)$/i);
    if (!match) return null;
    const value = Number(match[1]);
    const unit = match[2].toLowerCase();
    const multiplier = unit === 's' ? 1000 :
        unit === 'm' ? 60 * 1000 :
        unit === 'h' ? 60 * 60 * 1000 :
        unit === 'd' ? 24 * 60 * 60 * 1000 :
        7 * 24 * 60 * 60 * 1000;
    const duration = value * multiplier;
    return Number.isSafeInteger(duration) && duration > 0 && duration <= MAX_DURATION_MS ? duration : null;
}

function validateGiveawayInput(input) {
    const prize = typeof input?.prize === 'string' ? input.prize.trim() : '';
    const duration = parseGiveawayDuration(input?.duration);
    const winners = Number(input?.winners);
    if (!prize || prize.length > 200) return { valid: false, error: 'Prize must contain 1–200 characters.' };
    if (!duration) return { valid: false, error: 'Duration must be between 1 second and 30 days (s, m, h, d or w).' };
    if (!Number.isInteger(winners) || winners < 1 || winners > 10) return { valid: false, error: 'Winner count must be an integer from 1 to 10.' };
    return { valid: true, prize, durationMs: duration, winners };
}

module.exports = { MAX_DURATION_MS, parseGiveawayDuration, validateGiveawayInput };
