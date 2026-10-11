/* Un día de la colmena en 24 segundos (1 s = 1 hora), desde la ficha de las celdas de carga.
   - Un sol cruza el cielo detrás de la colmena; las luces de la escena y un velo de color sobre
     toda la pantalla (también sobre el video) pasan de noche a amanecer, día y atardecer.
   - El enjambre sigue la hora: de noche no sale nadie, a la mañana salen, al atardecer vuelven.
   - El peso (de ejemplo) sigue la curva típica: baja a la mañana cuando salen las pecoreadoras,
     sube a la tarde con el néctar y baja un poco de noche cuando se evapora agua de la miel.
     Se dibuja en la ficha mientras pasa.
   - Al mediodía hace calor: ventilan en la entrada.
   Coordenadas del sol: grupo en mm de la colmena (+Z arriba). */
const THREE = AFRAME.THREE;

const DURACION_S = 24;
const HORA_INICIO = 5;
// [hora, kg] — curva de ejemplo, se interpola suave entre puntos
// (continua en la medianoche: el día termina con el mismo peso con que empezó)
const PESO = [[0, 41.5], [6, 41.32], [7, 41.3], [10, 40.95], [13, 41.3], [16, 41.8], [20, 41.9], [24, 41.5]];
// [hora, color del velo, opacidad] — el velo multiplica los colores de la pantalla
const CIELO = [[0, '#1b2a5c', 0.55], [5, '#1b2a5c', 0.5], [6.5, '#ff9a4d', 0.3], [8.5, '#ffffff', 0],
  [17, '#ffffff', 0], [19, '#ff8a3d', 0.3], [20.5, '#1b2a5c', 0.5], [24, '#1b2a5c', 0.55]];

const suave = (t) => t * t * (3 - 2 * t);
function interpolar(tabla, h, f) {
  for (let i = 0; i < tabla.length - 1; i++) {
    const [h0] = tabla[i], [h1] = tabla[i + 1];
    if (h >= h0 && h <= h1) return f(tabla[i], tabla[i + 1], suave((h - h0) / (h1 - h0)));
  }
  return f(tabla[tabla.length - 1], tabla[tabla.length - 1], 0);
}
export const pesoA = (h) => interpolar(PESO, h, (a, b, k) => a[1] + (b[1] - a[1]) * k);
const actividadA = (h) => THREE.MathUtils.smoothstep(h, 6.5, 9) * (1 - THREE.MathUtils.smoothstep(h, 17, 20));
const calorA = (h) => THREE.MathUtils.smoothstep(h, 12, 13.5) * (1 - THREE.MathUtils.smoothstep(h, 15.5, 17));

function texturaSol() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,250,220,1)');
  r.addColorStop(0.28, 'rgba(255,214,90,1)');
  r.addColorStop(0.45, 'rgba(255,177,41,.45)');
  r.addColorStop(1, 'rgba(255,177,41,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Dia {
  constructor({ colmena, v1, ventilacion, cielo, reloj, luzAmbiente, luzSol }) {
    Object.assign(this, { c: colmena, v1, ventilacion, cielo, reloj, luzAmbiente, luzSol });
    this.activo = false;
    this.sol = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaSol(), transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sol.scale.setScalar(26);
    this.sol.visible = false;
    colmena.mm.add(this.sol);
    this.original = null;
    this.tmp = { c: new THREE.Color(), c2: new THREE.Color() };
  }

  /* extra: el espacio de la ficha donde va el gráfico (puede cerrarse en el medio: no pasa nada) */
  iniciar(extra, lado = -1) {
    if (!this.original) {
      this.original = {
        amb: this.luzAmbiente?.intensity, sol: this.luzSol?.intensity,
        solPos: this.luzSol?.position.clone(), ambColor: this.luzAmbiente?.color.clone(),
      };
    }
    this.L = lado < 0 ? -1 : 1;
    this.t = 0;
    this.activo = true;
    this.extra = extra;
    this.reloj.hidden = false;
    if (extra) this.dibujarGrafico(extra);
  }

  dibujarGrafico(extra) {
    const W = 300, H = 96, pad = 14;
    // Eje X: horas desde el comienzo del time-lapse (de 5 a 5 del día siguiente)
    const kg = (x) => pesoA((HORA_INICIO + x) % 24);
    const pts = [];
    for (let x = 0; x <= 24; x += 0.5) pts.push([x, kg(x)]);
    const min = Math.min(...pts.map((p) => p[1])) - 0.1, max = Math.max(...pts.map((p) => p[1])) + 0.1;
    this.escala = { x: (x) => pad + (x / 24) * (W - 2 * pad), y: (v) => H - pad - ((v - min) / (max - min)) * (H - 2 * pad), kg };
    const linea = pts.map(([x, v]) => `${this.escala.x(x).toFixed(1)},${this.escala.y(v).toFixed(1)}`).join(' ');
    const marcas = [0, 6, 12, 18, 24].map((x) =>
      `<text x="${this.escala.x(x)}" y="${H - 2}" text-anchor="middle">${(HORA_INICIO + x) % 24} h</text>`).join('');
    extra.innerHTML = `
      <svg class="grafico-dia" viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso de la colmena durante un día">
        <polyline class="todo" points="${linea}"/>
        <polyline class="hecho" points=""/>
        <circle class="punto" r="4" cx="-10" cy="-10"/>
        ${marcas}
      </svg>
      <p class="ficha-nota">Peso de ejemplo durante un día: a la mañana baja (salen las pecoreadoras),
      a la tarde sube (vuelven con néctar) y de noche baja un poco (la miel pierde agua).</p>`;
    this.svg = extra.querySelector('svg');
  }

  detener() {
    this.activo = false;
    this.sol.visible = false;
    this.reloj.hidden = true;
    this.cielo.style.opacity = 0;
    this.v1()?.setActividad(1);
    this.ventilacion.setIntensidad(0);
    const o = this.original;
    if (o && this.luzAmbiente) {
      this.luzAmbiente.intensity = o.amb; this.luzAmbiente.color.copy(o.ambColor);
      this.luzSol.intensity = o.sol; this.luzSol.position.copy(o.solPos);
    }
  }

  tick(dt) {
    if (!this.activo) return;
    this.t += dt;
    const h = (HORA_INICIO + (this.t / DURACION_S) * 24) % 24;
    const fin = this.t >= DURACION_S;

    // Sol: de 6 a 18 h cruza un arco detrás de la colmena (del lado opuesto a la caja)
    const k = (h - 6) / 12;
    const deDia = k > 0 && k < 1;
    this.sol.visible = deDia;
    if (deDia) {
      const a = Math.PI * k;
      this.sol.position.set(-this.L * 110 * Math.cos(a), -this.L * 70, 10 + 95 * Math.sin(a));
    }
    const altura = deDia ? Math.sin(Math.PI * k) : 0;
    if (this.luzSol) {
      this.luzSol.intensity = 0.15 + 0.85 * altura;
      if (deDia) this.luzSol.position.set(-Math.cos(Math.PI * k), 0.6, Math.sin(Math.PI * k) + 0.2);
      this.luzAmbiente.intensity = 0.35 + 0.6 * altura;
      this.luzAmbiente.color.set(altura > 0.3 ? '#ffffff' : (deDia ? '#ffd2a1' : '#9fb0e0'));
    }

    // Velo de color sobre toda la pantalla
    const [color, op] = interpolar(CIELO, h, (a, b, f) => [
      '#' + this.tmp.c.set(a[1]).lerp(this.tmp.c2.set(b[1]), f).getHexString(), a[2] + (b[2] - a[2]) * f]);
    this.cielo.style.background = color;
    this.cielo.style.opacity = fin ? 0 : op;

    // Enjambre, ventilación y reloj
    this.v1()?.setActividad(actividadA(h));
    this.ventilacion.setIntensidad(calorA(h));
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 15) * 15;
    this.reloj.textContent = `${deDia ? '☀' : '🌙'} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

    // Gráfico y valor del peso en la ficha (si sigue abierta)
    if (this.svg?.isConnected) {
      const hasta = Math.min(24, (this.t / DURACION_S) * 24), E = this.escala;
      const pts = [];
      for (let x = 0; x <= hasta; x += 0.25) pts.push(`${E.x(x).toFixed(1)},${E.y(E.kg(x)).toFixed(1)}`);
      this.svg.querySelector('.hecho').setAttribute('points', pts.join(' '));
      const p = this.svg.querySelector('.punto');
      p.setAttribute('cx', E.x(hasta)); p.setAttribute('cy', E.y(E.kg(hasta)));
      const valor = this.svg.closest('#ficha')?.querySelector('.ficha-datos strong');
      if (valor) valor.textContent = `${pesoA(h).toLocaleString('es-AR', { maximumFractionDigits: 2 })} kg`;
    }
    if (fin) this.detener();
  }
}
