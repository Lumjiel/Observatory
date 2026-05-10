// 音频工具
let _audioCtx = null;

export function initAudio() {
    _audioCtx = null;
}

export function playClickSound() {
    try {
        if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = _audioCtx.createOscillator();
        const gain = _audioCtx.createGain();
        osc.connect(gain);
        gain.connect(_audioCtx.destination);
        osc.frequency.value = 800;
        osc.type = 'square';
        gain.gain.value = 0.03;
        gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.08);
        osc.start(_audioCtx.currentTime);
        osc.stop(_audioCtx.currentTime + 0.08);
    } catch (e) {}
}