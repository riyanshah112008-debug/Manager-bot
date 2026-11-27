'use strict';

const EQ_SPECS = Object.freeze([
    ['subBass', 45, 0.8],
    ['bass', 110, 0.8],
    ['mids', 500, 0.9],
    ['presence', 2200, 0.9],
    ['treble', 9000, 0.8]
]);

const DEFAULT_STUDIO_MASTER_FILTER = [
    'volume=0.90',
    'highpass=f=28',
    'equalizer=f=40:width_type=q:w=1.0:g=0.9',
    'equalizer=f=63:width_type=q:w=1.0:g=1.0',
    'equalizer=f=110:width_type=q:w=1.0:g=0.4',
    'equalizer=f=250:width_type=q:w=1.1:g=-1.0',
    'equalizer=f=1000:width_type=q:w=1.0:g=0.1',
    'equalizer=f=1600:width_type=q:w=1.0:g=0.35',
    'equalizer=f=2500:width_type=q:w=1.0:g=0.1',
    'equalizer=f=4000:width_type=q:w=1.0:g=-0.2',
    'equalizer=f=8000:width_type=q:w=0.9:g=-0.2',
    'equalizer=f=10000:width_type=q:w=0.8:g=0.1'
].join(',');

const DEFAULT_BASS_FILTER = [
    'volume=0.78',
    'bass=g=1.6:f=58:w=0.8',
    'equalizer=f=250:width_type=q:w=1.1:g=-1.0'
].join(',');


function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function normalizeStages(filterString) {
    return String(filterString || 'volume=1.0')
        .split(',')
        .map(stage => stage.trim())
        .filter(Boolean);
}

function getPositiveEqBoost(equalizer) {
    if (!equalizer || typeof equalizer !== 'object') return 0;
    return EQ_SPECS.reduce((sum, [key]) => {
        const raw = Number(equalizer[key]);
        return sum + Math.max(0, clamp(Number.isFinite(raw) ? raw : 0, 0, 6));
    }, 0);
}

function getHeadroom(positiveGainSum) {
    const headroomDb = positiveGainSum > 0 ? positiveGainSum + 2.5 : 0;
    return Math.pow(10, -headroomDb / 20);
}

function applyVolume(stages, volumePercent, headroom) {
    const numericVolume = Number(volumePercent);
    const volumeScale = clamp(Number.isFinite(numericVolume) ? numericVolume : 100, 0, 100) / 100;
    let foundVolume = false;
    const output = stages.map(stage => {
        const match = stage.match(/^volume=([0-9]*\.?[0-9]+)$/i);
        if (!match) return stage;
        foundVolume = true;
        const baseVolume = clamp(Number(match[1]), 0, 1);
        return `volume=${(baseVolume * volumeScale * headroom).toFixed(3)}`;
    });
    if (!foundVolume) output.unshift(`volume=${(volumeScale * headroom).toFixed(3)}`);
    return output;
}

function buildCustomEqStages(equalizer) {
    if (!equalizer || typeof equalizer !== 'object') return [];
    return EQ_SPECS.map(([key, frequency, width]) => {
        const raw = Number(equalizer[key]);
        const gain = clamp(Number.isFinite(raw) ? raw : 0, -6, 6);
        return gain === 0
            ? null
            : `equalizer=f=${frequency}:width_type=q:w=${width}:g=${gain.toFixed(1)}`;
    }).filter(Boolean);
}

function buildAudioFilterArgs(filterString, volumePercent = 100, equalizer = null) {
    const stages = normalizeStages(filterString);
    const headroom = getHeadroom(getPositiveEqBoost(equalizer));
    const adjustedStages = applyVolume(stages, volumePercent, headroom);
    const customEqStages = buildCustomEqStages(equalizer);
    // Keep the default path transparent: do not add a permanent limiter or resampler.
    // The encoder's -ar 48000 output option performs any required sample-rate conversion.
    // Apply only the requested profile and any explicit custom EQ stages.
    return ['-af', [...adjustedStages, ...customEqStages].join(',') || 'anull'];
}

module.exports = {
    DEFAULT_STUDIO_MASTER_FILTER,
    DEFAULT_BASS_FILTER,
    buildAudioFilterArgs
};
