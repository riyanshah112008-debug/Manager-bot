'use strict';

const { Events } = require('discord.js');
const { notifyGuild } = require('../utils/guildNotifications');

module.exports = client => {
    client.on(Events.GuildMemberAdd, member => {
        notifyGuild(client, member.guild.id, 'memberJoin', {
            content: '📥 ' + member.user.tag + ' joined the server.'
        }).catch(error => console.warn('[Notifications] Join notice failed:', error.message));
    });

    client.on(Events.GuildMemberRemove, member => {
        notifyGuild(client, member.guild.id, 'memberLeave', {
            content: '📤 ' + (member.user?.tag || member.id) + ' left the server.'
        }).catch(error => console.warn('[Notifications] Leave notice failed:', error.message));
    });

    console.log('🔔 Guild notification preferences connected.');
};
