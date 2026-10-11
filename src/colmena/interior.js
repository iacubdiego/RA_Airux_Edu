/* Interior de la colmena, para ver con los rayos X y para sacar un marco.

   - Panales: una lámina con textura de celdas hexagonales en cada cara de cada marco. Los tres
     marcos del centro tienen cría (con miel arriba y un anillo de polen); los de afuera, miel.
   - Reina y obreras: sobre el marco del centro.
   - Pilas AAA genéricas dentro de la caja estanca (para reemplazar después por el modelo real).
   - Sacar el marco: el marco del centro sube por encima de la tapa, se agranda un poco y gira
     para mostrar la cara con la reina a la cámara. Vuelve a su lugar al cerrar la ficha.

   Todo en mm, dentro del grupo de la colmena. Los marcos del STL vienen al revés (los listones
   de apoyo abajo); piezas.js los da vuelta con un giro de 180° en X, así que en coordenadas
   locales del marco la parte de arriba es −Z. */
const THREE = AFRAME.THREE;

const LAMINA = { ancho: 42, alto: 19.5, zCentro: 0.3, separacion: 0.06 };   // en coords locales del marco
const CRIA = { u: 0.5, v: 0.44, ru: 0.32, rv: 0.36 };                        // elipse de cría (en uv)
const SACAR = { subirMm: 38, escala: 1.35, duracion: 0.9, seguirCamara: 0.35 };

function aleatorio(semilla) {   // mulberry32, igual que en la v1
  let a = semilla >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Textura de panal. conCria: elipse de cría en el centro, anillo de polen y miel arriba.
   Sin cría: casi todo miel (operculada y abierta) con una franja de polen abajo. */
export function texturaPanal(conCria, semilla) {
  const W = 512, H = Math.round(512 * LAMINA.alto / LAMINA.ancho);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rnd = aleatorio(semilla);
  g.fillStyle = '#9a6e3a';                       // cera vieja entre celdas (más oscura que la cría)
  g.fillRect(0, 0, W, H);
  const r = 9.5, dx = r * Math.sqrt(3), dy = r * 1.5;
  const POLEN = ['#e8a33a', '#d9762b', '#f2d14a', '#b5612a', '#e9c24a'];
  const hex = (x, y, rr) => {
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = Math.PI / 6 + k * Math.PI / 3;
      g.lineTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    }
    g.closePath();
  };
  for (let fila = -1; fila * dy < H + r; fila++) {
    for (let col = -1; col * dx < W + r; col++) {
      const x = col * dx + (fila % 2 ? dx / 2 : 0), y = fila * dy;
      const u = x / W, v = 1 - y / H;            // v = 1 arriba, igual que la textura
      const e = Math.hypot((u - CRIA.u) / CRIA.ru, (v - CRIA.v) / CRIA.rv);
      let relleno, detalle = null;
      if (conCria && e < 1) {
        const p = rnd();
        if (p < 0.68) relleno = '#cf8f48';                                   // cría operculada
        else if (p < 0.9) { relleno = '#f6eedc'; detalle = 'larva'; }        // larva
        else { relleno = '#efe4c8'; detalle = 'huevo'; }                      // huevo
      } else if ((conCria && e < 1.28) || (!conCria && v < 0.3 && rnd() < 0.8)) {
        relleno = POLEN[Math.floor(rnd() * POLEN.length)];                    // polen
      } else if (v > 0.12 || rnd() < 0.5) {
        relleno = rnd() < 0.7 ? '#f2e2ae' : '#e3a02a';                        // miel: operculada / abierta
        if (relleno === '#e3a02a') detalle = 'brillo';
      } else {
        relleno = '#8a6a3c';                                                  // celda vacía
      }
      hex(x, y, r * 0.86);
      g.fillStyle = relleno; g.fill();
      if (detalle === 'larva') {
        g.strokeStyle = '#ffffff'; g.lineWidth = 2.2;
        g.beginPath(); g.arc(x, y, r * 0.38, 0.6, 5.4); g.stroke();
      } else if (detalle === 'huevo') {
        g.fillStyle = '#ffffff'; g.fillRect(x - 0.8, y - 2.5, 1.6, 5);
      } else if (detalle === 'brillo') {
        g.fillStyle = 'rgba(255,255,255,.45)';
        g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.18, 0, 6.3); g.fill();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* Abeja chica para el panal: largo en +Y (cabeza arriba), lomo hacia +Z. */
function abejita(largo, esReina) {
  const grupo = new THREE.Group();
  const oscuro = new THREE.MeshLambertMaterial({ color: '#301807' });
  const abd = new THREE.MeshLambertMaterial({ color: esReina ? '#b8742a' : '#d99a2b' });
  const esfera = new THREE.SphereGeometry(0.5, 12, 8);
  const pieza = (mat, sx, sy, sz, y) => {
    const m = new THREE.Mesh(esfera, mat);
    m.scale.set(sx, sy, sz); m.position.y = y;
    grupo.add(m);
    return m;
  };
  const L = largo, ab = esReina ? 0.62 : 0.5;
  pieza(abd, 0.34 * L, ab * L, 0.28 * L, -0.22 * L);               // abdomen (más largo en la reina)
  pieza(oscuro, 0.3 * L, 0.28 * L, 0.26 * L, 0.12 * L);             // tórax
  pieza(oscuro, 0.22 * L, 0.18 * L, 0.2 * L, 0.34 * L);             // cabeza
  // Rayas del abdomen
  for (let k = 0; k < 3; k++) pieza(oscuro, 0.35 * L, 0.05 * L, 0.29 * L, (-0.12 - 0.12 * k) * L);
  if (esReina) {   // punto de pintura en el tórax, como las reinas marcadas por el apicultor
    const punto = pieza(new THREE.MeshBasicMaterial({ color: '#fdf6e3' }), 0.12 * L, 0.12 * L, 0.06 * L, 0.12 * L);
    punto.position.z = 0.13 * L;
  }
  return grupo;
}

/* Pilas AAA genéricas: cuerpo oscuro, banda cobre y borne. Largo en X. */
function pila() {
  const g = new THREE.Group();
  const cil = (r, l, color, x) => {
    const geo = new THREE.CylinderGeometry(r, r, l, 16);
    geo.rotateZ(Math.PI / 2);                       // de Y (three) a X
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    m.position.x = x;
    g.add(m);
  };
  cil(1.05, 6.4, '#1f2937', -0.6);
  cil(1.06, 1.6, '#c58b3a', 3.4);
  cil(0.45, 0.5, '#c0c0c0', 4.45);
  return g;
}

export class Interior {
  constructor(colmena) {
    this.c = colmena;
    this.elegibles = [];      // mallas que se pueden tocar: userData.punto o userData.panal
    this.sacado = null;       // estado del marco que sale
    this.tmp = { cam: new THREE.Vector3(), centro: new THREE.Vector3() };
  }

  decorar() {
    const marcos = this.c.marcos;
    const iCentro = Math.floor(marcos.length / 2);
    const tex = { cria: texturaPanal(true, 11), miel: texturaPanal(false, 23) };
    const mats = {
      cria: new THREE.MeshLambertMaterial({ map: tex.cria, polygonOffset: true, polygonOffsetFactor: -1 }),
      miel: new THREE.MeshLambertMaterial({ map: tex.miel, polygonOffset: true, polygonOffsetFactor: -1 }),
    };
    const lamina = new THREE.PlaneGeometry(LAMINA.ancho, LAMINA.alto);

    marcos.forEach((m, i) => {
      m.userData.punto = 'marcos';
      this.elegibles.push(m);
      const t = m.geometry.boundingBox.max.x;          // medio espesor (la geometría está centrada)
      const tipo = Math.abs(i - iCentro) <= 1 ? 'cria' : 'miel';
      // Una lámina por cara. Base: u a lo largo del marco, v hacia arriba (−Z local), normal hacia afuera
      for (const lado of [1, -1]) {
        const p = new THREE.Mesh(lamina, mats[tipo]);
        p.matrixAutoUpdate = false;
        p.matrix.makeBasis(new THREE.Vector3(0, -lado, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(lado, 0, 0))
          .setPosition(lado * (t + LAMINA.separacion), 0, LAMINA.zCentro);
        p.userData.panal = tipo;
        p.userData.lado = lado;
        m.add(p);
        this.elegibles.push(p);
      }
    });

    // Reina y obreras sobre el marco del centro, cara +X
    const centro = marcos[iCentro];
    const sobreCara = (bicho, u, v, giro, lado = 1) => {
      const t = centro.geometry.boundingBox.max.x;
      const m = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -lado, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(lado, 0, 0))
        .setPosition(lado * (t + 0.5), (0.5 - u) * LAMINA.ancho * lado, LAMINA.zCentro - (v - 0.5) * LAMINA.alto)
        .multiply(new THREE.Matrix4().makeRotationZ(giro));
      bicho.matrixAutoUpdate = false;
      bicho.matrix.copy(m);
      bicho.traverse((o) => { if (o.isMesh) o.userData.punto = 'cria_reina'; });
      centro.add(bicho);
      bicho.traverse((o) => o.isMesh && this.elegibles.push(o));
    };
    sobreCara(abejita(4.2, true), CRIA.u + 0.03, CRIA.v, 0.3);
    const rnd = aleatorio(5);
    for (let k = 0; k < 7; k++) {
      sobreCara(abejita(2.8, false), 0.15 + 0.7 * rnd(), 0.2 + 0.65 * rnd(), rnd() * 6.28, k % 3 === 2 ? -1 : 1);
    }
    this.iCentro = iCentro;

    // Pilas dentro de la caja estanca (coordenadas del STL de la caja: X ancho, Y alto, Z espesor)
    const caja = this.c.partes.get('caja').mallas[0];
    [-2.6, 0, 2.6].forEach((y) => {
      const p = pila();
      p.position.set(0, y, 0.15);
      p.traverse((o) => { if (o.isMesh) { o.userData.punto = 'caja'; this.elegibles.push(o); } });
      caja.add(p);
    });
  }

  /* Toque en el interior. dentro: si el toque cayó dentro del círculo de la linterna.
     Fuera del círculo solo se puede tocar el marco que está afuera de la colmena. */
  elegir(raycaster, dentro) {
    const hits = raycaster.intersectObjects(this.elegibles, false);
    for (const h of hits) {
      const enSacado = this.sacado && this.esDelSacado(h.object);
      if (!dentro && !enSacado) continue;
      if (h.object.userData.panal) {
        if (h.object.userData.panal === 'miel' || !h.uv) return 'panal';
        const e = Math.hypot((h.uv.x - CRIA.u) / CRIA.ru, (h.uv.y - CRIA.v) / CRIA.rv);
        return e < 1 ? 'cria_reina' : 'panal';
      }
      return h.object.userData.punto || null;
    }
    return null;
  }

  esDelSacado(o) {
    const m = this.c.marcos[this.iCentro];
    for (let p = o; p; p = p.parent) if (p === m) return true;
    return false;
  }

  /* Saca (o devuelve) el marco del centro */
  sacar(si) {
    if (si && !this.sacado) this.sacado = { k: 0, objetivo: 1, giro: 0, iniciado: false };
    else if (this.sacado) this.sacado.objetivo = si ? 1 : 0;
  }

  /* Al terminar "de huevo a abeja" en la ficha: una abeja nueva sale del panal del marco que
     está afuera (de la zona de cría), se aleja de la cara y sube. */
  nacer() {
    if (!this.sacado || this.sacado.k < 0.9 || this.nacimiento) return false;
    const marco = this.c.marcos[this.iCentro];
    const t = marco.geometry.boundingBox.max.x;
    const b = abejita(2.8, false);
    b.matrixAutoUpdate = false;
    // Misma base que la lámina de la cara +X: u a lo largo del marco, v hacia arriba (−Z local)
    const base = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1), new THREE.Vector3(1, 0, 0))
      .setPosition(t + 0.5, (0.5 - (CRIA.u - 0.12)) * LAMINA.ancho, LAMINA.zCentro - (CRIA.v - 0.5) * LAMINA.alto);
    marco.add(b);
    this.nacimiento = { b, base, t: 0, marco };
    return true;
  }

  tickNacimiento(dt) {
    const n = this.nacimiento;
    if (!n) return;
    n.t += dt;
    const t = n.t;
    const S = THREE.MathUtils.smoothstep;
    const aparece = S(t, 0, 0.6), sale = S(t, 0.6, 2.0), desaparece = 1 - S(t, 2.0, 2.5);
    // En coordenadas de la lámina: +Z sale de la cara, +Y es arriba
    const m = new THREE.Matrix4().makeTranslation(0, 10 * sale, 8 * sale)
      .multiply(new THREE.Matrix4().makeRotationX(0.9 * sale))   // la cabeza gira hacia afuera mientras sale
      .scale(new THREE.Vector3().setScalar(Math.max(0.001, aparece * desaparece)));
    n.b.matrix.multiplyMatrices(n.base, m);
    n.b.matrixWorldNeedsUpdate = true;
    if (t >= 2.5 || !this.sacado) { n.marco.remove(n.b); this.nacimiento = null; }
  }

  tick(dt, camara) {
    this.tickNacimiento(dt);
    const s = this.sacado;
    if (!s) return;
    const m = this.c.marcos[this.iCentro];
    const base = m.userData.base;
    if (!base) return;
    const paso = dt / SACAR.duracion;
    s.k = s.objetivo > s.k ? Math.min(1, s.k + paso) : Math.max(0, s.k - paso);
    const k = s.k < 0.5 ? 4 * s.k ** 3 : 1 - (-2 * s.k + 2) ** 3 / 2;

    // Hacia dónde está la cámara, en el plano de la mesa (coordenadas del grupo en mm)
    camara.getWorldPosition(this.tmp.cam);
    this.c.mm.worldToLocal(this.tmp.cam);
    const c = this.tmp.centro.set(this.c.ejeMm.x, this.c.ejeMm.y, 0);
    let giro = Math.atan2(this.tmp.cam.y - c.y, this.tmp.cam.x - c.x);   // la cara +X mira a la cámara
    if (!s.iniciado) { s.giro = giro; s.iniciado = true; }
    let dg = giro - s.giro;
    dg = Math.atan2(Math.sin(dg), Math.cos(dg));
    s.giro += dg * (1 - Math.exp(-dt / SACAR.seguirCamara));

    // Sube por encima de la tapa, se centra sobre la colmena, gira y se agranda
    const hM = m.geometry.boundingBox.max.z * 2;
    const arriba = SACAR.subirMm + hM / 2;
    const subida = Math.min(1, k * 1.6);                  // primero sube, después gira
    const giroK = THREE.MathUtils.smoothstep(k, 0.35, 1);
    m.position.set(
      THREE.MathUtils.lerp(base.p.x, c.x, giroK),
      THREE.MathUtils.lerp(base.p.y, c.y, giroK),
      base.p.z + arriba * subida);
    m.rotation.set(Math.PI, 0, base.rz + giroK * s.giro);
    m.scale.setScalar(1 + (SACAR.escala - 1) * giroK);
    if (s.k === 0 && s.objetivo === 0) {                 // volvió: queda como lo dejó colocar()
      m.position.copy(base.p); m.rotation.set(Math.PI, 0, base.rz); m.scale.setScalar(1);
      this.sacado = null;
    }
  }
}
