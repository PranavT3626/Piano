// paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function f() {
    log.history = log.history || [];
    log.history.push(arguments);
    if (this.console) {
        const args = arguments;
        args.callee = args.callee.caller;
        const newarr = Array.prototype.slice.call(args);
        if (typeof console.log === 'object') {
            log.apply.call(console.log, console, newarr);
        } else {
            console.log.apply(console, newarr);
        }
    }
};

// Make it safe to use console.log always
(function (a) {
    function b() {}
    for (const method of "assert,count,debug,dir,dirxml,error,exception,group,groupCollapsed,groupEnd,info,log,markTimeline,profile,profileEnd,time,timeEnd,trace,warn".split(",")) {
        a[method] = a[method] || b;
    }
})(window.console = window.console || {});

(function() {
    // Test if we can use blobs
    const canBlob = (() => {
        try {
            new Blob();
            return true;
        } catch (e) {
            return false;
        }
    })();

    const asBytes = (value, bytes) => {
        const result = [];
        for (; bytes > 0; bytes--) {
            result.push(String.fromCharCode(value & 255));
            value >>= 8;
        }
        return result.join('');
    };

    const attack = i => i < 200 ? (i / 200) : 1;

    const DataGenerator = $.extend(function(styleFn, volumeFn, cfg) {
        cfg = $.extend({
            freq: 440,
            volume: 32767,
            sampleRate: 11025, // Hz
            seconds: 0.5,
            channels: 1
        }, cfg);

        const data = [];
        const maxI = cfg.sampleRate * cfg.seconds;

        for (let i = 0; i < maxI; i++) {
            for (let j = 0; j < cfg.channels; j++) {
                data.push(
                    asBytes(
                        volumeFn(
                            styleFn(cfg.freq, cfg.volume, i, cfg.sampleRate, cfg.seconds, maxI),
                            cfg.freq, cfg.volume, i, cfg.sampleRate, cfg.seconds, maxI
                        ) * attack(i), 2
                    )
                );
            }
        }

        return data;
    }, {
        style: {
            wave: (freq, volume, i, sampleRate) => Math.sin((2 * Math.PI) * (i / sampleRate) * freq),
            squareWave: (freq, volume, i, sampleRate) => {
                const coef = sampleRate / freq;
                return (i % coef) / coef < 0.5 ? 1 : -1;
            },
            triangleWave: (freq, volume, i, sampleRate) => Math.asin(Math.sin((2 * Math.PI) * (i / sampleRate) * freq)),
            sawtoothWave: (freq, volume, i, sampleRate) => {
                const coef = sampleRate / freq;
                return -1 + 2 * ((i % coef) / coef);
            }
        },
        volume: {
            flat: (data, freq, volume) => volume * data,
            linearFade: (data, freq, volume, i, sampleRate, seconds, maxI) => volume * ((maxI - i) / maxI) * data,
            quadraticFade: (data, freq, volume, i, sampleRate, seconds, maxI) => volume * ((-1 / Math.pow(maxI, 2)) * Math.pow(i, 2) + 1) * data
        }
    });
    
    DataGenerator.style.default = DataGenerator.style.wave;
    DataGenerator.volume.default = DataGenerator.volume.linearFade;

    const toDataURI = (cfg) => {
        cfg = $.extend({
            channels: 1,
            sampleRate: 11025, // Hz
            bitDepth: 16, // bits/sample
            seconds: 0.5,
            volume: 20000,
            freq: 440
        }, cfg);

        const fmtChunk = [
            'fmt ', // sub-chunk identifier
            asBytes(16, 4), // chunk-length
            asBytes(1, 2), // audio format (1 is linear quantization)
            asBytes(cfg.channels, 2),
            asBytes(cfg.sampleRate, 4),
            asBytes(cfg.sampleRate * cfg.channels * cfg.bitDepth / 8, 4), // byte rate
            asBytes(cfg.channels * cfg.bitDepth / 8, 2),
            asBytes(cfg.bitDepth, 2)
        ].join('');

        const sampleData = DataGenerator(cfg.styleFn || DataGenerator.style.default, cfg.volumeFn || DataGenerator.volume.default, cfg);
        const samples = sampleData.length;

        const dataChunk = [
            'data', // sub-chunk identifier
            asBytes(samples * cfg.channels * cfg.bitDepth / 8, 4), // chunk length
            sampleData.join('')
        ].join('');

        const data = [
            'RIFF',
            asBytes(4 + (8 + fmtChunk.length) + (8 + dataChunk.length), 4),
            'WAVE',
            fmtChunk,
            dataChunk
        ].join('');

        if (canBlob) {
            const view = new Uint8Array(data.length);
            for (let i = 0; i < view.length; i++) {
                view[i] = data.charCodeAt(i);
            }
            const blob = new Blob([view], { type: 'audio/wav' });
            return window.webkitURL.createObjectURL(blob);
        } else {
            return `data:audio/wav;base64,${btoa(data)}`;
        }
    };

    const noteToFreq = stepsFromMiddleC => 440 * Math.pow(2, (stepsFromMiddleC + 3) / 12);

    const Notes = {
        sounds: {},
        getDataURI: (n, cfg = {}) => {
            cfg.freq = noteToFreq(n);
            return toDataURI(cfg);
        },
        getCachedSound: function (n, data) {
            let key = n;
            let cfg;

            if (data && typeof data === "object") {
                cfg = data;
                const l = Object.entries(data).flat().sort();
                key += '-' + l.join('-');
            } else if (typeof data !== 'undefined') {
                key = `${n}.${key}`;
            }

            let sound = this.sounds[key];
            if (!sound) {
                sound = this.sounds[key] = new Audio(this.getDataURI(n, cfg));
            }

            return sound;
        },
        noteToFreq
    };

    window.DataGenerator = DataGenerator;
    window.Notes = Notes;
})();
