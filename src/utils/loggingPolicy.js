'use strict';
const CATEGORY_FIELDS = Object.freeze({ ai: 'aiEnabled', moderate: 'moderationEnabled', messages: 'messagesEnabled', voice: 'voiceEnabled', access: 'membersEnabled', members: 'membersEnabled', roles: 'membersEnabled', channels: 'serverEnabled', misc: 'serverEnabled' });
const CHANNEL_FIELDS = Object.freeze({ ai: 'aiLogChannel', moderate: 'modLogChannel', messages: 'messageLogChannel', voice: 'voiceLogChannel', access: 'memberLogChannel', members: 'memberLogChannel', roles: 'memberLogChannel', channels: 'serverLogChannel', misc: 'serverLogChannel' });
function isLoggingAllowed(settings, type) {
 const logging = settings || {};
 const normalizedType = String(type || '').toLowerCase();
 const categoryField = CATEGORY_FIELDS[normalizedType] || 'serverEnabled';
 if (logging.enabled === false || logging[categoryField] === false) return false;
 if (normalizedType === 'ai' && logging.aiEnabled !== true) return false;
 return true;
}
function getLogChannelField(type) { return CHANNEL_FIELDS[String(type || '').toLowerCase()] || 'serverLogChannel'; }
module.exports = { CATEGORY_FIELDS, CHANNEL_FIELDS, isLoggingAllowed, getLogChannelField };
