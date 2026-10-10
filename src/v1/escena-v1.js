/* Escena de la v1 (abejas, flores, logo con la abeja grande y sonido), casi sin cambios.
   Viene de colmena-airux-v1/index.html; lo marcado "(nuevo)" es lo agregado para el proyecto
   educativo: tocar flores y la abeja destacada que vuelve con polen.

   Coordenadas: las de la v1, en u (1 u = ancho de la tapa = 46,6 mm), origen en el centro de la
   cara superior de la tapa, +Z hacia arriba. Las medidas físicas llegan del panel en mm y las
   convierte recalibrar().

   Los valores de diseño (cantidad de abejas, flores, tiempos) quedan acá como constantes: ya no
   están en el panel de calibración. */
import { PALETA } from '../config.js';
import { Zumbido } from './sonido.js';

const THREE = AFRAME.THREE;
const MAX_ABEJAS = 150;
const MAX_FLORES = 30;

const CONFIG = {
  // Pieza física
  markerMm: 46.6,        // ancho real de la cara superior de la tapa (= 1 u)
  altoColmenaMm: 50.6,   // de la cara superior de la tapa hasta la mesa
  ejeX: 0, ejeY: 0,      // desfase del eje de la colmena respecto del centro de la tapa (u)
  patasEnX: true,        // las placas-pata del soporte quedan en los extremos ±X

  // Enjambre
  abejas: 40,
  abejasIniciales: 5,    // cuántas salen juntas apenas se detecta la tapa
  intervaloSeg: 0.6,     // después, tiempo entre una abeja nueva y la siguiente (0 = todas juntas)
  reiniciarTrasSeg: 15,  // si se pierde la tapa más que esto, la animación vuelve a empezar (0 = nunca)
  alasOpacidad: 0.8,
  abejaLuz: 0.72,        // luminosidad del naranja de las abejas respecto del logo (1 = igual)
  abejaSat: 0.7,         // saturación respecto del logo (1 = igual)
  tamanoMm: 5,           // largo de cada abeja (a escala 1:10 serían 1,5 mm: exageradas a propósito)
  velocidad: 1,
  // Viaje de cada abeja: logo → su flor → logo
  ondulacion: 1,         // cuánto zigzaguean en el camino (0 = curva lisa)
  arco: 0.35,            // cuánto suben en la mitad del viaje (u)
  florSeg: 3,            // tiempo medio sobre la flor (s)
  escenaSuavizado: 0.12, // anti-temblor de abejas y flores (s); la colmena invisible no se filtra

  // Flores (sobre la mesa, a los costados ±X de la colmena)
  flores: 10,
  florDistMin: 1.2, florDistMax: 2.2,      // distancia lateral al eje de la colmena (u): ~5,5 a 10 cm
  florAlturaMin: 0.45, florAlturaMax: 0.85, // largo del tallo (u)
  florTamano: 1.3,
  florSemilla: 7,        // cambia la disposición y la mezcla de tipos
  pasto: 40,             // briznas de pasto alrededor de cada planta
  viento: 0.05,          // vaivén de flores y pasto (u en la punta de algo de 1 u de alto)

  // Zona de salida (en coordenadas de la tapa; 0,0 = centro del logo)
  emisorX: 0, emisorY: 0, emisorRadio: 0.3,

  // Logo
  mostrarLogo: true,
  logo3D: true,          // true = modelo en relieve (assets/logo.glb); false = imagen plana (assets/logo.png)
  logoModo: 'tapa',      // 'tapa' = cartel fijo a la tapa | 'pantalla' = fijo arriba en la pantalla
  logoDesdeSeg: 4,       // cuándo aparece, contado desde que empieza la animación
  // Solo modo 'tapa'. Con giro 0 el cartel está del lado de las alas (+Y) y mira hacia −Y,
  // o sea hacia quien lee la "a" impresa derecha.
  logoAltura: 0.75,      // altura del centro del cartel sobre la tapa (u)
  logoDistancia: 0.75,   // cuánto se corre hacia +Y desde el centro de la tapa (u)
  logoInclinacion: 30,   // cuánto se recuesta hacia atrás (0 = vertical, 90 = acostado)
  logoGiro: 0,           // gira cartel y posición alrededor del eje de la colmena (grados)
  logoAncho: 2.0,        // ancho (u)
  logoSuavizado: 0.25,   // filtro anti-temblor en segundos (0 = sin filtro; más = más quieto pero con retraso)

  // Abeja grande: la abeja del logo sale de la tapa, da una vuelta y se posa en su lugar del logo
  // (solo con el logo 3D en modo 'tapa')
  abejaGrande: true,
  abejaGrandeDesdeSeg: 5,      // cuándo sale de la tapa
  abejaGrandeEscala: 1.6,      // tamaño en vuelo respecto del logo (al posarse vuelve a 1)
  abejaGrandeVelocidad: 1,     // >1 = vuelo más corto
  abejaGrandeRadio: 1.3,       // radio de la vuelta alrededor de la colmena (u)
  abejaGrandeAltura: 1.0,      // altura de la vuelta (u)

  // Sonido
  volumen: 0.8,
};


/* ═════════════════════════════════════════════════════════════════════
   UTILIDADES
   ═════════════════════════════════════════════════════════════════════ */
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mod = (a, n) => ((a % n) + n) % n;
/* Curva de Hermite: va de p0 a p1 en T segundos, con velocidad v0 al salir y v1 al llegar.
   Encadenando tramos con la misma velocidad en la unión, el movimiento no tiene quiebres. */
function hermite(p0, v0, p1, v1, T, s, out) {
  const s2 = s * s, s3 = s2 * s;
  const a = 2 * s3 - 3 * s2 + 1, b = (s3 - 2 * s2 + s) * T, c = -2 * s3 + 3 * s2, d = (s3 - s2) * T;
  return out.set(a * p0.x + b * v0.x + c * p1.x + d * v1.x,
                 a * p0.y + b * v0.y + c * p1.y + d * v1.y,
                 a * p0.z + b * v0.z + c * p1.z + d * v1.z);
}
/* Aleatorio con semilla (mulberry32): misma semilla → mismas flores */
function aleatorio(semilla) {
  let a = semilla >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bezier(p0, p1, p2, p3, t, out) {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return out.set(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
    a * p0.z + b * p1.z + c * p2.z + d * p3.z);
}

/* Geometría de una abeja, largo ≈ 1. Ejes locales: +Z adelante, +Y arriba, +X derecha. */
function geometriaAbeja() {
  const NARANJA = 0, MARRON = 1;   // tipo de cada vértice; los colores se aplican en pintarAbeja()

  const cuerpo = new THREE.SphereGeometry(0.5, 18, 12).toNonIndexed();
  cuerpo.scale(0.34, 0.34, 0.86); cuerpo.translate(0, 0, -0.06);
  const cabeza = new THREE.SphereGeometry(0.15, 10, 8).toNonIndexed();
  cabeza.translate(0, 0.02, 0.44);

  const partes = [
    [cuerpo, (z) => {
      if (z > 0.08) return MARRON;                                         // tórax
      if (z < -0.42) return MARRON;                                        // aguijón
      return Math.floor((0.08 - z) / 0.1) % 2 === 0 ? NARANJA : MARRON;   // rayas del abdomen
    }],
    [cabeza, () => MARRON],
  ];
  const pos = [], nor = [], tipos = [];
  for (const [g, colorDe] of partes) {
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      tipos.push(colorDe(p.getZ(i)));
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(tipos.length * 3), 3));
  geo.userData.tipos = tipos;
  pintarAbeja(geo);
  return geo;
}

/* Colores de la abeja: el naranja del logo, apagado según CONFIG.abejaLuz / abejaSat */
function colorNaranjaAbeja() {
  const hsl = {};
  const c = new THREE.Color(PALETA.naranja);
  c.getHSL(hsl, THREE.SRGBColorSpace);
  return c.setHSL(hsl.h, clamp(hsl.s * CONFIG.abejaSat, 0, 1), clamp(hsl.l * CONFIG.abejaLuz, 0, 1),
    THREE.SRGBColorSpace);
}
function pintarAbeja(geo) {
  const cols = [colorNaranjaAbeja(), new THREE.Color(PALETA.marron)];
  const attr = geo.attributes.color;
  geo.userData.tipos.forEach((t, i) => attr.setXYZ(i, cols[t].r, cols[t].g, cols[t].b));
  attr.needsUpdate = true;
}

/* Ala derecha: elipse acostada en el plano XZ, con la raíz en el origen y la punta hacia +X */
function geometriaAla() {
  const g = new THREE.CircleGeometry(0.5, 14);
  g.scale(0.58, 0.26, 1);
  g.translate(0.29, 0, 0);
  g.rotateX(-Math.PI / 2);
  return g;
}

/* ═════════════════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL: va sobre la entidad mindar-image-target
   ═════════════════════════════════════════════════════════════════════ */
/* ═════════════════════════════════════════════════════════════════════
   PLANTAS: geometrías paramétricas con colores por vértice. Todas se juntan
   en una sola malla (Mezclador) → una sola llamada de dibujo para el jardín.
   ═════════════════════════════════════════════════════════════════════ */

/* Tira paramétrica para pétalos, hojas y briznas.
   Local: nace en el origen y crece hacia +X, ancho en Y, "arriba" en +Z.
   o = { largo, ancho, perfil(s), copa, arco, pliegue, muesca, colorBase, colorPunta, segL, segA } */
function geoTira(o) {
  const segL = o.segL || 6, segA = o.segA || 4;
  const pos = [], col = [], idx = [];
  const cb = new THREE.Color(o.colorBase), cp = new THREE.Color(o.colorPunta), c = new THREE.Color();
  for (let i = 0; i <= segL; i++) {
    const s = i / segL;
    const mitad = 0.5 * o.ancho * o.perfil(s);
    for (let j = 0; j <= segA; j++) {
      const u = (j / segA) * 2 - 1;                       // −1 a 1 a lo ancho
      let x = o.largo * s;
      if (o.muesca) x -= o.muesca * o.largo * (1 - Math.abs(u)) * smooth(0.75, 1, s);   // punta con muesca
      const y = u * mitad;
      const z = (o.copa || 0) * u * u * mitad                // ahuecado a lo ancho
        + (o.arco || 0) * s * s * o.largo                     // se curva a lo largo (− = cae)
        - (o.pliegue || 0) * Math.abs(u) * mitad;             // pliegue en V (nervio central)
      pos.push(x, y, z);
      c.copy(cb).lerp(cp, Math.pow(s, 0.7));
      col.push(c.r, c.g, c.b);
    }
  }
  const fila = segA + 1;
  for (let i = 0; i < segL; i++) for (let j = 0; j < segA; j++) {
    const a = i * fila + j, b = a + fila;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/* Le pone color a una geometría de three (tallo, centro, cáliz). colorDe(x, y, z) → THREE.Color */
function pintar(g, colorDe) {
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const c = colorDe(p.getX(i), p.getY(i), p.getZ(i));
    col[3 * i] = c.r; col[3 * i + 1] = c.g; col[3 * i + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/* Junta muchas geometrías (con su matriz) en una sola. aFlex = cuánto se mueve con el viento:
   por defecto la altura sobre la mesa; una geometría puede traer su propio aFlex (las briznas). */
class Mezclador {
  constructor(zMesa) { this.zMesa = zMesa; this.pos = []; this.nor = []; this.col = []; this.flex = []; this.idx = []; }
  agregar(g, m, flexExtra = 1) {
    const p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color, f = g.attributes.aFlex;
    const nm = new THREE.Matrix3().getNormalMatrix(m), v = new THREE.Vector3(), w = new THREE.Vector3();
    const base = this.pos.length / 3;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m);
      w.fromBufferAttribute(n, i).applyMatrix3(nm).normalize();
      this.pos.push(v.x, v.y, v.z); this.nor.push(w.x, w.y, w.z);
      this.col.push(c.getX(i), c.getY(i), c.getZ(i));
      this.flex.push(f ? f.getX(i) * flexExtra : Math.max(0, v.z - this.zMesa) * flexExtra);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) this.idx.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) this.idx.push(base + i);
    g.dispose();
  }
  geometria() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aFlex', new THREE.Float32BufferAttribute(this.flex, 1));
    g.setIndex(this.idx);
    return g;
  }
}

/* Vaivén del viento: la MISMA fórmula se usa en el shader y acá (para que las abejas
   se posen donde la flor está en ese momento). p en coordenadas de la tapa. */
function vaiven(p, flex, t, out) {
  const a = CONFIG.viento * flex, fase = p.x * 2.3 + p.y * 1.7;
  return out.set(p.x + a * Math.sin(t * 1.6 + fase), p.y + a * 0.7 * Math.cos(t * 1.2 + fase * 1.3), p.z);
}
const VAIVEN_GLSL = `
  float faseV = position.x * 2.3 + position.y * 1.7;
  transformed.x += uViento * aFlex * sin(uT * 1.6 + faseV);
  transformed.y += uViento * aFlex * 0.7 * cos(uT * 1.2 + faseV * 1.3);`;

AFRAME.registerComponent('escena-v1', {
  init() {
    this.raiz = new THREE.Group();          // espacio de la tapa (ver diagrama arriba)
    this.el.object3D.add(this.raiz);

    // Datos aleatorios fijos por abeja (normalizados 0..1, se escalan con CONFIG en cada frame,
    // así los sliders cambian el enjambre en vivo sin re-sortear nada)
    const R = Math.random;
    this.abejas = Array.from({ length: MAX_ABEJAS }, () => ({
      r0: R(), h0: R(), l0: R(), p0: R(), n0: R(), e0: R(), e1: R(), fl: R(), fo: R() * 6.28, fr2: R(),
      fase: R() * Math.PI * 2, dir: R() < 0.5 ? -1 : 1, omega: 0.45 + R() * 0.8,
      fr: 0.3 + R() * 0.6, fh: 0.4 + R() * 0.7, f2: R() * 6.28, f3: R() * 6.28,
      prevX: new THREE.Vector3(1, 0, 0), prevZ: new THREE.Vector3(0, 0, 1),
      vj: {   // plan del viaje (se recalcula cada cuadro, sin crear objetos)
        E: new THREE.Vector3(), A: new THREE.Vector3(), Fl: new THREE.Vector3(), Fa: new THREE.Vector3(),
        B: new THREE.Vector3(), vE: new THREE.Vector3(), vA: new THREE.Vector3(), vB: new THREE.Vector3(),
        vR: new THREE.Vector3(), lat1: new THREE.Vector3(), lat2: new THREE.Vector3(), cero: new THREE.Vector3(),
        tS: 0, tI: 0, tF: 0, tV: 0, tR: 0, L: 0,
      },
      posada: 0,
    }));

    // Abejas y flores viven en "escena": un grupo que sigue a la tapa con un filtro anti-temblor
    // (las flores están lejos del marker y amplificarían cualquier temblor del tracking)
    this.escena = new THREE.Group();
    this.escena.matrixAutoUpdate = false;
    this.escena.visible = false;
    this.el.sceneEl.object3D.add(this.escena);
    this.escenaPose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1) };
    this.poseTmp = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    this.escenaSaltar = true;

    // Instancias: una sola llamada de dibujo para todos los cuerpos y otra para todas las alas
    this.cuerpos = new THREE.InstancedMesh(geometriaAbeja(),
      new THREE.MeshLambertMaterial({ vertexColors: true }), MAX_ABEJAS);
    this.alas = new THREE.InstancedMesh(geometriaAla(),
      new THREE.MeshBasicMaterial({ color: PALETA.marron, transparent: true, opacity: CONFIG.alasOpacidad,
        side: THREE.DoubleSide, depthWrite: false }), MAX_ABEJAS * 2);
    this.alas.renderOrder = 2;   // después del logo, así las alas que pasan por delante se ven bien
    for (const m of [this.cuerpos, this.alas]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;     // las instancias se reparten lejos de la geometría base
      this.escena.add(m);
    }
    this.prepararFlores();

    this.crearLogo();

    this.oclusor = new THREE.Group();
    this.raiz.add(this.oclusor);
    this.ayudas = new THREE.Group();
    this.ayudas.visible = false;
    this.raiz.add(this.ayudas);
    this.verOclusor = false;
    this.reconstruir();

    // Temporales (evitamos crear objetos en cada frame)
    this.v = {
      P: new THREE.Vector3(), Pa: new THREE.Vector3(), Pb: new THREE.Vector3(), V: new THREE.Vector3(),
      A: new THREE.Vector3(), B: new THREE.Vector3(), C: new THREE.Vector3(), D: new THREE.Vector3(),
      E: new THREE.Vector3(), F: new THREE.Vector3(), X: new THREE.Vector3(), Y: new THREE.Vector3(),
      Z: new THREE.Vector3(), S: new THREE.Vector3(), UP: new THREE.Vector3(0, 0, 1),
      cam: new THREE.Vector3(), pos: new THREE.Vector3(), q: new THREE.Quaternion(), scl: new THREE.Vector3(),
    };
    this.m = {
      M: new THREE.Matrix4(), W: new THREE.Matrix4(), Wl: new THREE.Matrix4(),
      T: new THREE.Matrix4(), Rz: new THREE.Matrix4(), Ry: new THREE.Matrix4().makeRotationY(0.55),
      ESPEJO: new THREE.Matrix4().makeScale(-1, 1, 1), CERO: new THREE.Matrix4().makeScale(0, 0, 0),
    };
    this.simT = 0; this.realT = 0; this.ultimoAudio = 0; this.perdidoSeg = 0;
    this.fps = { n: 0, t: 0, valor: 0 };
  },

  /* El oclusor y las ayudas ahora los arma src/colmena/piezas.js */
  reconstruir() {},

  /* Logo, dos modos:
     'tapa'     → cartel fijo a la tapa. Vive en la escena (no dentro del target) para poder
                  filtrarle la pose: así no tiembla aunque el tracking tiemble.
     'pantalla' → <img> fija arriba en la pantalla (cero temblor, pero no es AR). */
  crearLogo() {
    // Contenedor: a él se le aplica la pose filtrada. Adentro van la versión plana y la 3D.
    this.logo = new THREE.Group();
    this.logo.visible = false;
    this.logo.matrixAutoUpdate = false;
    this.el.sceneEl.object3D.add(this.logo);

    // Versión plana (respaldo si no hay GLB, o si se elige en el panel)
    const mat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false,
      side: THREE.DoubleSide });
    this.logoPlano = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);   // plano XY, mira a +Z
    this.logoPlano.renderOrder = 1;
    this.logoPlano.scale.set(1, 221 / 585, 1);                              // se corrige al cargar
    this.logo.add(this.logoPlano);
    new THREE.TextureLoader().load('./assets/logo.png', (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      this.logoPlano.scale.set(1, tex.image.height / tex.image.width, 1);
      mat.map = tex; mat.needsUpdate = true;
    }, undefined, () => console.error('No se pudo cargar assets/logo.png'));

    // Versión 3D: mismo sistema que el plano (ancho 1, centrado, frente hacia +Z, arriba +Y)
    this.logo3d = null;
    if (THREE.GLTFLoader) {
      new THREE.GLTFLoader().load('./assets/logo.glb', (gltf) => {
        this.logo3d = gltf.scene;
        this.logo3dMats = [];
        this.logo3d.traverse((n) => {
          if (n.isMesh) {
            n.renderOrder = 1;
            // Alinear con el estado actual del fundido (el GLB puede llegar a mitad de camino)
            n.material.transparent = this.logoOpacidad < 1;
            n.material.depthWrite = this.logoOpacidad >= 1;
            n.material.opacity = Math.max(0, this.logoOpacidad);
            this.logo3dMats.push(n.material);
          }
        });
        this.logo.add(this.logo3d);
        this.prepararAbejaGrande();
      }, undefined, (e) => console.error('No se pudo cargar assets/logo.glb', e));
    } else {
      console.warn('THREE.GLTFLoader no disponible: se usa el logo plano');
    }

    this.logoOpacidad = 1;          // estado "opaco": la primera llamada con a < 1 activa el fundido
    this.logoSaltar = true;         // la primera pose (o tras perder la tapa) se copia sin filtrar
    this.logoPose = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1) };
    this.logoMeta = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(),
      local: new THREE.Matrix4(), localTapa: new THREE.Matrix4(), qTapa: new THREE.Quaternion(), sTapa: 1,
      qGiro: new THREE.Quaternion(), qInc: new THREE.Quaternion(),
      ejeX: new THREE.Vector3(1, 0, 0), ejeZ: new THREE.Vector3(0, 0, 1) };
    this.hud = document.getElementById('logo-hud') || { classList: { toggle() {} } };
    this.hudVisible = false;
  },

  /* La abeja del logo viene en el GLB como nodo propio ("abeja") con las alas articuladas */
  prepararAbejaGrande() {
    const nodo = this.logo3d.getObjectByName('abeja');
    if (!nodo || !nodo.userData.adelante) { console.warn('El GLB no trae la abeja separada'); return; }
    const alas = ['ala_a', 'ala_b'].map((n) => this.logo3d.getObjectByName(n)).filter(Boolean);
    // Sus materiales son propios: no participan del fundido del logo
    const mats = new Set();
    nodo.traverse((n) => { if (n.isMesh) mats.add(n.material); });
    this.logo3dMats = this.logo3dMats.filter((m) => !mats.has(m));
    mats.forEach((m) => { m.transparent = false; m.opacity = 1; m.needsUpdate = true; });
    const f0 = new THREE.Vector3().fromArray(nodo.userData.adelante).normalize();
    const n0 = new THREE.Vector3(0, 0, 1);
    this.abejaG = {
      nodo, alas, f0,
      reposo: nodo.position.clone(),
      // Base de la abeja en reposo (coords del logo): derecha, adelante, arriba
      baseReposo: new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(f0, n0), f0, n0),
      adelantePrevio: new THREE.Vector3(1, 0, 0),
      pts: Array.from({ length: 7 }, () => new THREE.Vector3()),
      t: { p: new THREE.Vector3(), pa: new THREE.Vector3(), pb: new THREE.Vector3(), d: new THREE.Vector3(),
           r: new THREE.Vector3(), u: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(),
           m: new THREE.Matrix4(), inv: new THREE.Matrix4(), n: new THREE.Vector3() },
    };
  },

  /* Recorrido en coordenadas de la tapa: sale del logo impreso, sube, da 3/4 de vuelta alrededor
     de la colmena, se acerca de frente al cartel y se posa en su lugar. Catmull-Rom entre puntos. */
  rutaAbejaGrande() {
    const C = CONFIG, A = this.abejaG, P = A.pts, M = this.logoMeta;
    P[6].copy(A.reposo).applyMatrix4(M.localTapa);                      // lugar en el logo
    A.t.n.set(0, 0, 1).applyQuaternion(M.qTapa);                         // hacia dónde mira el logo
    P[5].copy(P[6]).addScaledVector(A.t.n, 0.55);                        // aproximación, de frente
    P[0].set(C.emisorX, C.emisorY, -0.02);                               // dentro del logo impreso
    P[1].copy(P[0]); P[1].z += 0.6;
    const aAp = Math.atan2(P[5].y - C.ejeY, P[5].x - C.ejeX);
    const R = C.abejaGrandeRadio, h = C.abejaGrandeAltura;
    [Math.PI / 2, Math.PI, 1.5 * Math.PI].forEach((da, i) => {
      P[2 + i].set(C.ejeX + R * Math.cos(aAp + da), C.ejeY + R * Math.sin(aAp + da), h + (i === 1 ? 0.2 : 0));
    });
    const v = Math.max(0.2, C.abejaGrandeVelocidad);
    return [1.0, 1.3, 1.4, 1.4, 1.5, 1.8].map((d) => d / v);            // duración de cada tramo
  },

  puntoRuta(durs, t, out) {
    const P = this.abejaG.pts, n = P.length - 1;
    let i = 0;
    while (i < n - 1 && t > durs[i]) { t -= durs[i]; i++; }
    const u = clamp(t / durs[i], 0, 1);
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(n, i + 2)];
    const u2 = u * u, u3 = u2 * u;
    for (const k of ['x', 'y', 'z']) {
      out[k] = 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u2
        + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u3);
    }
    return out;
  },

  actualizarAbejaGrande(visible) {
    const C = CONFIG, A = this.abejaG;
    if (!A) return;
    const { nodo, alas } = A;
    const enReposo = () => {
      nodo.position.copy(A.reposo); nodo.quaternion.identity(); nodo.scale.set(1, 1, 1);
    };
    const aletear = (amp) => {
      const th = amp * (0.55 + 0.45 * Math.sin(this.realT * Math.PI * 2 * 13));
      alas.forEach((a) => a.quaternion.setFromAxisAngle(A.f0, (a.userData.lado || 1) * th));
    };
    if (!C.abejaGrande) { nodo.visible = true; enReposo(); aletear(0); return; }

    const tb = this.simT - C.abejaGrandeDesdeSeg;
    nodo.visible = tb >= 0;
    if (tb < 0) return;
    const durs = this.rutaAbejaGrande();
    const total = durs.reduce((a, b) => a + b, 0);
    if (tb >= total) {
      // Posada: de vez en cuando abre las alas un momento
      enReposo();
      const ph = (tb - total) % 6;
      aletear(ph < 0.7 ? 0.5 * Math.sin(Math.PI * ph / 0.7) : 0);
      return;
    }

    const T = A.t, M = this.logoMeta, UP = this.v.UP;
    this.puntoRuta(durs, tb, T.p);
    this.puntoRuta(durs, Math.min(total, tb + 0.02), T.pb);
    this.puntoRuta(durs, Math.max(0, tb - 0.02), T.pa);
    T.d.subVectors(T.pb, T.pa);
    // Mientras sube vertical no hay "adelante" claro: mira hacia el primer punto de la vuelta
    const horiz = Math.hypot(T.d.x, T.d.y);
    if (tb < durs[0] * 0.8 || horiz < 0.25 * T.d.length()) {
      T.d.set(A.pts[2].x - A.pts[1].x, A.pts[2].y - A.pts[1].y, 0);
      if (T.d.lengthSq() < 1e-8) T.d.copy(A.adelantePrevio);
    }
    T.d.normalize(); A.adelantePrevio.copy(T.d);
    T.r.crossVectors(T.d, UP).normalize();
    T.u.crossVectors(T.r, T.d);
    // Rotación en vuelo: lleva (derecha, adelante, arriba) de la abeja a (r, d, u) de la tapa
    T.m.makeBasis(T.r, T.d, T.u).multiply(T.inv.copy(A.baseReposo).transpose());
    T.q.setFromRotationMatrix(T.m);

    // Último tramo: se orienta como en el logo, achica al tamaño del logo y frena las alas
    const tAterr = total - durs[durs.length - 1];
    const e = smooth(tAterr, total, tb);
    T.q.slerp(M.qTapa, e);
    // (nunca escala 0: decompose() daría NaN)
    const k = M.sTapa * lerp(C.abejaGrandeEscala, 1, e) * Math.max(1e-3, smooth(0, 0.4, tb));
    T.s.set(k, k, k);
    T.m.compose(T.p, T.q, T.s);

    // Pasar de coordenadas de la tapa a coordenadas del logo (el nodo es hijo del logo)
    T.inv.copy(M.localTapa).invert();
    T.m.premultiply(T.inv);
    T.m.decompose(nodo.position, nodo.quaternion, nodo.scale);
    aletear(1.1 * (1 - e));
  },

  /* Fundido de entrada. Cuando termina, todo pasa a opaco y escribe profundidad,
     así las abejas que pasan por detrás quedan bien tapadas. */
  opacidadLogo(a) {
    if (a === this.logoOpacidad) return;
    const opaco = a >= 1, cambio = opaco !== (this.logoOpacidad >= 1);
    this.logoOpacidad = a;
    const mp = this.logoPlano.material;
    mp.opacity = a;
    if (cambio) { mp.alphaTest = opaco ? 0.4 : 0; mp.depthWrite = opaco; mp.needsUpdate = true; }
    for (const m of this.logo3dMats || []) {
      m.opacity = a;
      if (cambio) { m.transparent = !opaco; m.depthWrite = opaco; m.needsUpdate = true; }
    }
  },

  actualizarLogo(visible, dt) {
    const C = CONFIG, lg = this.logo;
    const aparicion = C.mostrarLogo && visible ? smooth(C.logoDesdeSeg, C.logoDesdeSeg + 1.5, this.simT) : 0;

    // Modo pantalla: solo prender/apagar la <img> (la transición la hace el CSS)
    const hud = C.logoModo === 'pantalla' && aparicion > 0;
    if (hud !== this.hudVisible) { this.hudVisible = hud; this.hud.classList.toggle('visible', hud); }

    const usar3D = C.logo3D && !!this.logo3d;
    const listo = usar3D || !!this.logoPlano.material.map;
    const abejaVolando = usar3D && !!this.abejaG && C.abejaGrande && C.mostrarLogo && visible
      && this.simT >= C.abejaGrandeDesdeSeg;
    lg.visible = C.logoModo === 'tapa' && listo && (aparicion > 0 || abejaVolando);
    if (!lg.visible) { this.logoSaltar = true; return; }
    this.logoPlano.visible = !usar3D;
    if (this.logo3d) this.logo3d.visible = usar3D;

    // 1) Pose deseada en coordenadas de la tapa
    const M = this.logoMeta, deg = THREE.MathUtils.degToRad;
    const g = deg(C.logoGiro);
    M.p.set(C.ejeX - Math.sin(g) * C.logoDistancia, C.ejeY + Math.cos(g) * C.logoDistancia, C.logoAltura);
    // El logo mira a +Z; lo levantamos girando en X (90° = vertical mirando a −Y) menos la inclinación
    M.qInc.setFromAxisAngle(M.ejeX, Math.PI / 2 - deg(C.logoInclinacion));
    M.qGiro.setFromAxisAngle(M.ejeZ, g);
    M.q.multiplyQuaternions(M.qGiro, M.qInc);
    const k = C.logoAncho * (0.9 + 0.1 * aparicion);
    M.s.set(k, k, k);
    M.local.compose(M.p, M.q, M.s);
    M.localTapa.copy(M.local); M.qTapa.copy(M.q); M.sTapa = k;          // para la abeja grande

    // 2) Pasarla a coordenadas de la escena con la pose actual de la tapa
    this.raiz.updateWorldMatrix(true, false);
    M.local.premultiply(this.raiz.matrixWorld);
    M.local.decompose(M.p, M.q, M.s);

    // 3) Filtro exponencial: se acerca a la pose nueva sin seguir el temblor cuadro a cuadro
    const P = this.logoPose;
    if (this.logoSaltar || C.logoSuavizado <= 0) {
      P.p.copy(M.p); P.q.copy(M.q); P.s.copy(M.s);
      this.logoSaltar = false;
    } else {
      const a = 1 - Math.exp(-dt / C.logoSuavizado);
      P.p.lerp(M.p, a); P.q.slerp(M.q, a); P.s.lerp(M.s, a);
    }
    lg.matrix.compose(P.p, P.q, P.s);
    lg.matrixWorldNeedsUpdate = true;

    this.opacidadLogo(aparicion);
    if (usar3D) this.actualizarAbejaGrande(visible);
  },

  reiniciarAnimacion() { this.simT = 0; },

  /* ── FLORES ─────────────────────────────────────────────────────────── */
  prepararFlores() {
    this.uViento = { value: CONFIG.viento };
    this.uT = { value: 0 };
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uViento = this.uViento;
      sh.uniforms.uT = this.uT;
      sh.vertexShader = 'attribute float aFlex;\nuniform float uViento;\nuniform float uT;\n'
        + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>' + VAIVEN_GLSL);
    };
    this.jardin = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.jardin.frustumCulled = false;
    this.escena.add(this.jardin);
    this.flores = [];
    this.crearFlores();
  },

  /* Arma todas las plantas. Tres tipos, mezclados según la semilla:
       margarita  → muchos pétalos finos y centro abombado
       simple     → 6–8 pétalos anchos con muesca (tipo cosmos)
       ramillete  → tallo ramificado con varias flores chicas
     Cada cabeza de flor queda en this.flores como lugar de posado. */
  crearFlores() {
    const C = CONFIG, tam = C.florTamano;
    const rnd = aleatorio(Math.round(C.florSemilla) * 9973 + 1);
    const n = clamp(Math.round(C.flores), 0, MAX_FLORES);
    const zMesa = -C.altoColmenaMm / C.markerMm;
    const mz = new Mezclador(zMesa);
    const Z = new THREE.Vector3(0, 0, 1), X = new THREE.Vector3(1, 0, 0);
    const color = (h) => new THREE.Color(h);
    const VERDES = ['#3f7a35', '#4c8a3a', '#5a9440'];
    this.flores = [];
    const ubicadas = [];

    // Matriz: posición + orientación que lleva +Z a "normal" y gira "giro" alrededor de ella
    const matriz = (pos, normal, giro = 0, esc = 1) => {
      const q = new THREE.Quaternion().setFromUnitVectors(Z, normal.clone().normalize());
      q.multiply(new THREE.Quaternion().setFromAxisAngle(Z, giro));
      return new THREE.Matrix4().compose(pos, q, new THREE.Vector3(esc, esc, esc));
    };
    const rot = (m, eje, ang) => m.multiply(new THREE.Matrix4().makeRotationAxis(eje, ang));

    const tallo = (puntos, radio, cBase, cPunta) => {
      const curva = new THREE.CatmullRomCurve3(puntos);
      const g = new THREE.TubeGeometry(curva, 10, radio, 5, false);
      const z0 = puntos[0].z, z1 = puntos[puntos.length - 1].z;
      const a = color(cBase), b = color(cPunta), c = new THREE.Color();
      pintar(g, (x, y, z) => c.copy(a).lerp(b, clamp((z - z0) / ((z1 - z0) || 1), 0, 1)));
      mz.agregar(g, new THREE.Matrix4());
      return curva;
    };

    const hoja = (pos, normalTallo, giro, largo) => {
      const g = geoTira({ largo, ancho: largo * 0.38, perfil: (s) => Math.pow(Math.sin(Math.PI * s), 0.8),
        arco: -0.25, pliegue: 0.35, colorBase: '#3a6e30', colorPunta: '#6fa84a', segL: 6, segA: 2 });
      const m = matriz(pos, normalTallo, giro);
      rot(m, new THREE.Vector3(0, 1, 0), -1.1);                // sale del tallo hacia arriba
      mz.agregar(g, m);
    };

    // Una cabeza de flor en "pos", mirando hacia "normal"
    const cabeza = (pos, normal, tipo, esc, cPet, cBasePet) => {
      const giro0 = rnd() * Math.PI * 2;
      // Cáliz verde debajo
      const caliz = new THREE.ConeGeometry(0.035 * esc, 0.05 * esc, 6, 1, true);
      caliz.rotateX(-Math.PI / 2); caliz.translate(0, 0, -0.02 * esc);
      pintar(caliz, () => color('#4c8a3a'));
      mz.agregar(caliz, matriz(pos, normal));
      // Pétalos
      let nPet, largo, ancho, perfil, copa, arco, muesca = 0, capas = 1;
      if (tipo === 'margarita') {
        nPet = 16 + Math.floor(rnd() * 6); largo = 0.12; ancho = 0.028;
        perfil = (s) => Math.pow(Math.sin(Math.PI * Math.min(s * 0.9 + 0.1, 1)), 0.45);
        copa = 0.6; arco = 0.08; capas = 2;
      } else if (tipo === 'simple') {
        nPet = 6 + Math.floor(rnd() * 3); largo = 0.12; ancho = 0.075;
        perfil = (s) => Math.pow(Math.sin(Math.PI * Math.min(s, 0.995)), 0.55) * (0.35 + 0.65 * s);
        copa = 1.0; arco = 0.18; muesca = 0.25;
      } else {   // flor chica del ramillete
        nPet = 5; largo = 0.07; ancho = 0.05;
        perfil = (s) => Math.pow(Math.sin(Math.PI * Math.min(s, 0.995)), 0.6) * (0.4 + 0.6 * s);
        copa = 1.2; arco = 0.25;
      }
      for (let capa = 0; capa < capas; capa++) {
        for (let k = 0; k < nPet; k++) {
          const g = geoTira({ largo: largo * esc * (1 - 0.12 * capa), ancho: ancho * esc, perfil, copa, arco, muesca,
            colorBase: cBasePet, colorPunta: color(cPet).offsetHSL(0, 0, (rnd() - 0.5) * 0.06), segL: 6, segA: 4 });
          const m = matriz(pos, normal, giro0 + (k + 0.5 * capa) / nPet * Math.PI * 2 + (rnd() - 0.5) * 0.15);
          rot(m, new THREE.Vector3(0, 1, 0), -0.12 - 0.12 * capa - rnd() * 0.12);   // levantados
          m.multiply(new THREE.Matrix4().makeTranslation(0.012 * esc, 0, 0.004 * capa * esc));
          mz.agregar(g, m);
        }
      }
      // Centro abombado con granulado de color
      const rc = (tipo === 'margarita' ? 0.042 : tipo === 'simple' ? 0.03 : 0.018) * esc;
      const centro = new THREE.SphereGeometry(rc, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2);
      centro.rotateX(Math.PI / 2); centro.scale(1, 1, 0.55);
      const cc1 = color(tipo === 'ramillete' ? '#f6e27a' : '#e0a020'), cc2 = color(tipo === 'simple' ? '#7a4a1a' : '#b86e12');
      const ct = new THREE.Color();
      pintar(centro, (x, y) => ct.copy(cc1).lerp(cc2, 0.5 + 0.5 * Math.sin(x * 900 + y * 1300)));
      mz.agregar(centro, matriz(pos, normal));
      // Lugar de posado: arriba del centro (la abeja se desplaza un poco según su tamaño)
      const lugar = pos.clone().addScaledVector(normal, rc * 0.6);
      this.flores.push({ cabeza: lugar, flex: Math.max(0, lugar.z - zMesa), radio: rc * 0.8 });
    };

    const brizna = (pos, giro, alto) => {
      const g = geoTira({ largo: alto, ancho: 0.018 + 0.012 * rnd(), perfil: (s) => Math.pow(1 - s, 0.8),
        arco: 0, pliegue: 0.3, colorBase: VERDES[0], colorPunta: rnd() < 0.5 ? '#8dbb4c' : '#a3c45a', segL: 4, segA: 1 });
      // La tira crece en +X: la paramos (X → Z) y la inclinamos un poco
      const fl = new Float32Array(g.attributes.position.count);
      for (let i = 0; i < fl.length; i++) fl[i] = Math.pow(g.attributes.position.getX(i) / alto, 1.5) * 0.6;
      g.setAttribute('aFlex', new THREE.BufferAttribute(fl, 1));
      const m = new THREE.Matrix4().makeTranslation(pos.x, pos.y, pos.z);
      rot(m, Z, giro);
      rot(m, new THREE.Vector3(0, 1, 0), -Math.PI / 2 + 0.15 + 0.35 * rnd());   // casi vertical
      mz.agregar(g, m);
    };

    for (let i = 0; i < n; i++) {
      const florAntes = this.flores.length;           // (nuevo) para anotar la base de cada planta
      // Ubicación: alternando lados, separadas entre sí
      const lado = i % 2 ? 1 : -1;
      let x = 0, y = 0;
      for (let intento = 0; intento < 40; intento++) {
        x = C.ejeX + lado * lerp(C.florDistMin, C.florDistMax, rnd());
        y = C.ejeY + lerp(-1.4, 1.4, rnd());
        if (ubicadas.every(([ux, uy]) => Math.hypot(ux - x, uy - y) > 0.45 * tam)) break;
      }
      ubicadas.push([x, y]);
      // Uno de cada tres es ramillete; el resto, margarita o simple
      const tipo = i % 3 === 1 ? 'ramillete' : rnd() < 0.5 ? 'margarita' : 'simple';
      const paleta = tipo === 'margarita'
        ? (rnd() < 0.75 ? ['#ffffff', '#f4f1e6'] : ['#d9c2f0', '#b38ad9'])
        : tipo === 'simple'
          ? [['#f7c6d6', '#c2457a'], ['#f3e9ff', '#a57bd1'], ['#ffffff', '#e2b6c8']][Math.floor(rnd() * 3)]
          : [['#8fa6e8', '#5c6fc4'], ['#c9a0dc', '#8a5bb0'], ['#f6d55c', '#e0a020']][Math.floor(rnd() * 3)];
      const [cPet, cBase] = paleta;

      // Tallo curvo
      const H = lerp(C.florAlturaMin, C.florAlturaMax, rnd()) * (tipo === 'ramillete' ? 1.1 : 1);
      const az = rnd() * Math.PI * 2, curv = 0.08 + 0.12 * rnd();
      const dir = new THREE.Vector3(Math.cos(az), Math.sin(az), 0);
      const base = new THREE.Vector3(x, y, zMesa);
      const pts = [0, 0.35, 0.7, 1].map((t) => base.clone()
        .addScaledVector(Z, H * t).addScaledVector(dir, curv * H * t * t));
      const curva = tallo(pts, 0.013 * tam, '#3a6e30', '#5a9440');
      const fin = curva.getPoint(1), tang = curva.getTangent(1);

      // Hojas
      const nHojas = 2 + Math.floor(rnd() * 2);
      for (let k = 0; k < nHojas; k++) {
        const t = 0.12 + 0.3 * k / nHojas + 0.08 * rnd();
        hoja(curva.getPoint(t), curva.getTangent(t), az + Math.PI * (k % 2) + rnd() * 0.8, (0.12 + 0.08 * rnd()) * tam);
      }

      if (tipo === 'ramillete') {
        // Ramas que salen de la parte alta del tallo, cada una con una flor chica
        const nRamas = 3 + Math.floor(rnd() * 3);
        for (let k = 0; k < nRamas; k++) {
          const t0 = 0.55 + 0.4 * (k / nRamas);
          const p0 = curva.getPoint(t0);
          const ang = az + k * 2.4 + rnd() * 0.6;
          const sale = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
          const largo = (0.14 + 0.1 * rnd()) * tam;
          const p1 = p0.clone().addScaledVector(sale, largo * 0.5).addScaledVector(Z, largo * 0.4);
          const p2 = p0.clone().addScaledVector(sale, largo * 0.8).addScaledVector(Z, largo * 0.95);
          const rama = tallo([p0, p1, p2], 0.008 * tam, '#4c8a3a', '#5a9440');
          cabeza(p2, rama.getTangent(1).lerp(Z, 0.4).normalize(), 'ramillete', tam * (0.85 + 0.3 * rnd()), cPet, cBase);
        }
        cabeza(fin, tang.clone().lerp(Z, 0.3).normalize(), 'ramillete', tam, cPet, cBase);
      } else {
        cabeza(fin, tang.clone().lerp(Z, 0.5).normalize(), tipo, tam, cPet, cBase);
      }

      // (nuevo) Base de la planta en cada cabeza: el toque se mide contra el segmento base → cabeza
      for (let k = florAntes; k < this.flores.length; k++) this.flores[k].base = new THREE.Vector3(x, y, zMesa);

      // Pasto alrededor de la planta
      for (let k = 0; k < Math.round(C.pasto); k++) {
        const r = (0.04 + 0.26 * Math.sqrt(rnd())) * tam, a = rnd() * Math.PI * 2;
        brizna(new THREE.Vector3(x + r * Math.cos(a), y + r * Math.sin(a), zMesa), rnd() * Math.PI * 2,
          (0.1 + 0.22 * rnd()) * tam * (1 - 0.4 * r / (0.3 * tam)));
      }
    }
    this.jardin.geometry.dispose();
    this.jardin.geometry = mz.geometria();
  },

  /* ── VIAJE DE CADA ABEJA ─────────────────────────────────────────────
     Tramos (todos en coordenadas de la tapa):
       S salida   E (dentro del logo) → A (encima)              Hermite
       I ida      A → Fa (encima de su flor)                      Hermite + arco + ondulación
       F flor     Fa → baja → posada en Fl → sube → Fa            perfil suave, con giros
       V vuelta   Fa → B (encima del logo)                        Hermite + arco + ondulación
       R regreso  B → E                                           Hermite
     Las velocidades coinciden en cada unión, y en Fa es cero (la abeja frena para posarse). */
  planViaje(b) {
    const C = CONFIG, v = b.vj, UP = this.v.UP;
    this.emisor(b, v.E);
    v.A.copy(v.E); v.A.z += 0.5;
    v.B.copy(v.E); v.B.z += 0.55;
    if (this.flores.length) {
      const f = this.flores[Math.floor(b.fl * this.flores.length) % this.flores.length];
      const r = f.radio * Math.sqrt(b.fr2);
      vaiven(f.cabeza, f.flex, this.realT, v.Fl);            // donde está la flor ahora (con viento)
      v.Fl.x += r * Math.cos(b.fo); v.Fl.y += r * Math.sin(b.fo);
    } else {
      // Sin flores: un punto en el aire alrededor de la colmena
      v.Fl.set(C.ejeX + 1.6 * Math.cos(b.fase), C.ejeY + 1.6 * Math.sin(b.fase), 0.3);
    }
    v.Fa.copy(v.Fl); v.Fa.z += 0.28;
    const vel = 0.9 * (0.8 + 0.4 * b.r0);
    // Al salir mira hacia su flor; al volver llega desde el lado de la flor
    v.lat1.set(v.Fa.x - v.A.x, v.Fa.y - v.A.y, 0);
    if (v.lat1.lengthSq() < 1e-8) v.lat1.set(1, 0, 0);
    v.lat1.normalize();
    v.vA.copy(v.lat1).multiplyScalar(0.7 * vel).addScaledVector(UP, 0.35 * vel);
    v.vB.copy(v.lat1).multiplyScalar(-0.6 * vel).addScaledVector(UP, -0.25 * vel);
    v.vE.set(0, 0, 1.0);
    v.vR.set(0, 0, -0.7);
    v.lat2.crossVectors(v.lat1, UP);                   // perpendicular horizontal al camino
    const dI = v.A.distanceTo(v.Fa), dV = v.Fa.distanceTo(v.B);
    v.tS = 1.2;
    v.tI = Math.max(1.6, 1.3 * dI / vel);
    v.tF = C.florSeg * (0.6 + 0.8 * b.h0);
    v.tV = Math.max(1.6, 1.3 * dV / vel) * (0.9 + 0.2 * b.l0);
    v.tR = 1.6;
    v.L = v.tS + v.tI + v.tF + v.tV + v.tR;
  },

  /* Desvío del camino: ondula a los costados y arriba/abajo, se apaga en los extremos */
  ondular(b, s, tLocal, ida, out) {
    const C = CONFIG, v = b.vj;
    const env = Math.sin(Math.PI * s) ** 2;            // 0 y con pendiente 0 en los extremos
    const fase = ida ? 0 : 2.1;
    const lat = env * 0.2 * C.ondulacion * Math.sin(Math.PI * 2 * b.fr * tLocal + b.f2 + fase);
    const ver = env * (C.arco + 0.1 * C.ondulacion * Math.sin(Math.PI * 2 * b.fh * tLocal + b.f3 + fase));
    out.addScaledVector(v.lat2, lat);
    out.z += ver;
    return out;
  },

  posicion(b, t, out) {
    const v = b.vj;
    b._posada = 0;
    let t0 = 0;
    if (t < v.tS) return hermite(v.E, v.vE, v.A, v.vA, v.tS, t / v.tS, out);
    t0 += v.tS;
    if (t < t0 + v.tI) {
      const s = (t - t0) / v.tI;
      hermite(v.A, v.vA, v.Fa, v.cero, v.tI, s, out);
      return this.evitarColmena(this.ondular(b, s, t - t0, true, out));
    }
    t0 += v.tI;
    if (t < t0 + v.tF) {
      // Sobre la flor: baja girando, se posa, vuelve a subir girando
      const u = (t - t0) / v.tF;
      const h = 0.28 * (1 - smooth(0, 0.35, u) + smooth(0.7, 1, u));
      const rc = 0.07 * Math.sin(Math.PI * h / 0.28);
      const ang = b.fase + 3 * (t - t0);
      b._posada = 1 - clamp(h / 0.03, 0, 1);
      return out.set(v.Fl.x + rc * Math.cos(ang), v.Fl.y + rc * Math.sin(ang), v.Fl.z + h);
    }
    t0 += v.tF;
    if (t < t0 + v.tV) {
      const s = (t - t0) / v.tV;
      hermite(v.Fa, v.cero, v.B, v.vB, v.tV, s, out);
      return this.evitarColmena(this.ondular(b, s, t - t0, false, out));
    }
    t0 += v.tV;
    return hermite(v.B, v.vB, v.E, v.vR, v.tR, clamp((t - t0) / v.tR, 0, 1), out);
  },

  /* Pose filtrada: se acerca a la deseada con un filtro exponencial (anti-temblor) */
  filtrarPose(P, deseada, tau, dt, saltar, salida) {
    const T = this.poseTmp;
    deseada.decompose(T.p, T.q, T.s);
    if (saltar || tau <= 0) { P.p.copy(T.p); P.q.copy(T.q); P.s.copy(T.s); }
    else {
      const a = 1 - Math.exp(-dt / tau);
      P.p.lerp(T.p, a); P.q.slerp(T.q, a); P.s.lerp(T.s, a);
    }
    return salida.compose(P.p, P.q, P.s);
  },

  /* Punto de salida/regreso de cada abeja: dentro del círculo del logo, apenas bajo la superficie */
  emisor(b, out) {
    const r = CONFIG.emisorRadio * Math.sqrt(b.e0), a = b.e1 * Math.PI * 2;
    return out.set(CONFIG.emisorX + r * Math.cos(a), CONFIG.emisorY + r * Math.sin(a), -0.02);
  },

  /* Red de seguridad: si algún punto de las curvas de salida o regreso cae dentro del
     cilindro que la envuelve (por debajo de la tapa), se lo empuja radialmente hacia afuera.
     Es continuo, así que la abeja "resbala" por la pared en vez de saltar. */
  evitarColmena(p) {
    const dx = p.x - CONFIG.ejeX, dy = p.y - CONFIG.ejeY;
    const r = Math.hypot(dx, dy);
    const min = 0.88 * smooth(-0.03, -0.1, p.z);
    if (r < min && r > 1e-6) {
      p.x = CONFIG.ejeX + dx * min / r;
      p.y = CONFIG.ejeY + dy * min / r;
    }
    return p;
  },

  tick(time, dtMs) {
    const dt = Math.min(dtMs || 16, 50) / 1000;
    this.realT += dt;
    this.contarFps(dt);

    const visible = this.el.object3D.visible;     // MindAR lo apaga al perder el target
    if (visible) {
      // Si la tapa estuvo fuera de cuadro un buen rato, la animación arranca de nuevo
      if (CONFIG.reiniciarTrasSeg > 0 && this.perdidoSeg > CONFIG.reiniciarTrasSeg) this.simT = 0;
      this.perdidoSeg = 0;
      this.simT += dt * CONFIG.velocidad;
    } else {
      this.perdidoSeg += dt;
    }
    this.el.sceneEl.camera.getWorldPosition(this.v.cam);
    this.alas.material.opacity = CONFIG.alasOpacidad;
    if (this.uT) { this.uT.value = this.realT; this.uViento.value = CONFIG.viento; }

    // Grupo de abejas y flores: sigue a la tapa con filtro
    this.escena.visible = visible;
    if (visible) {
      this.raiz.updateWorldMatrix(true, false);
      this.filtrarPose(this.escenaPose, this.raiz.matrixWorld, CONFIG.escenaSuavizado, dt,
        this.escenaSaltar, this.escena.matrix);
      this.escena.matrixWorldNeedsUpdate = true;
      this.escenaSaltar = false;
    } else {
      this.escenaSaltar = true;
    }

    const n = Math.min(CONFIG.abejas, MAX_ABEJAS);
    const s = CONFIG.tamanoMm / CONFIG.markerMm;
    const { P, Pa, Pb, V, X, Y, Z, S, UP } = this.v;
    const { M, W, Wl, T, Rz, Ry, ESPEJO, CERO } = this.m;
    let volando = 0;
    // Cámara en coordenadas de la escena (para elegir la abeja "solista" del sonido)
    const camL = this.v.camL || (this.v.camL = new THREE.Vector3());
    const invE = this.m.invE || (this.m.invE = new THREE.Matrix4());
    camL.copy(this.v.cam).applyMatrix4(invE.copy(this.escena.matrix).invert());
    let soloI = -1, soloD2 = Infinity;
    let candidatoAdentro = -1;          // (nuevo) ver abeja destacada

    for (let i = 0; i < n; i++) {
      const b = this.abejas[i];
      this.planViaje(b);
      const L = b.vj.L;
      const ciclo = L + 0.6 + 2.4 * b.p0;                     // pausa adentro antes de volver a salir
      // Las abejas se suman de a una: la i-ésima sale por primera vez en "nace"
      const ini = Math.max(1, Math.round(CONFIG.abejasIniciales));
      const nace = i < ini
        ? i * 0.15                                                  // primera tanda, casi juntas
        : ini * 0.15 + CONFIG.intervaloSeg * (i - ini + 1 + 0.5 * (b.n0 - 0.5));
      const edad = this.simT - nace;
      const t = mod(edad, ciclo);
      // (nuevo) Abeja destacada: la primera que salga hacia la flor tocada
      const dest = this.destacada;
      if (dest && dest.i < 0 && edad >= 0 && t < b.vj.tS + b.vj.tI && this.florDe(b) === dest.flor) dest.i = i;
      if (edad < 0 || t >= L) {
        if (dest && dest.i === i && dest.volo) this.terminarDestacada();
        if (dest && dest.i < 0 && edad >= 0 && candidatoAdentro < 0) candidatoAdentro = i;
        this.cuerpos.setMatrixAt(i, CERO);
        this.alas.setMatrixAt(2 * i, CERO); this.alas.setMatrixAt(2 * i + 1, CERO);
        continue;
      }
      volando++;

      this.posicion(b, t, P);
      b.posada = b._posada;
      const d2 = P.distanceToSquared(camL);
      if (d2 < soloD2) {
        soloD2 = d2; soloI = i;
        (this.v.soloP || (this.v.soloP = new THREE.Vector3())).copy(P);
      }
      this.posicion(b, Math.min(L, t + 0.02), Pb);
      this.posicion(b, Math.max(0, t - 0.02), Pa);
      V.subVectors(Pb, Pa);

      // Orientación según la tangente de la trayectoria, con +Z de la tapa como "arriba"
      if (V.lengthSq() > 1e-10) Z.copy(V).normalize(); else Z.copy(b.prevZ);
      X.crossVectors(UP, Z);
      if (X.lengthSq() < 0.04) X.copy(b.prevX); else X.normalize();   // vuelo casi vertical
      Y.crossVectors(Z, X).normalize();
      X.crossVectors(Y, Z);
      b.prevX.copy(X); b.prevZ.copy(Z);

      const vida = smooth(0, 0.35, t) * (1 - smooth(L - 0.35, L, t));
      const k = s * vida;
      M.makeBasis(X, Y, Z).scale(S.set(k, k, k)).setPosition(P);
      if (this.destacada && this.destacada.i === i) {      // (nuevo) más grande, con estela y polen
        M.makeBasis(X, Y, Z).scale(S.set(1.6 * k, 1.6 * k, 1.6 * k)).setPosition(P);
        this.seguirDestacada(b, t, P, M);
      }
      this.cuerpos.setMatrixAt(i, M);

      // Alas: raíz sobre el tórax, aleteo alrededor del eje del cuerpo
      // Posada sobre la flor: alas casi quietas, plegadas hacia atrás
      const vuela = 1 - b.posada;
      const aleteo = 0.2 * vuela - 0.15 * b.posada
        + (0.15 + 0.75 * vuela) * Math.sin(this.realT * Math.PI * 2 * (4 + 12 * vuela) + b.f2 * 10);
      T.makeTranslation(0.1, 0.15, 0.12);
      Rz.makeRotationZ(aleteo);
      Wl.multiplyMatrices(T, Rz).multiply(Ry);
      W.multiplyMatrices(M, Wl);
      this.alas.setMatrixAt(2 * i, W);
      W.multiplyMatrices(M, ESPEJO).multiply(Wl);
      this.alas.setMatrixAt(2 * i + 1, W);
    }
    // (nuevo) Si ninguna iba hacia esa flor, una de las que están adentro sale para allá
    const dest = this.destacada;
    if (dest && dest.i < 0 && candidatoAdentro >= 0 && this.flores.length) {
      this.abejas[candidatoAdentro].fl = (dest.flor + 0.5) / this.flores.length;
      dest.i = candidatoAdentro;
    }
    this.actualizarLogo(visible, dt);
    this.cuerpos.count = n;
    this.alas.count = 2 * n;
    this.cuerpos.instanceMatrix.needsUpdate = true;
    this.alas.instanceMatrix.needsUpdate = true;

    // Sonido: cada ~100 ms, según abejas en vuelo y distancia de la cámara a la tapa
    if (this.realT - this.ultimoAudio > 0.1) {
      this.ultimoAudio = this.realT;
      let nivel = 0, brillo = 0;
      if (visible && n > 0) {
        this.el.object3D.matrixWorld.decompose(this.v.pos, this.v.q, this.v.scl);
        const d = this.v.pos.distanceTo(this.v.cam) / (this.v.scl.x || 1);   // en u (1 u = 46,6 mm)
        const cerca = 1 - smooth(3, 14, d);                                   // ~14 cm → ~65 cm
        brillo = cerca;
        // El enjambre (MP3) no se oye con 1–2 abejas y se completa con la mitad del enjambre afuera
        const enjambre = smooth(2.5, Math.max(4, 0.5 * n), volando);
        nivel = enjambre * (0.25 + 0.75 * cerca);
        this.distanciaMm = d * CONFIG.markerMm;
      }
      Zumbido.fijar(nivel, brillo, n > 0 ? volando / n : 0);
    }
    this.sonidoSolista(visible, soloI, Math.sqrt(soloD2), volando, dt);
  },

  /* Abeja solista: la más cercana a la cámara. Volumen por distancia, paneo según dónde está en
     la pantalla y un leve cambio de tono al acercarse/alejarse (efecto Doppler, exagerado). */
  sonidoSolista(visible, i, d, volando, dt) {
    if (!Zumbido.solo) return;
    if (!visible || i < 0) { Zumbido.fijarSolista(0, 0, 230); this.soloPrev = -1; return; }
    const b = this.abejas[i];
    // Paneo: posición de la abeja en coordenadas de la cámara
    const pc = (this.v.soloC || (this.v.soloC = new THREE.Vector3()))
      .copy(this.v.soloP).applyMatrix4(this.escena.matrix)
      .applyMatrix4(this.el.sceneEl.camera.matrixWorldInverse);
    const pan = clamp(pc.x / Math.max(1e-3, -pc.z) * 1.4, -1, 1);
    // Doppler: velocidad radial (u/s) de la misma abeja respecto del cuadro anterior
    let vr = 0;
    if (this.soloPrev === i && dt > 0) vr = (d - this.soloDist) / dt;
    this.soloPrev = i; this.soloDist = d;
    const freq = (215 + 40 * b.r0) * (1 - clamp(vr * 0.05, -0.08, 0.08));
    // Más presente cuando hay pocas abejas; se calla posada en la flor
    const nivel = (1 - smooth(2, 12, d)) * (1 - 0.55 * smooth(4, 15, volando)) * (1 - b.posada);
    Zumbido.fijarSolista(nivel, pan, freq);
  },

  /* ── NUEVO EN EL PROYECTO EDUCATIVO ─────────────────────────────────── */

  /* Medidas físicas desde la calibración del panel (en mm) → unidades de la v1 (u) */
  recalibrar(cal) {
    CONFIG.ejeX = cal.ejeXmm / CONFIG.markerMm;
    CONFIG.ejeY = cal.ejeYmm / CONFIG.markerMm;
    CONFIG.altoColmenaMm = cal.altoColmenaMm;
    if (this.jardin) this.crearFlores();
    this.terminarDestacada();            // los índices de flores cambian
  },

  florDe(b) { return Math.floor(b.fl * this.flores.length) % this.flores.length; },

  /* Toque sobre las flores: distancia del rayo al segmento base → cabeza de cada flor, en
     coordenadas de la escena (u). Devuelve el índice de la flor más cercana a la cámara, o −1. */
  elegirFlor(raycaster) {
    if (!this.escena.visible || !this.flores.length) return -1;
    const T = this.tocaTmp || (this.tocaTmp = { ray: new THREE.Ray(), inv: new THREE.Matrix4(),
      pr: new THREE.Vector3(), ps: new THREE.Vector3() });
    this.escena.updateMatrixWorld();
    T.ray.copy(raycaster.ray).applyMatrix4(T.inv.copy(this.escena.matrixWorld).invert());
    let mejor = -1, mejorT = Infinity;
    this.flores.forEach((f, k) => {
      const d2 = T.ray.distanceSqToSegment(f.base || f.cabeza, f.cabeza, T.pr, T.ps);
      const r = f.radio + 0.09;                         // ~4 mm de tolerancia alrededor del tallo
      const tRayo = T.pr.distanceTo(T.ray.origin);
      if (d2 < r * r && tRayo < mejorT) { mejor = k; mejorT = tRayo; }
    });
    return mejor;
  },

  /* Destaca la próxima abeja que vaya a la flor k: más grande, con estela y polen a la vuelta */
  destacarFlor(k) {
    this.terminarDestacada();
    if (k < 0) return;
    this.destacada = { flor: k, i: -1, volo: false, puntos: [] };
    if (!this.estela) {
      const N = this.ESTELA_N = 60;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      this.estela = new THREE.Line(g, new THREE.LineBasicMaterial({ color: PALETA.naranja, transparent: true, opacity: 0.8 }));
      this.estela.frustumCulled = false;
      this.escena.add(this.estela);
      // Polen: dos bolitas en las patas traseras (coordenadas locales de la abeja: +Z adelante, +Y arriba)
      const geo = new THREE.SphereGeometry(0.09, 10, 8);
      const mat = new THREE.MeshLambertMaterial({ color: '#f2b632' });
      this.polen = [-1, 1].map((lado) => {
        const m = new THREE.Mesh(geo, mat);
        m.matrixAutoUpdate = false;
        m.frustumCulled = false;
        m.userData.local = new THREE.Matrix4().makeTranslation(0.16 * lado, -0.2, -0.1);
        this.escena.add(m);
        return m;
      });
    }
    this.estela.visible = false;
    this.polen.forEach((m) => (m.visible = false));
  },

  seguirDestacada(b, t, P, M) {
    const d = this.destacada, v = b.vj;
    d.volo = true;
    // Estela: un punto nuevo cada ~2,5 mm recorridos (0,055 u)
    const ult = d.puntos[d.puntos.length - 1];
    if (!ult || ult.distanceToSquared(P) > 0.003) {
      d.puntos.push(P.clone());
      if (d.puntos.length > this.ESTELA_N) d.puntos.shift();
      const arr = this.estela.geometry.attributes.position.array;
      d.puntos.forEach((p, j) => p.toArray(arr, j * 3));
      this.estela.geometry.setDrawRange(0, d.puntos.length);
      this.estela.geometry.attributes.position.needsUpdate = true;
    }
    this.estela.visible = d.puntos.length > 1;
    // Polen: desde la mitad del tiempo en la flor hasta que entra a la colmena
    const conPolen = t > v.tS + v.tI + 0.5 * v.tF;
    for (const m of this.polen) {
      m.visible = conPolen;
      if (conPolen) { m.matrix.multiplyMatrices(M, m.userData.local); m.matrixWorldNeedsUpdate = true; }
    }
  },

  terminarDestacada() {
    this.destacada = null;
    if (this.estela) this.estela.visible = false;
    this.polen?.forEach((m) => (m.visible = false));
  },

  contarFps(dt) {
    const f = this.fps; f.n++; f.t += dt;
    if (f.t >= 0.5) { f.valor = Math.round(f.n / f.t); f.n = 0; f.t = 0; }
  },
});
