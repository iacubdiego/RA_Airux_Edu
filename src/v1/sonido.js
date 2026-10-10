/* Sonido de la v1, sin cambios salvo el volumen fijo (antes era un slider).
   Zumbido.iniciar() tiene que llamarse dentro del toque de inicio (iOS). */
const VOLUMEN = 0.8;

/* ═════════════════════════════════════════════════════════════════════
   SONIDO: zumbido sintetizado con Web Audio (sin archivos ni licencias)
   ═════════════════════════════════════════════════════════════════════ */
/* Convierte una muestra en un bucle sin corte: recorta el silencio final y funde el final
   con el principio (fundido de igual potencia), así no hay "clic" al reiniciar el loop. */
function bucleSinCorte(ctx, buf, segCruce) {
  const canales = [...Array(buf.numberOfChannels)].map((_, c) => buf.getChannelData(c));
  let fin = buf.length;
  while (fin > 0 && canales.every((d) => Math.abs(d[fin - 1]) < 1e-3)) fin--;
  const F = Math.min(Math.floor(segCruce * buf.sampleRate), Math.floor(fin / 3));
  const L = fin - F;
  const out = ctx.createBuffer(buf.numberOfChannels, L, buf.sampleRate);
  canales.forEach((src, c) => {
    const dst = out.getChannelData(c);
    dst.set(src.subarray(0, L));
    for (let j = 0; j < F; j++) {
      const t = (j / F) * Math.PI / 2;
      dst[j] = src[j] * Math.sin(t) + src[L + j] * Math.cos(t);
    }
  });
  return out;
}

/* ═════════════════════════════════════════════════════════════════════
   SONIDO: assets/zumbido.mp3 en bucle (dos capas para dar densidad);
   si no carga, zumbido sintetizado con Web Audio.
   ═════════════════════════════════════════════════════════════════════ */
export const Zumbido = {
  ctx: null, salida: null, master: null, filtro: null, capaB: null, modo: null, activo: true, solo: null,

  // Tiene que llamarse dentro del handler de un toque (iOS)
  iniciar() {
    // iOS 17+: sin esto, el switch de silencio apaga Web Audio
    if ('audioSession' in navigator) { try { navigator.audioSession.type = 'playback'; } catch (e) {} }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    // salida (volumen general y silencio) ← master (enjambre) + solista (una abeja)
    this.salida = ctx.createGain();
    this.salida.connect(ctx.destination);
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.salida);
    this.crearSolista();
    ctx.resume();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) ctx.suspend(); else ctx.resume();
    });
    this.cargarMuestra().catch((e) => {
      console.warn('No se pudo usar assets/zumbido.mp3, uso el zumbido sintetizado:', e);
      this.iniciarSintetico();
    });
  },

  async cargarMuestra() {
    const r = await fetch('./assets/zumbido.mp3');
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const datos = await r.arrayBuffer();
    // Forma con callbacks: la versión con promesa no existe en Safari viejos
    const buf = await new Promise((ok, mal) => this.ctx.decodeAudioData(datos, ok, mal));
    const bucle = bucleSinCorte(this.ctx, buf, 1.5);
    // Lejos = más apagado (pasabajos), cerca = más brillante
    this.filtro = this.ctx.createBiquadFilter();
    this.filtro.type = 'lowpass'; this.filtro.frequency.value = 6000;
    this.filtro.connect(this.master);
    const capa = (velocidad, desde, ganancia) => {
      const src = this.ctx.createBufferSource();
      src.buffer = bucle; src.loop = true; src.playbackRate.value = velocidad;
      const g = this.ctx.createGain(); g.gain.value = ganancia;
      src.connect(g); g.connect(this.filtro);
      src.start(0, desde % bucle.duration);
      return g;
    };
    capa(1, 0, 1);
    // Segunda capa desfasada y un poco más aguda: entra a medida que salen más abejas
    this.capaB = capa(1.07, bucle.duration / 2, 0);
    this.modo = 'muestra';
  },

  iniciarSintetico() {
    const ctx = this.ctx;
    // Formante del zumbido + recorte de agudos
    this.filtro = ctx.createBiquadFilter();
    this.filtro.type = 'bandpass'; this.filtro.frequency.value = 450; this.filtro.Q.value = 0.9;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    this.filtro.connect(lp); lp.connect(this.master);
    const trem = ctx.createGain(); trem.gain.value = 0.8; trem.connect(this.filtro);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 7.3;
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.18;
    lfo.connect(lfoG); lfoG.connect(trem.gain); lfo.start();
    [212, 219, 228, 241, 255].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      const vib = ctx.createOscillator(); vib.frequency.value = 0.25 + i * 0.17;
      const vibG = ctx.createGain(); vibG.gain.value = 3 + i;
      vib.connect(vibG); vibG.connect(o.frequency);
      const g = ctx.createGain(); g.gain.value = 0.11;
      o.connect(g); g.connect(trem);
      o.start(); vib.start();
    });
    this.modo = 'sintetico';
  },

  /* Una sola abeja sintetizada: sierra + cuadrada levemente desafinadas, con la rugosidad del
     aleteo (trémolo rápido) y un vibrato lento. Se mueve en estéreo y cambia de tono. */
  crearSolista() {
    const ctx = this.ctx;
    const o = {};
    o.gain = ctx.createGain(); o.gain.gain.value = 0;
    o.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (o.pan) { o.gain.connect(o.pan); o.pan.connect(this.salida); } else o.gain.connect(this.salida);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.1;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
    bp.connect(lp);
    const trem = ctx.createGain(); trem.gain.value = 0.75; trem.connect(o.gain);
    lp.connect(trem);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 23;               // rugosidad del aleteo
    const lfoG = ctx.createGain(); lfoG.gain.value = 0.22;
    lfo.connect(lfoG); lfoG.connect(trem.gain); lfo.start();
    o.osc = ['sawtooth', 'square'].map((tipo, i) => {
      const osc = ctx.createOscillator(); osc.type = tipo; osc.frequency.value = 230 * (1 + i * 0.006);
      const vib = ctx.createOscillator(); vib.frequency.value = 5.5 + i;
      const vibG = ctx.createGain(); vibG.gain.value = 4;
      vib.connect(vibG); vibG.connect(osc.frequency); vib.start();
      const g = ctx.createGain(); g.gain.value = i ? 0.12 : 0.3;
      osc.connect(g); g.connect(bp); osc.start();
      return osc;
    });
    this.solo = o;
  },

  // nivel 0..1, pan −1..1, frecuencia en Hz
  fijarSolista(nivel, pan, freq) {
    const o = this.solo;
    if (!o) return;
    const t = this.ctx.currentTime;
    o.gain.gain.setTargetAtTime(this.activo ? nivel * VOLUMEN * 0.6 : 0, t, 0.08);
    if (o.pan) o.pan.pan.setTargetAtTime(pan, t, 0.08);
    o.osc[0].frequency.setTargetAtTime(freq, t, 0.08);
    o.osc[1].frequency.setTargetAtTime(freq * 1.006, t, 0.08);
  },

  // Enjambre. nivel 0..1; brillo 0..1 (más cerca = más brillante); densidad 0..1 (fracción volando)
  fijar(nivel, brillo, densidad) {
    if (!this.ctx || !this.modo) return;
    const t = this.ctx.currentTime;
    const v = this.activo ? nivel * VOLUMEN : 0;
    if (this.modo === 'muestra') {
      this.master.gain.setTargetAtTime(v * 0.9, t, 0.25);
      this.filtro.frequency.setTargetAtTime(1800 + 7000 * brillo, t, 0.3);
      this.capaB.gain.setTargetAtTime(0.7 * densidad, t, 0.5);
    } else {
      this.master.gain.setTargetAtTime(v * 0.5, t, 0.25);
      this.filtro.frequency.setTargetAtTime(350 + 350 * brillo, t, 0.3);
    }
    if (this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume();
  },
};
