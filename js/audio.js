/* 効果音（WebAudio）と 読み上げ（speechSynthesis）。どちらも 使えなくても ゲームは進む */
(function () {
  var KB = (window.KB = window.KB || {});
  var ctx = null;
  var muted = false;

  // 効果音の定義: 周波数のならび・長さ・波形・音量・ずらし時間
  var SOUNDS = {
    paddle: { freqs: [330], dur: 0.06, type: 'square', vol: 0.05, step: 0 },
    wall: { freqs: [240], dur: 0.04, type: 'square', vol: 0.03, step: 0 },
    break: { freqs: [520, 660], dur: 0.08, type: 'triangle', vol: 0.09, step: 0.03 },
    hard: { freqs: [180], dur: 0.07, type: 'square', vol: 0.06, step: 0 },
    bomb: { freqs: [160, 120, 90], dur: 0.16, type: 'sawtooth', vol: 0.1, step: 0.05 },
    item: { freqs: [660, 880], dur: 0.1, type: 'triangle', vol: 0.1, step: 0.06 },
    star: { freqs: [880, 1180], dur: 0.1, type: 'triangle', vol: 0.1, step: 0.05 },
    launch: { freqs: [400, 600], dur: 0.08, type: 'triangle', vol: 0.09, step: 0.05 },
    correct: { freqs: [523, 659, 784], dur: 0.16, type: 'triangle', vol: 0.12, step: 0.07 },
    ok: { freqs: [440, 587], dur: 0.14, type: 'triangle', vol: 0.1, step: 0.07 },
    wrong: { freqs: [200, 170], dur: 0.16, type: 'sawtooth', vol: 0.07, step: 0.09 },
    fever: { freqs: [392, 523, 659, 784, 1047], dur: 0.16, type: 'triangle', vol: 0.12, step: 0.07 },
    clear: { freqs: [523, 659, 784, 1047, 1319], dur: 0.2, type: 'triangle', vol: 0.13, step: 0.09 }
  };

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e) { /* 無視 */ } } return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
  }

  function tone(freq, dur, type, vol, delay) {
    if (muted || !ctx) return;
    try {
      var t0 = ctx.currentTime + delay;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type; osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (e) { /* 音が出なくても あそべる */ }
  }

  function play(name) {
    var s = SOUNDS[name];
    if (!s) return;
    s.freqs.forEach(function (f, i) { tone(f, s.dur, s.type, s.vol, i * s.step); });
  }

  function speak(text) {
    try {
      if (!window.speechSynthesis) return false;
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP'; u.rate = 0.9;
      window.speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  function stopSpeaking() {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* 無視 */ }
  }

  KB.Audio = {
    ensure: ensure,
    play: play,
    speak: speak,
    stopSpeaking: stopSpeaking,
    setMuted: function (flag) { muted = !!flag; if (muted) stopSpeaking(); },
    isMuted: function () { return muted; }
  };
})();
