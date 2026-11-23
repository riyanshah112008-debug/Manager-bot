'use strict';

function allowsReminderDm(userSettings) {
    return !userSettings || userSettings.notifications !== false;
}

module.exports = { allowsReminderDm };
