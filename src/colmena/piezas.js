/* La colmena virtual alineada con la real.

   Cada parte tocable tiene:
   - mallas: la forma real (STL). Si la parte existe impresa, la malla es un OCLUSOR: invisible
     (colorWrite: false) pero escribe profundidad, así tapa lo virtual que pasa por detrás.
     Si la parte es virtual (el panel solar, que no tiene lugar fijo), la malla se ve.
   - zona: una caja invisible algo más grande, que es la que recibe el toque. Separarla del
     oclusor deja agrandar las partes chicas sin deformar la oclusión.
   - resaltado: contorno y relleno naranja, apenas por fuera de la superficie de la malla. */
import { MARKER_MM, ESCALA_IMPRESION, PIEZAS, PALETA } from '../config.js';
import { cargarSTL, separarPorHuecos } from './stl.js';

const THREE = AFRAME.THREE;
const RAD = Math.PI / 180;

/* Partes tocables. prioridad: si un toque cae a la vez en una zona chica y en una grande
   (las zonas se superponen al agrandarlas), gana la de prioridad más alta. */
export const PARTES = [
// color: el del filamento impreso, para la copia que vuela a la ficha y para su foto
  { id: 'tapa', nombre: 'Tapa', grupo: 'colmena', prioridad: 1, margenMm: 0.5, color: PALETA.pla },
  { id: 'cuerpo', nombre: 'Cuerpo', grupo: 'colmena', prioridad: 1, margenMm: 0.5, color: PALETA.pla },
  { id: 'soporte', nombre: 'Soporte', grupo: 'colmena', prioridad: 1, margenMm: 0.5, color: PALETA.pla },
  { id: 'celdas', nombre: 'Celdas de carga', grupo: 'airux', prioridad: 2, margenMm: 3, color: PALETA.naranjaImpreso },
  { id: 'caja', nombre: 'Caja estanca', grupo: 'airux', prioridad: 3, margenMm: 3, color: PALETA.naranjaImpreso },
  { id: 'panel_solar', nombre: 'Panel solar', grupo: 'airux', prioridad: 3, margenMm: 2, color: '#c9c9c4' },
];

const TOLERANCIA_TOQUE_MM = 8;   // entre el primer impacto y uno de prioridad mayor
const HOLGURA_RESALTADO_MM = 0.4;

/* Color por vértice según hacia dónde mira cada triángulo: los que miran como "normal" (con
   tolerancia de ~25°) llevan colorSi, el resto colorNo. Sirve para la placa del panel solar. */
function pintarPorNormal(geo, normal, colorSi, colorNo) {
  const p = geo.attributes.position, n = new THREE.Vector3().fromArray(normal).normalize();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const si = new THREE.Color(colorSi), no = new THREE.Color(colorNo);
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const cara = b.sub(a).cross(c.sub(a)).normalize();
    const k = cara.dot(n) > 0.9 ? si : no;
    for (let j = 0; j < 3; j++) k.toArray(col, (i + j) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
}

export class Colmena {
  constructor(raiz) {
    // Grupo en mm: adentro, 1 unidad = 1 mm (MindAR: 1 u = ancho del marker)
    this.mm = new THREE.Group();
    this.mm.scale.setScalar(1 / MARKER_MM);
    raiz.add(this.mm);

    this.mat = {
      oclusor: new THREE.MeshBasicMaterial({ colorWrite: false }),
      oclusorDebug: new THREE.MeshBasicMaterial({ color: 0xff2f6d, transparent: true, opacity: 0.28, depthWrite: false }),
      zona: new THREE.MeshBasicMaterial({ color: 0x35d07f, wireframe: true, visible: false }),
      madera: new THREE.MeshLambertMaterial({ color: PALETA.madera }),
      maderaOscura: new THREE.MeshLambertMaterial({ color: '#b8894a' }),
      visible: new THREE.MeshLambertMaterial({ vertexColors: true }),   // partes virtuales, con color por vértice
      borde: new THREE.LineBasicMaterial({ color: PALETA.naranja }),
      relleno: new THREE.MeshBasicMaterial({ color: PALETA.naranja, transparent: true, opacity: 0, depthWrite: false }),
    };
    this.partes = new Map(PARTES.map((p) => [p.id, { ...p, mallas: [], zona: null, resaltes: [] }]));
    this.interior = new THREE.Group();
    this.interior.visible = false;          // hasta que exista la linterna de rayos X
    this.mm.add(this.interior);
    this.ayudas = new THREE.Group();
    this.ayudas.visible = false;
    this.mm.add(this.ayudas);
    this.vista = { oclusores: false, zonas: false };
    this.resaltada = null;
    this.tResalte = 0;
    this.listo = false;
    this.tmp = { v: new THREE.Vector3(), b: new THREE.Box3() };
  }

  async cargar() {
    const base = './assets/stl/';
    // Las piezas de la colmena son obligatorias (de ellas salen las medidas); el panel solar no:
    // si falta su STL, la experiencia sigue sin él y queda el aviso en la consola.
    const cargar = (p) => cargarSTL(base + p.stl, p.escala ?? ESCALA_IMPRESION);
    const [cuerpo, celda, soporte, caja, marcos10, alimentador] = await Promise.all(
      [PIEZAS.cuerpo, PIEZAS.celda, PIEZAS.soporte, PIEZAS.caja, PIEZAS.marcos, PIEZAS.alimentador].map(cargar));
    const panel = await cargar(PIEZAS.panel).catch((e) => {
      console.warn('Sin panel solar:', e.message);
      this.partes.delete('panel_solar');
      return null;
    });
    this.geo = { cuerpo, celda, soporte, caja };

    // Medidas que salen de las mallas (en mm, ya en ejes de la tapa)
    const tam = (g) => g.boundingBox.getSize(new THREE.Vector3());
    const sC = tam(cuerpo), sCel = tam(celda), sS = tam(soporte), sCaja = tam(caja);
    this.med = {
      cuerpoX: sC.y, cuerpoY: sC.x, cuerpoAlto: sC.z,      // girado 90° en Z
      celdaLargo: sCel.x, celdaAlto: sCel.z,
      soporteAlto: sS.z,
      cajaAncho: sCaja.x, cajaAltoZ: sCaja.y, cajaEspesor: sCaja.z,   // girada 90° en X
    };
    this.med.altoNatural = PIEZAS.tapa.techo + this.med.cuerpoAlto + this.med.celdaAlto + this.med.soporteAlto;

    // Oclusores de las partes impresas
    const tapaGeo = new THREE.BoxGeometry(PIEZAS.tapa.ancho, PIEZAS.tapa.largo, PIEZAS.tapa.alto);
    tapaGeo.computeBoundingBox();
    this.agregarMalla('tapa', tapaGeo, true);
    this.agregarMalla('cuerpo', cuerpo, true);
    this.agregarMalla('celdas', celda, true);
    this.agregarMalla('celdas', celda, true);
    this.agregarMalla('soporte', soporte, true);
    this.agregarMalla('caja', caja, true);

    // Panel solar: virtual y visible, apoyado en el piso al lado de la colmena (la pieza impresa
    // no tiene lugar fijo). Las caras que miran como la placa del panel van azul oscuro.
    if (panel) {
      pintarPorNormal(panel, PIEZAS.panel.normalCeldas, '#24324a', '#c9c9c4');
      this.agregarMalla('panel_solar', panel, false);
    }

    // Interior: un marco separado de la fila de 10, repetido
    const sueltos = separarPorHuecos(marcos10, 0);
    if (sueltos.length !== 10) console.warn(`marcos_10x.stl: esperaba 10 marcos y encontré ${sueltos.length}`);
    this.marco = sueltos[0];
    this.marcos = Array.from({ length: PIEZAS.marcos.cantidad }, () => {
      const m = new THREE.Mesh(this.marco, this.mat.madera);
      this.interior.add(m);
      return m;
    });
    this.alimentador = null;
    if (PIEZAS.alimentador.incluir) {
      this.alimentador = new THREE.Mesh(alimentador, this.mat.maderaOscura);
      this.interior.add(this.alimentador);
    }

    // Zonas táctiles (una caja por parte; se dimensionan en colocar())
    for (const p of this.partes.values()) {
      p.zona = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.mat.zona);
      p.zona.userData.parte = p.id;
      this.mm.add(p.zona);
    }

    this.armarAyudas();
    // Textura de la cara superior de la tapa (la misma imagen del marker), para su copia y su foto
    this.texTapa = await new Promise((ok) => new THREE.TextureLoader().load('./targets/tapa.jpg',
      (t) => { t.colorSpace = THREE.SRGBColorSpace; ok(t); }, undefined, () => ok(null)));
    this.listo = true;
  }

  /* Copia visible de una parte, centrada en su caja envolvente (en mm). La usan el vuelo hacia la
     ficha y la foto de la ficha. Cada llamada crea materiales propios (el vuelo les cambia la opacidad). */
  fantasma(id) {
    const p = this.partes.get(id);
    const centro = p.zona.position.clone();
    const radioMm = Math.max(1, p.zona.scale.length() / 2 - p.margenMm);
    const grupo = new THREE.Group();
    const mats = [];
    const nuevoMat = (extra = {}) => {
      const m = new THREE.MeshLambertMaterial({ color: p.color, ...extra });
      mats.push(m);
      return m;
    };
    for (const m of p.mallas) {
      let mat = m.geometry.attributes.color ? nuevoMat({ vertexColors: true, color: '#ffffff' }) : nuevoMat();
      if (id === 'tapa' && this.texTapa) {
        // BoxGeometry: el material 4 es la cara +Z, que es la imagen del marker
        mat = [mat, mat, mat, mat, nuevoMat({ map: this.texTapa, color: '#ffffff' }), mat];
      }
      const c = new THREE.Mesh(m.geometry, mat);
      m.updateMatrix();
      c.matrixAutoUpdate = false;
      c.matrix.makeTranslation(-centro.x, -centro.y, -centro.z).multiply(m.matrix);
      grupo.add(c);
    }
    return { grupo, centro, radioMm, mats };
  }

  /* Agrega una malla a una parte, con su contorno y su relleno de resaltado como hijos */
  agregarMalla(id, geo, esOclusor) {
    const parte = this.partes.get(id);
    const m = new THREE.Mesh(geo, esOclusor ? this.mat.oclusor : this.mat.visible);
    m.userData.oclusor = esOclusor;
    m.renderOrder = esOclusor ? -1 : 0;              // los oclusores se dibujan antes que todo
    m.rotation.order = 'ZYX';                        // primero el giro en X, después el de Z
    this.mm.add(m);
    parte.mallas.push(m);

    // Resaltado: copia apenas agrandada (holgura fija en mm por eje, para no pelear en profundidad)
    const s = geo.boundingBox.getSize(new THREE.Vector3());
    const h = HOLGURA_RESALTADO_MM * 2;
    const r = new THREE.Group();
    r.scale.set((s.x + h) / s.x, (s.y + h) / s.y, (s.z + h) / s.z);
    const borde = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), this.mat.borde);
    const relleno = new THREE.Mesh(geo, this.mat.relleno);
    borde.renderOrder = 5;
    relleno.renderOrder = 4;
    r.add(borde, relleno);
    r.visible = false;
    m.add(r);
    parte.resaltes.push(r);
    return m;
  }

  /* Ubica todo según la calibración. Es barato: se llama en cada cambio de slider. */
  colocar(cfg) {
    if (!this.listo) return;
    const M = this.med, P = this.partes;
    const ex = cfg.ejeXmm, ey = cfg.ejeYmm;
    // Si la pieza real es más alta o más baja que la suma de las mallas, se corre todo lo
    // que está debajo de la tapa (lo más probable es que la tapa calce distinto).
    const zTop = -PIEZAS.tapa.techo - (cfg.altoColmenaMm - M.altoNatural);
    const zCeldas = zTop - M.cuerpoAlto - M.celdaAlto / 2;
    const zSoporte = zTop - M.cuerpoAlto - M.celdaAlto - M.soporteAlto / 2;

    const ubicar = (m, x, y, z, rx = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.set(rx * RAD, 0, rz * RAD); };

    ubicar(P.get('tapa').mallas[0], 0, 0, -PIEZAS.tapa.alto / 2);
    ubicar(P.get('cuerpo').mallas[0], ex, ey, zTop - M.cuerpoAlto / 2, 0, PIEZAS.cuerpo.giroZ);
    P.get('celdas').mallas.forEach((m, i) =>
      ubicar(m, ex + (i ? 1 : -1) * cfg.celdasSepMm / 2, ey, zCeldas, 0, PIEZAS.celda.giroZ));
    ubicar(P.get('soporte').mallas[0], ex, ey, zSoporte, PIEZAS.soporte.giroX, cfg.soporteGiro90 ? 90 : 0);

    // Caja estanca: dorso contra la punta de la celda de carga, en la cara que diga cajaLado.
    // cajaXmm es "hacia la derecha mirando la caja de frente": en la cara −Y es +X, en la +Y es −X.
    const L = cfg.cajaLado < 0 ? -1 : 1;
    const asoma = Math.max(0, M.celdaLargo - M.cuerpoY) / 2;
    const cx = ex - L * cfg.cajaXmm;
    const cy = ey + L * (M.cuerpoY / 2 + asoma + M.cajaEspesor / 2);
    ubicar(P.get('caja').mallas[0], cx, cy, cfg.cajaZmm, PIEZAS.caja.giroX, L > 0 ? 180 : 0);

    // Panel solar: en el piso, del lado de la caja, con las celdas mirando hacia afuera
    if (P.has('panel_solar')) {
      const PS = PIEZAS.panel, mPanel = P.get('panel_solar').mallas[0];
      const zPiso = zTop - M.cuerpoAlto - M.celdaAlto - M.soporteAlto;
      const altoPanel = mPanel.geometry.boundingBox.max.z - mPanel.geometry.boundingBox.min.z;
      ubicar(mPanel, ex - L * PS.pisoXmm, ey + L * PS.pisoYmm, zPiso + altoPanel / 2, 0, (L > 0 ? 180 : 0) + PS.giroZ);
    }

    // Interior: alimentador contra la pared −X y los marcos pegados, colgando del borde superior.
    // Con las mallas del 3MF, 9 marcos + alimentador miden ~1 mm más que el interior: en la pieza
    // real entran apretados, así que si sobra se achica el paso para que no se encimen.
    const ancho = M.cuerpoX - 2 * PIEZAS.cuerpo.paredMm;
    const bm = this.marco.boundingBox;
    const t = bm.max.x - bm.min.x, hM = bm.max.z - bm.min.z;
    const ba = this.alimentador?.geometry.boundingBox;
    const w = ba ? ba.max.x - ba.min.x : 0;
    const total = w + t * this.marcos.length;
    const k = Math.min(1, ancho / total);
    if (k < 1 && !this.avisoInterior) {
      console.info(`Interior: ${total.toFixed(1)} mm en ${ancho.toFixed(1)} mm de ancho; paso reducido al ${(k * 100).toFixed(0)}%`);
      this.avisoInterior = true;
    }
    let x = ex - ancho / 2;
    if (this.alimentador) { ubicar(this.alimentador, x + (w * k) / 2, ey, zTop - hM / 2); x += w * k; }
    for (const m of this.marcos) { ubicar(m, x + (t * k) / 2, ey, zTop - hM / 2); x += t * k; }

    this.dimensionarZonas();
  }

  /* Cada zona = caja envolvente de las mallas de su parte, más un margen */
  dimensionarZonas() {
    const b = this.tmp.b, caja = new THREE.Box3();
    for (const p of this.partes.values()) {
      caja.makeEmpty();
      for (const m of p.mallas) {
        m.updateMatrix();
        caja.union(b.copy(m.geometry.boundingBox).applyMatrix4(m.matrix));
      }
      caja.expandByScalar(p.margenMm);
      caja.getCenter(p.zona.position);
      caja.getSize(p.zona.scale);
    }
  }

  armarAyudas() {
    const ejes = new THREE.AxesHelper(20);
    ejes.position.z = 0.2;
    this.ayudas.add(ejes);
    const a = PIEZAS.tapa.ancho / 2, l = PIEZAS.tapa.largo / 2;
    const contorno = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-a, -l, 0.2), new THREE.Vector3(a, -l, 0.2),
      new THREE.Vector3(a, l, 0.2), new THREE.Vector3(-a, l, 0.2)]);
    this.ayudas.add(new THREE.LineLoop(contorno, new THREE.LineBasicMaterial({ color: 0x00e5ff })));
  }

  /* Vistas de depuración */
  verOclusores(si) {
    this.vista.oclusores = si;
    for (const p of this.partes.values()) for (const m of p.mallas) {
      if (!m.userData.oclusor) continue;
      m.material = si ? this.mat.oclusorDebug : this.mat.oclusor;
      m.renderOrder = si ? 3 : -1;
    }
  }
  verZonas(si) { this.mat.zona.visible = si; }
  verInterior(si) { this.interior.visible = si; }
  verAyudas(si) { this.ayudas.visible = si; }

  /* Toque: entre las zonas impactadas, se queda con las que están cerca del primer impacto
     (así no se elige algo del otro lado de la colmena) y de esas, la de mayor prioridad. */
  elegir(raycaster) {
    if (!this.listo) return null;
    const zonas = [...this.partes.values()].map((p) => p.zona);
    const hits = raycaster.intersectObjects(zonas, false);
    if (!hits.length) return null;
    const escala = this.mm.getWorldScale(this.tmp.v).x;     // mm → unidades del mundo
    const limite = hits[0].distance + TOLERANCIA_TOQUE_MM * escala;
    let mejor = null;
    for (const h of hits) {
      if (h.distance > limite) break;
      const p = this.partes.get(h.object.userData.parte);
      if (!mejor || p.prioridad > mejor.prioridad) mejor = p;
    }
    return mejor;
  }

  resaltar(id) {
    for (const p of this.partes.values()) p.resaltes.forEach((r) => (r.visible = p.id === id));
    this.resaltada = id;
    this.tResalte = 0;
  }

  /* Relleno: un destello al tocar que baja a un tono suave y queda mientras está elegida */
  tick(dt) {
    if (!this.resaltada) return;
    this.tResalte += dt;
    const k = Math.exp(-this.tResalte / 0.5);
    this.mat.relleno.opacity = 0.14 + 0.36 * k * (0.5 + 0.5 * Math.cos(this.tResalte * 9));
  }
}
