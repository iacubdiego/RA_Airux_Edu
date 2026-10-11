/* Pistas: un punto naranja que late sobre cada parte que todavía no se descubrió. Desaparece
   cuando se descubre. Los puntos del interior (marcos, panal, cría) no tienen pista propia:
   para ellos late el botón de Rayos X (main.js).

   Cada pista es un Sprite (siempre mira a la cámara) dentro del grupo en mm de la colmena,
   apenas por fuera de la cara de su parte que da hacia el lado de la caja (el "frente").
   Usa profundidad: si la parte queda del otro lado de la colmena, la pista se oculta sola. */
import { estado } from '../estado.js';

const THREE = AFRAME.THREE;
const TAM_MM = 5;
const AFUERA_MM = 1.5;            // separación de la superficie (además del margen de la zona)
export const EXTERIORES = ['tapa', 'cuerpo', 'soporte', 'celdas', 'caja', 'panel_solar', 'flores'];

function texturaPista() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.lineWidth = 16; g.strokeStyle = 'rgba(48, 24, 7, .55)';            // borde oscuro: se ve sobre el PLA blanco
  g.beginPath(); g.arc(64, 64, 50, 0, 6.3); g.stroke();
  g.lineWidth = 10; g.strokeStyle = '#ffb129';
  g.beginPath(); g.arc(64, 64, 50, 0, 6.3); g.stroke();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(64, 64, 17, 0, 6.3); g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Pistas {
  /* v1: función que devuelve el componente escena-v1 (para ubicar la pista de las flores) */
  constructor(colmena, v1, { sinMovimiento = false } = {}) {
    this.c = colmena;
    this.v1 = v1;
    this.sinMovimiento = sinMovimiento;
    this.t = 0;
    this.anclas = new Map();          // id → Vector3 en mm (las flores se calculan en cada cuadro)
    this.enfasis = null;              // la pista hacia la que va la abeja guía late más fuerte
    this.tmp = new THREE.Vector3();
    const mat = new THREE.SpriteMaterial({ map: texturaPista(), transparent: true, depthWrite: false });
    this.sprites = new Map(EXTERIORES.filter((id) => id === 'flores' || colmena.partes.has(id)).map((id) => {
      const s = new THREE.Sprite(mat);
      s.scale.setScalar(TAM_MM);
      s.renderOrder = 6;
      s.visible = false;
      colmena.mm.add(s);
      return [id, s];
    }));
  }

  /* Recalcula dónde va cada pista. Se llama después de colmena.colocar(cfg). */
  colocar(cfg) {
    const L = cfg.cajaLado < 0 ? -1 : 1;
    const z = (p) => ({ c: p.zona.position, s: p.zona.scale });
    const frente = (id, dx = 0, dzRel = 0) => {
      const { c, s } = z(this.c.partes.get(id));
      return new THREE.Vector3(c.x + dx, c.y + L * (s.y / 2 + AFUERA_MM), c.z + dzRel * s.z);
    };
    const P = this.c.partes;
    // "dx" en la convención de la caja: positivo = a la derecha mirando de frente
    const der = (mm) => -L * mm;
    if (P.has('tapa')) {           // sobre la tapa, en una esquina, lejos del logo
      const { c, s } = z(P.get('tapa'));
      this.anclas.set('tapa', new THREE.Vector3(c.x + der(-14), c.y + L * (s.y / 2 - 7), c.z + s.z / 2 + AFUERA_MM));
    }
    this.anclas.set('cuerpo', frente('cuerpo', der(-8), 0.1));
    this.anclas.set('soporte', frente('soporte', der(-17), -0.15));
    // Celdas: la punta de la izquierda (la de la derecha queda detrás de la caja)
    const celda = P.get('celdas').mallas.reduce((a, b) => (der(1) * (a.position.x - b.position.x) < 0 ? a : b));
    const zc = z(P.get('celdas'));
    this.anclas.set('celdas', new THREE.Vector3(celda.position.x, zc.c.y + L * (zc.s.y / 2 + AFUERA_MM), celda.position.z));
    this.anclas.set('caja', frente('caja'));
    if (P.has('panel_solar')) {
      const { c, s } = z(P.get('panel_solar'));
      this.anclas.set('panel_solar', new THREE.Vector3(c.x, c.y, c.z + s.z / 2 + AFUERA_MM + 1));
    }
  }

  /* Posición de la pista en mm (grupo de la colmena), o null si todavía no se puede ubicar */
  anclaje(id, out = new THREE.Vector3()) {
    if (id !== 'flores') return this.anclas.has(id) ? out.copy(this.anclas.get(id)) : null;
    const v1 = this.v1();
    const f = v1?.flores?.[0];
    if (!f || !v1.escena.visible) return null;
    // La flor vive en la escena filtrada de la v1 (en u): de ahí al mundo y del mundo a mm
    out.copy(f.cabeza);
    out.z += 0.12;                                    // un poco arriba de la cabeza (≈ 5,6 mm)
    v1.escena.localToWorld(out);
    return this.c.mm.worldToLocal(out);
  }

  pendientes() {
    return [...this.sprites.keys()].filter((id) => !estado.descubiertos.has(id));
  }

  tick(dt, visible) {
    this.t += dt;
    for (const [id, s] of this.sprites) {
      const ver = visible && !estado.descubiertos.has(id) && this.anclaje(id, this.tmp);
      s.visible = !!ver;
      if (!ver) continue;
      s.position.copy(this.tmp);
      const fuerte = this.enfasis === id;
      const latido = this.sinMovimiento ? 0 : Math.sin(this.t * (fuerte ? 7 : 4) + id.length);
      s.scale.setScalar(TAM_MM * (fuerte ? 1.35 : 1) * (1 + 0.18 * latido));
    }
  }
}
