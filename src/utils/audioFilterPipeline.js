'use strict';

const EQ_SPECS = Object.freeze([
    ['subBass', 45, 0.8],
    ['bass', 110, 0.8],
    ['mids', 500, 0.9],
    ['presence', 2200, 0.9],
    ['treble', 9000, 0.8]
]);

const FINAL_LIMITER = 'alimiter=limit=0.90:attack=5:release=240:level=false';
const FINAL_RESAMPLER = 'aresample=48000:resampler=swr:filter_size=64:phase_shift=10';

function buildAudioFilterArgs(filterString, volumePercent = 100, equalizer = null) {
    const source = String(filterString || 'volume=1.0');
    const stages = source
        .split(',')
        .map(stage => stage.trim())
        .filter(stage => stage && !/^alimiter=/i.test(stage));

    const requestedVolume = Number.isFinite(Number(volumePercent))
        ? Math.max(0, Math.min(100, Number(volumePercent)))
        : 100;
    const volumeScale = requestedVolume / 100;
    const hasCustomEqualizer = equalizer && typeof equalizer === 'object';
    const positiveGainSum = hasCustomEqualizer
        ? EQ_SPECS.reduce((sum, [key]) => {
            const value = Number(equalizer[key]);
            return sum + Math.max(0, Math.min(6, Number.isFinite(value) ? value : 0));
        }, 0)
        : 0;
    // Reserve the sum of overlapping custom-EQ boosts plus 2.5 dB of transient headroom.
    const headroomDb = positiveGainSum > 0 ? positiveGainSum + 2.5 : 0;
    const headroom = Math.pow(10, -headroomDb / 20);

    let foundVolume = false;
    const adjustedStages = stages.map(stage => {
        const match = stage.match(/^volume=([0-9]*\.?[0-9]+)$/i);
        if (!match) return stage;
        foundVolume = true;
        const baseVolume = Math.max(0, Math.min(1, Number(match[1])));
        return `volume=${(baseVolume * volumeScale * headroom).toFixed(3)}`;
    });
    if (!foundVolume) adjustedStages.unshift(`volume=${(volumeScale * headroom).toFixed(3)}`);

    const customEqStages = hasCustomEqualizer
        ? EQ_SPECS.map(([key, frequency, width]) => {
            const raw = Number(equalizer[key]);
            const gain = Math.max(-6, Math.min(6, Number.isFinite(raw) ? raw : 0));
            return gain === 0
                ? null
                : `equalizer=f=${frequency}:width_type=q:w=${width}:g=${gain.toFixed(1)}`;
        }).filter(Boolean)
        : [];

    // The limiter is deliberately last, after resampling, to catch peaks created by conversion.
    return ['-af', [
        ...adjustedStages,
        ...customEqStages,
        FINAL_RESAMPLER,
        FINAL_LIMITER
    ].join(',')];
}

module.exports = { buildAudioFilterArgs };
