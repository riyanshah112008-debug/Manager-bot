'use strict';

const OPEN_BUTTON_IDS = new Set([
    'starry:confession:open',
    'confess_btn_open'
]);

function isConfessionOpenButton(interaction) {
    return Boolean(
        interaction &&
        typeof interaction.isButton === 'function' &&
        interaction.isButton() &&
        OPEN_BUTTON_IDS.has(interaction.customId)
    );
}

async function routeConfessionOpenButton(interaction, buildModal) {
    if (!isConfessionOpenButton(interaction)) return false;

    // The main dispatcher owns this acknowledgement. The confession module's
    // listener sees this marker and skips the same interaction to avoid a
    // second showModal acknowledgement.
    if (interaction.__starryConfessionOpenHandled) return true;
    interaction.__starryConfessionOpenHandled = true;

    try {
        const createModal = typeof buildModal === 'function'
            ? buildModal
            : () => require('../modules/confession').buildConfessionModal();
        await interaction.showModal(createModal());
    } catch (error) {
        console.error('[Starry Confessions] Could not open confession modal:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: 'Starry could not open the confession form. Please try the button again.',
                flags: 64
            }).catch(() => {});
        }
    }
    return true;
}

module.exports = {
    isConfessionOpenButton,
    routeConfessionOpenButton
};
