const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');

const sessions = new Map();
const LEVELS = [-6, -4, -2, 0, 2, 4, 6];
const BANDS = {
    subBass: { label: 'Sub-bass · 25–60 Hz', description: 'Deep rumble and low-end foundation' },
    bass: { label: 'Bass · 60–250 Hz', description: 'Kick impact and bass guitar weight' },
    mids: { label: 'Mids · 250 Hz–1 kHz', description: 'Body, warmth and instrument balance' },
    presence: { label: 'Presence · 1–4 kHz', description: 'Vocal clarity and attack' },
    treble: { label: 'Treble · 4–16 kHz', description: 'Air, detail and cymbal brightness' }
};
const PRESETS = {
    balanced: { subBass: 1, bass: 1, mids: 0, presence: 1, treble: 1 },
    bass: { subBass: 4, bass: 3, mids: -1, presence: 0, treble: 0 },
    vocal: { subBass: -1, bass: 0, mids: 1, presence: 3, treble: 1 },
    warm: { subBass: 2, bass: 3, mids: 1, presence: 0, treble: -1 },
    bright: { subBass: 0, bass: -1, mids: 0, presence: 2, treble: 3 }
};

function cleanGains(gains = {}) {
    return Object.fromEntries(Object.keys(BANDS).map(key => [
        key, Math.max(-6, Math.min(6, Number(gains[key]) || 0))
    ]));
}

function buildPanel(session) {
    const levels = Object.entries(BANDS).map(([key, band]) => {
        const value = session.gains[key] || 0;
        const filled = Math.round((value + 6) / 2);
        const meter = '▰'.repeat(filled) + '▱'.repeat(6 - filled);
        return `**${band.label}**  \`${value > 0 ? '+' : ''}${value} dB\`  ${meter}`;
    });
    const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('🎚️ Starry • 5-Band Equalizer')
        .setDescription([
            'Adjust a frequency band. Changes apply to the current track immediately.',
            '',
            ...levels,
            '',
            `**Selected band:** ${BANDS[session.band].label}`,
            '*Gain range: −6 to +6 dB. Boosts reserve headroom to reduce clipping.*'
        ].join('\n'))
        .setFooter({ text: 'EQ applies to this active playback session.' });
    const bandMenu = new StringSelectMenuBuilder()
        .setCustomId('music_eq_band')
        .setPlaceholder('Choose frequency band')
        .addOptions(Object.entries(BANDS).map(([value, band]) => ({
            label: band.label, description: band.description, value,
            default: session.band === value
        })));
    const gainMenu = new StringSelectMenuBuilder()
        .setCustomId('music_eq_gain')
        .setPlaceholder('Set selected band gain')
        .addOptions(LEVELS.map(value => ({
            label: `${value > 0 ? '+' : ''}${value} dB`,
            value: String(value),
            description: value === 0 ? 'Neutral' : value > 0 ? 'Boost this band' : 'Reduce this band',
            default: session.gains[session.band] === value
        })));
    const presetMenu = new StringSelectMenuBuilder()
        .setCustomId('music_eq_preset')
        .setPlaceholder('Quick sound profile')
        .addOptions([
            { label: 'Balanced Studio', value: 'balanced', description: 'Natural vocals, controlled bass and smooth highs' },
            { label: 'Deep Bass', value: 'bass', description: 'More sub-bass and punch without extreme boosts' },
            { label: 'Vocal Clarity', value: 'vocal', description: 'Clearer vocals and restrained low mids' },
            { label: 'Warm', value: 'warm', description: 'Full low end and relaxed presence' },
            { label: 'Bright', value: 'bright', description: 'More detail and air without excessive bass' }
        ]);
    const actions = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_eq_reset').setLabel('Reset EQ').setEmoji('↩️').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_eq_close').setLabel('Close').setStyle(ButtonStyle.Secondary)
    );
    return {
        embeds: [embed],
        components: [
            new ActionRowBuilder().addComponents(bandMenu),
            new ActionRowBuilder().addComponents(gainMenu),
            new ActionRowBuilder().addComponents(presetMenu),
            actions
        ]
    };
}

async function handleMusicEqualizer(interaction, { kazagumoPlayer, nativePlayer, ephemeralFlag }) {
    const customId = interaction.customId;
    const sessionKey = `${interaction.guildId}:${interaction.user.id}`;
    let session = sessions.get(sessionKey);

    if (customId === 'music_equalizer') {
        if (!kazagumoPlayer && !nativePlayer) {
            return interaction.reply({ content: '❌ No active music session. Start a song first.', flags: [ephemeralFlag] });
        }
        const stored = kazagumoPlayer?.data?.get('customEqualizer') || nativePlayer?.equalizer || {};
        session = { band: 'bass', gains: cleanGains(stored), updatedAt: Date.now() };
        sessions.set(sessionKey, session);
        if (sessions.size > 500) sessions.delete(sessions.keys().next().value);
        return interaction.reply({ ...buildPanel(session), flags: [ephemeralFlag] });
    }

    if (!session || Date.now() - session.updatedAt > 1800000) {
        return interaction.reply({ content: 'Equalizer panel expired. Reopen it from Now Playing.', flags: [ephemeralFlag] });
    }
    if (!kazagumoPlayer && !nativePlayer) {
        return interaction.reply({ content: 'Playback has ended. Start another song first.', flags: [ephemeralFlag] });
    }
    if (customId === 'music_eq_close') {
        sessions.delete(sessionKey);
        return interaction.update({ content: 'Equalizer closed.', embeds: [], components: [] });
    }
    if (customId === 'music_eq_band') {
        const selected = interaction.values?.[0];
        if (!Object.hasOwn(BANDS, selected)) {
            return interaction.reply({ content: 'Choose a valid frequency band.', flags: [ephemeralFlag] });
        }
        session.band = selected;
    } else {
        if (customId === 'music_eq_gain') {
            const gain = Number(interaction.values?.[0]);
            if (!LEVELS.includes(gain)) {
                return interaction.reply({ content: 'Choose a valid gain level.', flags: [ephemeralFlag] });
            }
            session.gains[session.band] = gain;
        } else if (customId === 'music_eq_preset') {
            const preset = PRESETS[interaction.values?.[0]];
            if (!preset) return interaction.reply({ content: 'Choose a valid sound profile.', flags: [ephemeralFlag] });
            session.gains = { ...preset };
        } else if (customId === 'music_eq_reset') {
            session.gains = cleanGains();
        } else {
            return interaction.reply({ content: 'Unknown equalizer action.', flags: [ephemeralFlag] });
        }

        let applied = true;
        if (kazagumoPlayer) {
            const { applyKazagumoEqualizer } = require('../utils/musicManager');
            applied = await applyKazagumoEqualizer(kazagumoPlayer, session.gains);
        }
        if (nativePlayer) applied = (await nativePlayer.setEqualizer(session.gains)) && applied;
        if (!applied) {
            return interaction.reply({ content: 'Starry could not apply the EQ change. Please retry.', flags: [ephemeralFlag] });
        }
    }

    session.updatedAt = Date.now();
    sessions.set(sessionKey, session);
    return interaction.update(buildPanel(session));
}

module.exports = { handleMusicEqualizer, cleanGains, buildPanel };
