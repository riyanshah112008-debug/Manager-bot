// ==========================================
// 💳 STARRY SECURE PAYMENT & VERIFICATION ENGINE
// File Path: src/utils/paymentHelper.js
// Multi-Provider Gateway • Crypto (USDT, SOL, BTC, ETH, LTC) • PayPal • UPI • Card
// ==========================================
const crypto = require('crypto');
const mongoose = require('mongoose');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const PaymentOrder = require('../models/PaymentOrder');
const PremiumKey = require('../models/PremiumKey');
const ServerSettings = require('../models/ServerSettings');
const config = require('../config');

// Master Tier Catalog
const TIER_CONFIG = {
    shield_plus: { id: 'shield_plus', name: 'Starry Shield Plus', eur: 10, usd: null, inr: null, durationDays: 30, maxGuilds: 1, tag: 'SHIELD', badge: 'ESSENTIAL', features: ['24/7 voice channel persistence','Studio DSP audio filters','Server backup and restore tools','Emergency server lockdown controls','Web CAPTCHA verification gateway','Advanced emoji and animated sticker tools','Flag-reaction translation tools','Enhanced moderation appeals and audit tools','Premium economy and mini-game perks'] },
    pro_cluster: { id: 'pro_cluster', name: 'Starry Pro Cluster', eur: 50, usd: null, inr: null, durationDays: 30, maxGuilds: 3, tag: 'PRO', badge: 'PROFESSIONAL', features: ['Everything in Shield Plus','Premium access across up to 3 servers','Custom multi-bot worker nodes','Worker role specialisation and cluster controls','Expanded server-wide premium capacity'] },
    platinum: { id: 'platinum', name: 'Starry Platinum', eur: 120, usd: null, inr: null, durationDays: 30, maxGuilds: 10, tag: 'PLAT', badge: 'ULTIMATE', features: ['Everything in Pro Cluster','Premium access across up to 10 servers','Expanded multi-bot cluster capacity','Highest standard premium server allowance','Priority access to Starry feature releases'] },
    lifetime: { id: 'lifetime', name: 'Starry Supreme Lifetime', eur: 800, usd: null, inr: null, durationDays: -1, maxGuilds: 9999, tag: 'LIFE', badge: 'LIFETIME', features: ['Everything in Platinum','One-time payment — no recurring subscription','Lifetime premium entitlement','Unlimited server redemptions, subject to fair-use safeguards','Standard Premium feature updates included'] }
};

function assertPaymentsNotConfigured() {
    // Checkout remains closed until verified Razorpay and crypto-provider adapters,
    // server-side signature checks, and provider webhooks are implemented.
    const error = new Error('Starry checkout is temporarily unavailable while verified payment providers are being configured. Do not send any payment yet.');
    error.code = 'PAYMENTS_NOT_CONFIGURED';
    throw error;
}

function buildQrUrl(dataUri) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(dataUri)}`;
}

/**
 * Multi-Network Crypto Configuration
 */
function getCryptoConfig() {
    const usdtTrc20 = process.env.CRYPTO_USDT_TRC20 || '';
    const usdtBep20 = process.env.CRYPTO_USDT_BEP20 || '';
    const sol = process.env.CRYPTO_SOL || '';
    const btc = process.env.CRYPTO_BTC || '';
    const eth = process.env.CRYPTO_ETH || '';
    const ltc = process.env.CRYPTO_LTC || '';

    return {
        usdt_trc20: {
            id: 'usdt_trc20',
            name: 'USDT (TRC-20)',
            symbol: 'USDT',
            network: 'TRON Network (TRC-20)',
            badge: '⚡ Lowest Fee & Fastest',
            address: usdtTrc20,
            qrUrl: usdtTrc20 ? buildQrUrl(usdtTrc20) : null,
            explorerUrl: 'https://tronscan.org/#/transaction/',
            instructions: 'Send exact USDT amount via TRC-20 network only.'
        },
        sol: {
            id: 'sol',
            name: 'Solana (SOL)',
            symbol: 'SOL',
            network: 'Solana Mainnet (SPL)',
            badge: '🚀 Sub-second Finality',
            address: sol,
            qrUrl: sol ? buildQrUrl(sol) : null,
            explorerUrl: 'https://solscan.io/tx/',
            instructions: 'Send SOL to this address on Solana mainnet.'
        },
        btc: {
            id: 'btc',
            name: 'Bitcoin (BTC)',
            symbol: 'BTC',
            network: 'Bitcoin Mainnet (Native)',
            badge: '🔒 Native Blockchain',
            address: btc,
            qrUrl: btc ? buildQrUrl(`bitcoin:${btc}`) : null,
            explorerUrl: 'https://www.blockchain.com/explorer/transactions/btc/',
            instructions: 'Send BTC from any Bitcoin wallet or exchange.'
        },
        eth: {
            id: 'eth',
            name: 'Ethereum (ETH / ERC-20)',
            symbol: 'ETH',
            network: 'Ethereum Mainnet (ERC-20)',
            badge: '💎 Ethereum Network',
            address: eth,
            qrUrl: eth ? buildQrUrl(`ethereum:${eth}`) : null,
            explorerUrl: 'https://etherscan.io/tx/',
            instructions: 'Send ETH or ERC-20 tokens to this address.'
        },
        usdt_bep20: {
            id: 'usdt_bep20',
            name: 'USDT (BEP-20)',
            symbol: 'USDT',
            network: 'BNB Smart Chain (BEP-20)',
            badge: '🟡 Ultra Low Gas Fee',
            address: usdtBep20,
            qrUrl: usdtBep20 ? buildQrUrl(usdtBep20) : null,
            explorerUrl: 'https://bscscan.com/tx/',
            instructions: 'Send USDT on BNB Smart Chain (BEP-20) network.'
        },
        ltc: {
            id: 'ltc',
            name: 'Litecoin (LTC)',
            symbol: 'LTC',
            network: 'Litecoin Mainnet',
            badge: '⚡ Low Transfer Fee',
            address: ltc,
            qrUrl: ltc ? buildQrUrl(`litecoin:${ltc}`) : null,
            explorerUrl: 'https://blockchair.com/litecoin/transaction/',
            instructions: 'Send LTC to this address.'
        }
    };
}

/**
 * PayPal Gateway Configuration
 */
function getPaypalConfig(orderId, amountUsd) {
    const email = process.env.PAYPAL_EMAIL || '';
    const rawMeUrl = process.env.PAYPAL_ME_URL || '';
    const cleanMe = rawMeUrl.replace(/\/+$/, '');
    const directPayUrl = cleanMe ? `${cleanMe}/${amountUsd}USD` : '';

    return {
        email,
        paypalMeUrl: directPayUrl,
        baseMeUrl: cleanMe,
        qrUrl: directPayUrl ? buildQrUrl(directPayUrl) : null,
        instructions: `Click "Pay via PayPal" or transfer $${amountUsd} USD to ${email}. In the note, include Order Reference "${orderId}".`
    };
}

/**
 * UPI Gateway Configuration
 */
function getUpiConfig(orderId, amountInr) {
    const upiId = process.env.UPI_ID || '';
    const payeeName = process.env.UPI_NAME || '';
    const cleanPa = encodeURIComponent(upiId);
    const cleanPn = encodeURIComponent(payeeName);
    const cleanTn = encodeURIComponent(`Starry VIP ${orderId}`);
    const upiUri = upiId ? `upi://pay?pa=${cleanPa}&pn=${cleanPn}&am=${amountInr}&cu=INR&tn=${cleanTn}` : '';

    return {
        upiId,
        payeeName,
        upiUri,
        qrUrl: upiUri ? buildQrUrl(upiUri) : null,
        instructions: `Scan QR code or open in UPI app. Pay ₹${amountInr} and enter the 12-digit UPI UTR number from your payment receipt.`
    };
}

/**
 * Card Gateway Configuration
 */
function getCardConfig(orderId, amountUsd) {
    const cardUrl = process.env.CARD_GATEWAY_URL || '';
    return {
        cardUrl,
        instructions: `Click below to pay $${amountUsd} USD via Credit/Debit card. Enter your payment receipt or reference number below.`
    };
}

/**
 * 1. Create a Pending Payment Order (Zero key released)
 */
async function createPaymentOrder({ 
    tier, 
    method = 'crypto', 
    cryptoCoin = 'usdt_trc20', 
    guildId = null, 
    guildName = '', 
    userId = null, 
    userTag = 'Web Guest' 
}) {
    assertPaymentsNotConfigured();
    const tierData = TIER_CONFIG[tier];
    if (!tierData) {
        throw new Error(`Invalid tier '${tier}'. Available tiers: shield_plus, pro_cluster, platinum, lifetime`);
    }

    const cleanMethod = (method || 'crypto').toLowerCase().trim();
    const validMethods = ['crypto', 'paypal', 'upi', 'card'];
    const chosenMethod = validMethods.includes(cleanMethod) ? cleanMethod : 'crypto';

    // Unique Order Identifier: ORD-<HEX_TIME>-<HEX_RAND>
    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

    // Precompute all gateways so frontend can render rich interactive controls
    const cryptoCatalog = getCryptoConfig();
    const activeCrypto = cryptoCatalog[cryptoCoin] || cryptoCatalog.usdt_trc20;
    const paypalData = getPaypalConfig(orderId, tierData.usd);
    const upiData = getUpiConfig(orderId, tierData.inr);
    const cardData = getCardConfig(orderId, tierData.usd);

    const paymentDetails = {
        // Crypto
        allCrypto: cryptoCatalog,
        activeCryptoCoin: activeCrypto.id,
        cryptoAddress: activeCrypto.address,
        cryptoNetwork: activeCrypto.network,
        cryptoQrUrl: activeCrypto.qrUrl,
        // PayPal
        paypalEmail: paypalData.email,
        paypalMeUrl: paypalData.paypalMeUrl,
        paypalQrUrl: paypalData.qrUrl,
        // UPI
        upiId: upiData.upiId,
        payeeName: upiData.payeeName,
        upiUri: upiData.upiUri,
        upiQrUrl: upiData.qrUrl,
        // Card
        cardUrl: cardData.cardUrl
    };

    let defaultInstructions = '';
    if (chosenMethod === 'crypto') {
        defaultInstructions = `Send exactly $${tierData.usd} USDT (or equivalent) to the ${activeCrypto.name} address above. Enter your Transaction Hash (TxID) to verify.`;
    } else if (chosenMethod === 'paypal') {
        defaultInstructions = paypalData.instructions;
    } else if (chosenMethod === 'upi') {
        defaultInstructions = upiData.instructions;
    } else {
        defaultInstructions = cardData.instructions;
    }

    const order = await PaymentOrder.create({
        orderId,
        userId,
        userTag,
        guildId,
        guildName,
        tier: tierData.id,
        tierName: tierData.name,
        amountEur: tierData.eur,
        amountInr: tierData.inr,
        amountUsd: tierData.usd,
        durationDays: tierData.durationDays,
        method: chosenMethod,
        cryptoCoin: activeCrypto.id,
        status: 'pending',
        paymentDetails
    });

    return {
        orderId: order.orderId,
        tier: order.tier,
        tierName: order.tierName,
        amountEur: order.amountEur,
        amountInr: order.amountInr,
        amountUsd: order.amountUsd,
        durationDays: order.durationDays,
        method: order.method,
        cryptoCoin: order.cryptoCoin,
        status: order.status,
        guildId: order.guildId,
        paymentDetails: order.paymentDetails,
        instructions: defaultInstructions
    };
}

/**
 * 2. Submit Payment Proof (UTR, TxID, TxHash, or PayPal ID)
 */
async function submitPaymentProof({ 
    orderId, 
    utr, 
    method, 
    cryptoCoin = null, 
    notes = '', 
    client = null 
}) {
    assertPaymentsNotConfigured();
    if (!orderId) throw new Error('Order ID is required.');
    if (!utr || typeof utr !== 'string') throw new Error('Payment reference or Transaction ID is required.');

    const cleanOrderId = orderId.trim().toUpperCase();
    const cleanRef = utr.trim();

    if (cleanRef.length < 5) {
        throw new Error('Invalid Transaction Reference. Must contain at least 5 characters.');
    }

    const order = await PaymentOrder.findOne({ orderId: cleanOrderId });
    if (!order) {
        throw new Error(`Order '${cleanOrderId}' not found.`);
    }

    if (order.status === 'completed') {
        throw new Error(`Order '${cleanOrderId}' is already completed and verified.`);
    }

    // Anti-Fraud Check: Disallow reuse of the exact same reference on another completed/verifying order
    const duplicateRefOrder = await PaymentOrder.findOne({
        orderId: { $ne: cleanOrderId },
        utr: cleanRef,
        status: { $in: ['verifying', 'completed'] }
    });

    if (duplicateRefOrder) {
        throw new Error(`This Transaction Reference (${cleanRef}) has already been registered on order (${duplicateRefOrder.orderId}).`);
    }

    order.utr = cleanRef;
    order.status = 'verifying';
    order.notes = notes ? notes.trim() : order.notes;
    order.submittedAt = new Date();
    if (method) order.method = method.toLowerCase();
    if (cryptoCoin) order.cryptoCoin = cryptoCoin.toLowerCase();
    await order.save();

    // Dispatch Discord Owner Alert
    notifyOwnersOfSubmittedProof(order, client).catch(err => {
        console.error('⚠️ Failed to dispatch Discord owner alert for payment proof:', err.message);
    });

    return {
        success: true,
        message: 'Payment verification proof submitted successfully!',
        orderId: order.orderId,
        status: order.status,
        utr: order.utr,
        method: order.method,
        cryptoCoin: order.cryptoCoin,
        tierName: order.tierName
    };
}

/**
 * 3. Discord Owner Alert with Interactive Buttons & Direct Explorer Links
 */
async function notifyOwnersOfSubmittedProof(order, client) {
    if (!client) return;

    const owners = config.BOT_OWNERS || [];
    if (!owners.length) return;

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`approve_order_${order.orderId}`)
            .setLabel('✅ Approve & Issue Key')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`reject_order_${order.orderId}`)
            .setLabel('❌ Reject Order')
            .setStyle(ButtonStyle.Danger)
    );

    let methodEmoji = '💳';
    let methodDisplay = order.method.toUpperCase();
    let explorerLink = '';

    if (order.method === 'crypto') {
        methodEmoji = '🪙';
        const cryptoCatalog = getCryptoConfig();
        const coinData = cryptoCatalog[order.cryptoCoin] || cryptoCatalog.usdt_trc20;
        methodDisplay = `Crypto (${coinData.name})`;
        if (coinData.explorerUrl && order.utr) {
            explorerLink = `\n🔍 **Explorer:** [View on Blockchain](${coinData.explorerUrl}${order.utr})`;
        }
    } else if (order.method === 'paypal') {
        methodEmoji = '🅿️';
        methodDisplay = 'PayPal Express';
    } else if (order.method === 'upi') {
        methodEmoji = '📱';
        methodDisplay = 'UPI Instant';
    }

    const embed = new EmbedBuilder()
        .setColor('#F59E0B')
        .setAuthor({ name: 'Starry Payment Verification Alert', iconURL: 'https://cdn.discordapp.com/emojis/1049283733054177301.webp?size=96' })
        .setTitle(`🛒 New Payment Proof: ${order.tierName}`)
        .setDescription(
            `A customer has submitted a payment reference for settlement verification.\n\n` +
            `• **Order ID:** \`${order.orderId}\`\n` +
            `• **Tier:** **${order.tierName}**\n` +
            `• **Amount:** **€${order.amountEur} EUR**\n` +
            `• **Method:** ${methodEmoji} **${methodDisplay}**\n` +
            `• **Transaction / TxHash:** \`${order.utr}\`${explorerLink}\n` +
            `• **Target Server:** ${order.guildId ? `\`${order.guildId}\` (${order.guildName || 'Unknown'})` : '*None Specified*'}\n` +
            `• **Buyer User:** ${order.userId ? `<@${order.userId}> (\`${order.userId}\`)` : `*${order.userTag}*`}`
        )
        .setFooter({ text: `Approve via button below or run: ,approveorder ${order.orderId}` })
        .setTimestamp();

    for (const ownerId of owners) {
        try {
            const user = await client.users.fetch(ownerId).catch(() => null);
            if (user) {
                await user.send({ embeds: [embed], components: [row] }).catch(() => {});
            }
        } catch (e) {}
    }
}

/**
 * 4. Approve Payment Order & Issue License Key
 */
async function approvePaymentOrder(orderId, adminIdentifier = 'System Admin', client = null) {
    const cleanOrderId = orderId.trim().toUpperCase();
    const order = await PaymentOrder.findOne({ orderId: cleanOrderId });

    if (!order) {
        return { success: false, error: `Order '${cleanOrderId}' not found.` };
    }

    if (order.status === 'completed' && order.licenseKey) {
        return {
            success: true,
            message: `Order '${cleanOrderId}' is already approved!`,
            alreadyCompleted: true,
            key: order.licenseKey,
            order
        };
    }

    const tierData = TIER_CONFIG[order.tier] || TIER_CONFIG.pro_cluster;
    const randHex = crypto.randomBytes(6).toString('hex').toUpperCase();
    const generatedKey = `STRY-${tierData.tag}-${randHex.slice(0, 4)}-${randHex.slice(4, 8)}`;
    const durationDays = tierData.durationDays;

    let expiresAt = null;
    if (durationDays > 0) {
        expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);
    }

    // Create Official License Key Record
    await PremiumKey.create({
        key: generatedKey,
        tier: order.tier,
        durationDays: durationDays,
        maxUses: tierData.maxGuilds || 1,
        usedCount: order.guildId ? 1 : 0,
        redeemedBy: order.guildId ? [{
            userId: order.userId || 'Payment System',
            guildId: order.guildId,
            redeemedAt: new Date()
        }] : [],
        active: order.guildId ? (tierData.maxGuilds || 1) > 1 : true,
        createdBy: `Order [${order.orderId}] Verified by ${adminIdentifier}`
    });

    // If Guild ID was specified during checkout, auto-activate immediately
    let autoActivated = false;
    const expMs = expiresAt ? expiresAt.getTime() : null;
    const { invalidatePremiumCache } = require('./premiumHelper');

    if (order.guildId) {
        try {
            let settings = await ServerSettings.findOne({ guildId: order.guildId });
            if (!settings) settings = new ServerSettings({ guildId: order.guildId });
            settings.premium = {
                isPremium: true,
                tier: order.tier,
                expiresAt: expiresAt,
                activatedBy: order.userId || `Payment [${order.orderId}]`
            };
            await settings.save();

            // Sync with PremiumGuilds model for instant RAM cache
            const PremiumModel = mongoose.models.PremiumGuilds || mongoose.model('PremiumGuilds');
            if (PremiumModel) {
                await PremiumModel.findOneAndUpdate(
                    { targetId: order.guildId },
                    { 
                        targetId: order.guildId, 
                        type: 'guild', 
                        isPremium: true, 
                        activatedAt: new Date(), 
                        expiresAt: expiresAt 
                    },
                    { upsert: true }
                ).catch(() => {});
            }

            // Sync live RAM caches immediately
            if (client && typeof client.setPremiumCache === 'function') {
                client.setPremiumCache(order.guildId, expMs);
            }
            invalidatePremiumCache(order.guildId);

            // Auto-upgrade any existing BoosterRole documents in this server!
            const BoosterRole = mongoose.models.BoosterRole || mongoose.model('BoosterRole');
            if (BoosterRole) {
                const tierMaxShares = order.tier === 'lifetime' ? 15 : (order.tier === 'pro_cluster' ? 10 : 5);
                await BoosterRole.updateMany(
                    { guildId: order.guildId, maxShares: { $lt: tierMaxShares } },
                    { $set: { maxShares: tierMaxShares } }
                ).catch(() => {});
            }

            autoActivated = true;
        } catch (actErr) {
            console.error('⚠️ Auto-activation guild error:', actErr.message);
        }
    }

    // Update Order Status
    order.status = 'completed';
    order.licenseKey = generatedKey;
    order.verifiedBy = adminIdentifier;
    order.completedAt = new Date();
    await order.save();

    // Send DM to the customer on Discord if user is known
    if (order.userId && client) {
        try {
            const customer = await client.users.fetch(order.userId).catch(() => null);
            if (customer) {
                let activationNote = '';
                if (autoActivated) {
                    activationNote += `\n✅ **Auto-Activation:** Server ID \`${order.guildId}\` is now fully upgraded to **${order.tierName}**!`;
                }
                activationNote += `\n\n💡 *To activate or transfer premium to any server, use \`,redeem ${generatedKey}\` in that server.*`;

                const dmEmbed = new EmbedBuilder()
                    .setColor('#10B981')
                    .setTitle('🎉 Starry Premium Payment Approved!')
                    .setDescription(
                        `Your payment for **${order.tierName}** (Order: \`${order.orderId}\`) has been verified and confirmed!\n\n` +
                        `🔑 **Your 16-Digit License Key:**\n` +
                        `\`\`\`\n${generatedKey}\n\`\`\`` +
                        activationNote
                    )
                    .setFooter({ text: 'Starry VIP Systems • Thank you for supporting the network!' })
                    .setTimestamp();

                await customer.send({ embeds: [dmEmbed] }).catch(() => {});
            }
        } catch (dmErr) {}
    }

    return {
        success: true,
        message: `Order '${cleanOrderId}' successfully verified and activated!`,
        key: generatedKey,
        tier: order.tier,
        autoActivated,
        guildId: order.guildId,
        userId: order.userId,
        order
    };
}

/**
 * 5. Reject Payment Order
 */
async function rejectPaymentOrder(orderId, adminIdentifier = 'System Admin', reason = 'Payment verification rejected (invalid reference or unpaid).', client = null) {
    const cleanOrderId = orderId.trim().toUpperCase();
    const order = await PaymentOrder.findOne({ orderId: cleanOrderId });

    if (!order) {
        return { success: false, error: `Order '${cleanOrderId}' not found.` };
    }

    order.status = 'rejected';
    order.notes = reason;
    order.verifiedBy = adminIdentifier;
    await order.save();

    if (order.userId && client) {
        try {
            const customer = await client.users.fetch(order.userId).catch(() => null);
            if (customer) {
                const dmEmbed = new EmbedBuilder()
                    .setColor('#EF4444')
                    .setTitle('❌ Payment Verification Notice')
                    .setDescription(
                        `Your payment verification for **${order.tierName}** (Order: \`${order.orderId}\`) was rejected.\n\n` +
                        `**Reason:** ${reason}\n\n` +
                        `If you believe this is an error, please reach out in our Support Server.`
                    )
                    .setTimestamp();

                await customer.send({ embeds: [dmEmbed] }).catch(() => {});
            }
        } catch (e) {}
    }

    return {
        success: true,
        message: `Order '${cleanOrderId}' rejected.`,
        order
    };
}

/**
 * 6. Get Order Status
 */
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
        amountInr: order.amountInr,
        amountUsd: order.amountUsd,
        method: order.method,
        cryptoCoin: order.cryptoCoin,
        utr: order.utr,
        notes: order.notes,
        paymentDetails: order.paymentDetails,
        licenseKey: order.status === 'completed' ? order.licenseKey : null,
        guildId: order.guildId,
        createdAt: order.createdAt,
        submittedAt: order.submittedAt,
        completedAt: order.completedAt
    };
}

/**
 * 7. Standalone Admin Key Generator (For direct bot owner use)
 */
async function generateStandaloneKey({ tier = 'pro_cluster', durationDays = null, createdBy = 'Owner' }) {
    const tierData = TIER_CONFIG[tier] || TIER_CONFIG.pro_cluster;
    const randHex = crypto.randomBytes(6).toString('hex').toUpperCase();
    const generatedKey = `STRY-${tierData.tag}-${randHex.slice(0, 4)}-${randHex.slice(4, 8)}`;
    const finalDays = durationDays !== null ? durationDays : tierData.durationDays;

    const license = await PremiumKey.create({
        key: generatedKey,
        tier: tierData.id,
        durationDays: finalDays,
        maxUses: tierData.maxGuilds || 1,
        usedCount: 0,
        createdBy: createdBy
    });

    return {
        key: license.key,
        tier: license.tier,
        durationDays: license.durationDays
    };
}

module.exports = {
    TIER_CONFIG,
    getCryptoConfig,
    getPaypalConfig,
    getUpiConfig,
    getCardConfig,
    createPaymentOrder,
    submitPaymentProof,
    approvePaymentOrder,
    rejectPaymentOrder,
    getOrderStatus,
    generateStandaloneKey
};
