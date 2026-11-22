'use strict';

// Peak-safe FFmpeg DSP presets. Each profile uses one shared final limiter.
const FILTER_ARGS = {
    clear: ['-af', 'volume=1.0'],
    flat: ['-af', 'volume=1.0'],
    // Matches the gentle Lavalink Studio master: restrained low lift, vocal presence, smooth air.
    empowering: ['-af', 'volume=0.82,highpass=f=28:order=2,equalizer=f=40:width_type=q:w=0.9:g=0.6,equalizer=f=63:width_type=q:w=1.0:g=0.8,equalizer=f=110:width_type=q:w=1.0:g=0.4,equalizer=f=250:width_type=q:w=1.1:g=-0.8,equalizer=f=1600:width_type=q:w=1.0:g=0.2,equalizer=f=2500:width_type=q:w=1.0:g=0.2,equalizer=f=10000:width_type=q:w=0.8:g=0.1'],
    bass: ['-af', 'volume=0.78,highpass=f=28:order=2,bass=g=1.5:f=62:w=0.7,equalizer=f=250:width_type=q:w=1.1:g=-0.9'],
    '8d': ['-af', 'volume=0.92,apulsator=mode=sine:hz=0.125:amount=0.65:offset_l=0:offset_r=0.5'],
    nightcore: ['-af', 'volume=0.90,asetrate=48000*1.25,aresample=48000:resampler=swr:filter_size=32,atempo=1.0,equalizer=f=6000:width_type=q:w=1.0:g=-0.8'],
    daycore: ['-af', 'volume=0.86,asetrate=48000*0.85,aresample=48000:resampler=swr:filter_size=32,atempo=1.0,bass=g=1.0:f=65:w=0.7'],
    vaporwave: ['-af', 'volume=0.84,asetrate=48000*0.80,aresample=48000:resampler=swr:filter_size=32,atempo=1.0,aecho=0.8:0.85:50:0.20'],
    lofi: ['-af', 'volume=0.88,lowpass=f=4500,bass=g=1.0:f=95:w=0.7'],
    reverb: ['-af', 'volume=0.82,asetrate=48000*0.92,aresample=48000:resampler=swr:filter_size=32,atempo=1.0,aecho=0.8:0.85:60|120:0.22|0.16'],
    karaoke: ['-af', 'volume=0.92,stereotools=mlev=0.0:slev=1.0,equalizer=f=1000:width_type=q:w=1.5:g=-2.0'],
    surround: ['-af', 'volume=0.90,extrastereo=m=1.25,equalizer=f=3500:width_type=q:w=1.0:g=0.6'],
    electronic: ['-af', 'volume=0.78,bass=g=1.8:f=60:w=0.7,equalizer=f=280:width_type=q:w=1.2:g=-1.0,treble=g=1.0:f=9000:w=0.7'],
    soft: ['-af', 'volume=0.94,equalizer=f=7500:width_type=q:w=1.0:g=-1.5,equalizer=f=12000:width_type=q:w=1.0:g=-2.0'],
    radio: ['-af', 'volume=0.86,highpass=f=450,lowpass=f=3200,equalizer=f=1400:width_type=q:w=1.0:g=1.5'],
    treble: ['-af', 'volume=0.88,equalizer=f=8000:width_type=q:w=0.8:g=1.2,equalizer=f=12000:width_type=q:w=1.0:g=0.8'],
    pop: ['-af', 'volume=0.90,equalizer=f=220:width_type=q:w=1.2:g=-0.8,equalizer=f=1600:width_type=q:w=1.0:g=0.5,equalizer=f=3200:width_type=q:w=1.0:g=0.8']
};
// Aliases for seamless backwards compatibility
FILTER_ARGS.bassboost = FILTER_ARGS.bass;
FILTER_ARGS.vibrate = FILTER_ARGS.bass;
FILTER_ARGS.vibration = FILTER_ARGS.bass;
FILTER_ARGS.deepbass = FILTER_ARGS.bass;
FILTER_ARGS.subwoofer = FILTER_ARGS.bass;
FILTER_ARGS.slowed = FILTER_ARGS.daycore;
FILTER_ARGS['lo-fi'] = FILTER_ARGS.lofi;
FILTER_ARGS.chill = FILTER_ARGS.lofi;
FILTER_ARGS.slowreverb = FILTER_ARGS.reverb;
FILTER_ARGS.hall = FILTER_ARGS.reverb;
FILTER_ARGS.echo = FILTER_ARGS.reverb;
FILTER_ARGS.vocalremover = FILTER_ARGS.karaoke;
FILTER_ARGS.instrumental = FILTER_ARGS.karaoke;
FILTER_ARGS.vocalcut = FILTER_ARGS.karaoke;
FILTER_ARGS['3d'] = FILTER_ARGS.surround;
FILTER_ARGS.spatial = FILTER_ARGS.surround;
FILTER_ARGS.edm = FILTER_ARGS.electronic;
FILTER_ARGS.club = FILTER_ARGS.electronic;
FILTER_ARGS.mellow = FILTER_ARGS.soft;
FILTER_ARGS.relax = FILTER_ARGS.soft;
FILTER_ARGS.vintage = FILTER_ARGS.radio;

function getFilterArgs(filterName, volumePercent = 100, equalizer = null) {
    const rawFilter = (filterName && FILTER_ARGS[filterName]) ? FILTER_ARGS[filterName] : FILTER_ARGS.clear;
    const numericVolume = Number.isFinite(Number(volumePercent)) ? Number(volumePercent) : 100;
    const volScale = Math.max(0, Math.min(1.0, numericVolume / 100));
    const filterStr = rawFilter[1];
    const gains = equalizer && typeof equalizer === 'object' ? equalizer : null;
    const specs = [['subBass',45,0.8],['bass',110,0.8],['mids',500,0.9],['presence',2200,0.9],['treble',9000,0.8]];
    const positiveGainSum = gains ? specs.reduce((sum, [key]) => sum + Math.max(0, Math.min(6, Number(gains[key]) || 0)), 0) : 0;
    // Conservative preamp: overlapping EQ filters can stack. Keep 1.5 dB extra peak margin.
    const headroom = Math.pow(10, -(positiveGainSum > 0 ? (positiveGainSum + 1.5) : 0) / 20);
    const adjustedVolume = filterStr.replace(/volume=([0-9.]+)/,(match,baseVol)=>`volume=${(parseFloat(baseVol)*volScale*headroom).toFixed(3)}`);
    const eq = gains ? specs.map(([key,freq,width])=>{const gain=Math.max(-6,Math.min(6,Number(gains[key])||0));return gain===0?null:`equalizer=f=${freq}:width_type=q:w=${width}:g=${gain.toFixed(1)}`;}).filter(Boolean) : [];
    return ['-af',[
        'aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo',
        adjustedVolume,
        ...eq,
        'alimiter=limit=0.96:attack=5:release=180:level=false:latency=true',
        'aresample=48000:resampler=swr:filter_size=32:phase_shift=10'
    ].join(',')];
}

module.exports = { FILTER_ARGS, getFilterArgs };
