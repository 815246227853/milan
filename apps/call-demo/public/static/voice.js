// Milan's voice for the family's screens (setup and dashboard).
// Tap the orb to talk; Milan stops listening by itself after a short pause, or on a second tap.
// Recording -> 16 kHz WAV -> the server (Sarvam speech-to-text). Replies come back as base64 WAV (Sarvam text-to-speech).
(function () {
  let ctx = null, stream = null, proc = null, analyser = null;
  let recording = false, chunks = [], onLevel = () => {}, onAutoStop = null;
  let heardSpeech = false, quietSince = 0, startedAt = 0, current = null;

  async function unlock() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    await ctx.resume();
    return ctx;
  }

  async function mic() {
    await unlock();
    if (stream) return;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const src = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = (e) => {
      if (!recording) return;
      const data = e.inputBuffer.getChannelData(0);
      chunks.push(new Float32Array(data));
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / data.length);
      onLevel(Math.min(1, rms * 9));
      // Simple pause detection: once they've spoken, ~1.3 s of quiet ends the turn.
      const now = performance.now();
      if (rms > 0.025) { heardSpeech = true; quietSince = 0; }
      else if (heardSpeech) {
        quietSince ||= now;
        if (now - quietSince > 1300 && onAutoStop) { const f = onAutoStop; onAutoStop = null; f(); }
      }
      if (now - startedAt > 25000 && onAutoStop) { const f = onAutoStop; onAutoStop = null; f(); } // hard limit
    };
    const mute = ctx.createGain();
    mute.gain.value = 0;
    src.connect(proc); proc.connect(mute); mute.connect(ctx.destination);
  }

  async function start({ level, autoStop } = {}) {
    await mic();
    stopPlayback();
    chunks = []; heardSpeech = false; quietSince = 0; startedAt = performance.now();
    onLevel = level || (() => {});
    onAutoStop = autoStop || null;
    recording = true;
  }

  function stop() {
    recording = false;
    onAutoStop = null;
    onLevel(0);
    return { wav: encodeWav(chunks, ctx.sampleRate, 16000), spoke: heardSpeech, seconds: chunks.length * 4096 / ctx.sampleRate };
  }

  function encodeWav(parts, inRate, outRate) {
    const len = parts.reduce((n, p) => n + p.length, 0);
    const all = new Float32Array(len);
    let o = 0;
    for (const p of parts) { all.set(p, o); o += p.length; }
    const ratio = inRate / outRate;
    const outLen = Math.floor(all.length / ratio);
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const s = Math.floor(i * ratio), e = Math.min(all.length, Math.floor((i + 1) * ratio));
      let sum = 0;
      for (let j = s; j < e; j++) sum += all[j];
      const v = Math.max(-1, Math.min(1, sum / Math.max(1, e - s)));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const buf = new ArrayBuffer(44 + pcm.length * 2);
    const v = new DataView(buf);
    const w = (off, str) => { for (let i = 0; i < str.length; i++) v.setUint8(off + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, outRate, true); v.setUint32(28, outRate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    new Int16Array(buf, 44).set(pcm);
    return new Blob([buf], { type: 'audio/wav' });
  }

  function stopPlayback() {
    if (current) { try { current.stop(); } catch {} current = null; }
  }

  // Play Milan's reply. level(0..1) is called while it plays, to animate the orb.
  async function play(b64, level = () => {}) {
    if (!b64) return;
    await unlock();
    stopPlayback();
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    let audio;
    try { audio = await ctx.decodeAudioData(bytes.buffer); } catch (e) { console.error(e); return; }
    const node = ctx.createBufferSource();
    node.buffer = audio;
    analyser ||= Object.assign(ctx.createAnalyser(), { fftSize: 512 });
    node.connect(analyser); analyser.connect(ctx.destination);
    current = node;
    const data = new Uint8Array(analyser.fftSize);
    let raf;
    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const x = (data[i] - 128) / 128; sum += x * x; }
      level(Math.min(1, Math.sqrt(sum / data.length) * 5));
      raf = requestAnimationFrame(tick);
    };
    return new Promise((resolve) => {
      node.onended = () => { cancelAnimationFrame(raf); level(0); if (current === node) current = null; resolve(); };
      node.start();
      tick();
    });
  }

  window.MilanVoice = { unlock, mic, start, stop, play, stopPlayback, get recording() { return recording; } };
})();

// The orb's markup, shared by both screens.
window.orbHTML = (id, label) => `<button class="orb" id="${id}" type="button" data-state="idle" aria-label="${label}">
  <span class="ring r3"></span><span class="ring r2"></span><span class="ring r1"></span>
  <span class="core"></span>
  <svg class="petals" viewBox="-50 -50 100 100" aria-hidden="true"><g fill="#FFF3D0">${Array.from({ length: 8 }, (_, i) => `<path transform="rotate(${i * 45})" d="M0 -6 Q-9 -24 0 -40 Q9 -24 0 -6Z"/>`).join('')}</g></svg>
  <span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></span>
</button>`;
