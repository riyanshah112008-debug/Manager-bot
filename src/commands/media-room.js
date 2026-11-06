'use strict';

const { SlashCommandBuilder, Routes } = require('discord.js');

module.exports = {
    name: 'media-room',
    category: 'Music',
    description: 'Launch the shared Manager Media Room Activity in your voice channel.',
    autoDefer: false,
    timeout: 15000,
    data: new SlashCommandBuilder()
        .setName('media-room')
        .setDescription('Open a shared music and video room for everyone in your voice channel.'),
    async execute(ctx, args, client) {
        if (!ctx.isSlash || !ctx.interaction) {
            return ctx.reply('Use the **/media-room** slash command from Discord to launch the shared Activity.');
        }
        if (!ctx.guild || !ctx.member?.voice?.channelId) {
            return ctx.reply('Join a voice channel first, then run **/media-room**.');
        }
        if (!process.env.CLIENT_ID && !process.env.APPLICATION_ID && !client.application?.id) {
            return ctx.reply('The Discord application ID is not configured. Set CLIENT_ID on the bot host.');
        }

        try {
            await client.rest.post(
                Routes.interactionCallback(ctx.interaction.id, ctx.interaction.token),
                { body: { type: 12 } }
            );
        } catch (error) {
            console.error('[Media Activity] Launch failed:', error?.message || error);
            if (!ctx.interaction.replied && !ctx.interaction.deferred) {
                await ctx.reply('I could not launch the Media Activity. Enable Activities for this Discord application and configure its Activity URL Mapping in the Developer Portal, then try again.');
            }
        }
    }
};
