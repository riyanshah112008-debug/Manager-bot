// ==========================================
// 🛠️ COMMAND CONTEXT & INTERACTION HELPER
// Normalizes Discord.js Message and Interaction
// High-Timing Interaction Up to 1 Year (31536000000 ms)
// ==========================================
const { MessageFlags, EmbedBuilder } = require('discord.js');
const config = require('../config');

const EPHEMERAL_FLAG = MessageFlags ? MessageFlags.Ephemeral : 6;
const ONE_YEAR_MS = config.ONE_YEAR_MS || 31536000000;

class CommandContext {
    constructor(source, client, args = []) {
        this.source = source;
        this.client = client;
        this.isSlash = source.isChatInputCommand && source.isChatInputCommand();
        this.user = this.isSlash ? source.user : source.author;
        this.member = source.member;
        this.guild = source.guild;
        this.channel = source.channel;
        this.guildId = source.guildId || (source.guild ? source.guild.id : null);
        this.args = args;
        this.interaction = this.isSlash ? source : null;
        this.message = !this.isSlash ? source : null;
        this.replied = false;
        this.deferred = false;
        this.replyMessage = null;
    }

    async defer(ephemeral = false) {
        if (this.isSlash) {
            if (!this.source.deferred && !this.source.replied) {
                await this.source.deferReply({ ephemeral }).catch(() => {});
                this.deferred = true;
            }
        } else {
            // For prefix commands, we can optionally send a typing indicator
            if (this.channel && typeof this.channel.sendTyping === 'function') {
                this.channel.sendTyping().catch(() => {});
            }
        }
    }

    async reply(options) {
        let payload = options;
        if (typeof options === 'string') {
            payload = { content: options };
        }

        if (this.isSlash) {
            if (this.source.deferred || this.source.replied) {
                this.replyMessage = await this.source.editReply(payload).catch(() => null);
            } else {
                this.replyMessage = await this.source.reply(payload).catch(() => null);
            }
        } else {
            this.replyMessage = await this.source.reply(payload).catch(async () => {
                if (this.channel) return await this.channel.send(payload).catch(() => null);
                return null;
            });
        }
        this.replied = true;
        return this.replyMessage;
    }

    async editReply(options) {
        let payload = options;
        if (typeof options === 'string') {
            payload = { content: options };
        }

        if (this.isSlash) {
            this.replyMessage = await this.source.editReply(payload).catch(() => null);
        } else {
            if (this.replyMessage && typeof this.replyMessage.edit === 'function') {
                this.replyMessage = await this.replyMessage.edit(payload).catch(() => null);
            } else {
                this.replyMessage = await this.reply(payload);
            }
        }
        return this.replyMessage;
    }

    async send(options) {
        if (this.channel) {
            return await this.channel.send(options).catch(() => null);
        }
        return null;
    }

    // Helper to create collectors with 1-year high timeout
    create1YearCollector(messageOrReply, options = {}) {
        const target = messageOrReply || this.replyMessage;
        if (!target || typeof target.createMessageComponentCollector !== 'function') return null;

        const collectorOptions = {
            time: ONE_YEAR_MS,
            ...options
        };

        return target.createMessageComponentCollector(collectorOptions);
    }
}

module.exports = {
    CommandContext,
    ONE_YEAR_MS,
    EPHEMERAL_FLAG
};
