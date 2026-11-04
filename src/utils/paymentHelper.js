// Starry Premium catalogue and read-only legacy order status helpers.
// Checkout and entitlement activation are intentionally unavailable until a
// real payment provider with signed webhook verification has been configured.
const PaymentOrder = require('../models/PaymentOrder');

// Master Tier Catalog
const TIER_CONFIG = {
    shield_plus: { id: 'shield_plus', name: 'Starry Shield Plus', eur: 10, usd: null, inr: null, durationDays: 30, maxGuilds: 1, tag: 'SHIELD', badge: 'ESSENTIAL', features: ['24/7 voice channel persistence','Studio DSP audio filters','Server backup and restore tools','Emergency server lockdown controls','Web CAPTCHA verification gateway','Advanced emoji and animated sticker tools','Flag-reaction translation tools','Enhanced moderation appeals and audit tools','Premium economy and mini-game perks'] },
    pro_cluster: { id: 'pro_cluster', name: 'Starry Pro Cluster', eur: 50, usd: null, inr: null, durationDays: 30, maxGuilds: 3, tag: 'PRO', badge: 'PROFESSIONAL', features: ['Everything in Shield Plus','Premium access across up to 3 servers','Custom multi-bot worker nodes','Worker role specialisation and cluster controls','Expanded server-wide premium capacity'] },
    platinum: { id: 'platinum', name: 'Starry Platinum', eur: 120, usd: null, inr: null, durationDays: 30, maxGuilds: 10, tag: 'PLAT', badge: 'ULTIMATE', features: ['Everything in Pro Cluster','Premium access across up to 10 servers','Expanded multi-bot cluster capacity','Highest standard premium server allowance','Priority access to Starry feature releases'] },
    lifetime: { id: 'lifetime', name: 'Starry Supreme Lifetime', eur: 800, usd: null, inr: null, durationDays: -1, maxGuilds: 9999, tag: 'LIFE', badge: 'LIFETIME', features: ['Everything in Platinum','One-time payment — no recurring subscription','Lifetime premium entitlement','Unlimited server redemptions, subject to fair-use safeguards','Standard Premium feature updates included'] }
};

async function getOrderStatus(orderId) {
    if (!orderId) return null;
    const cleanOrderId = orderId.trim().toUpperCase();
    const order = await PaymentOrder.findOne({ orderId: cleanOrderId }).lean();
    if (!order) return null;

    return {
        orderId: order.orderId,
        status: order.status,
        tier: order.tier,
        tierName: order.tierName,
        amountEur: order.amountEur,
        amountInr: order.amountInr,
        amountUsd: order.amountUsd,
        method: order.method,
        cryptoCoin: order.cryptoCoin,
        utr: order.utr,
        notes: order.notes,
        paymentDetails: order.paymentDetails,
        guildId: order.guildId,
        createdAt: order.createdAt,
        submittedAt: order.submittedAt,
        completedAt: order.completedAt
    };
}

module.exports = {
    TIER_CONFIG,
    getOrderStatus
};
