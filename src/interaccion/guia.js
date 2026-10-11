/* Abeja guía: si pasa un rato sin que nadie descubra nada, sale una abeja grande de la tapa,
   vuela hasta una parte que falta, la ronda unos segundos (su pista late más fuerte) y vuelve a
   entrar. Prioriza los puntos esenciales. No interrumpe: no sale con una ficha abierta, y si la
   parte se descubre mientras vuela, se vuelve.

   Coordenadas: grupo en mm de la colmena (origen en el centro de la cara superior de la tapa,
   +Z hacia arriba). La abeja usa la geometría de la v1: +Z adelante, +Y lomo, largo ≈ 1. */
import { estado } from '../estado.js';
import { geometriaAbeja, geometriaAla } from '../v1/escena-v1.js';
import { PALETA } from '../config.js';

const THREE = AFRAME.THREE;
const T = {
  espera: 12,          // s sin descubrir nada antes de salir
  ida: 2.4, ronda: 4, vuelta: 2.2,
  largoMm: 9,          // más grande que las del enjambre (5 mm), para que se note que es otra cosa
  rondaMm: 5,          // radio del círculo alrededor de la pista
  haciaCamaraMm: 8,    // se pone delante de la pista, del lado de la cámara
};
const NIDO = new THREE.Vector3(0, 0, -3);   // debajo de la superficie de la tapa: entra y sale oculta

const suave = (t) => t * t * (3 - 2 * t);
function bezier(p0, p1, p2, p3, t, out) {
  const u = 1 - t;
  return out.set(0, 0, 0).addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t)
    .addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t);
}

export class Guia {
  constructor({ colmena, pistas, escena, desactivada = false }) {
    Object.assign(this, { c: colmena, pistas, escena, desactivada });
    this.estado = 'quieta';
    this.inactividad = 0;
    this.t = 0;
    this.reloj = 0;

    this.grupo = new THREE.Group();
    this.grupo.matrixAutoUpdate = false;
    this.grupo.visible = false;
    const cuerpo = new THREE.Mesh(geometriaAbeja(), new THREE.MeshLambertMaterial({ vertexColors: true }));
    cuerpo.matrixAutoUpdate = false;
    const matAla = new THREE.MeshBasicMaterial({ color: PALETA.marron, transparent: true, opacity: 0.35,
      side: THREE.DoubleSide, depthWrite: false });
    this.alas = [0, 1].map(() => {
      const a = new THREE.Mesh(geometriaAla(), matAla);
      a.matrixAutoUpdate = false;
      a.renderOrder = 2;
      return a;
    });
    this.grupo.add(cuerpo, ...this.alas);
    colmena.mm.add(this.grupo);

    this.v = {
      P: new THREE.Vector3(), Pant: new THREE.Vector3(), dir: new THREE.Vector3(), ancla: new THREE.Vector3(),
      cam: new THREE.Vector3(), X: new THREE.Vector3(), Y: new THREE.Vector3(), up: new THREE.Vector3(0, 0, 1),
      a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3(), d: new THREE.Vector3(),
    };
    this.base = new THREE.Matrix4();          // orientación (sin escala ni posición)
    this.m = { T: new THREE.Matrix4().makeTranslation(0.1, 0.15, 0.12), Rz: new THREE.Matrix4(),
      Ry: new THREE.Matrix4().makeRotationY(0.55), Wl: new THREE.Matrix4(), ESPEJO: new THREE.Matrix4().makeScale(-1, 1, 1) };
  }

  /* Cualquier toque o descubrimiento reinicia la espera */
  actividad() { this.inactividad = 0; }

  elegirDestino() {
    const pend = this.pistas.pendientes();
    if (!pend.length) return null;
    const esencial = pend.filter((id) => estado.punto(id)?.esencial);
    const lista = esencial.length ? esencial : pend;
    return lista.find((id) => this.pistas.anclaje(id, this.v.a)) || null;
  }

  /* Punto de ronda: delante de la pista (hacia la cámara, en horizontal) y un poco arriba */
  puntoRonda(id, out) {
    if (!this.pistas.anclaje(id, out)) return null;
    this.escena.camera.getWorldPosition(this.v.cam);
    this.c.mm.worldToLocal(this.v.cam);
    const h = this.v.d.subVectors(this.v.cam, out).setZ(0);
    if (h.lengthSq() > 1e-6) out.addScaledVector(h.normalize(), T.haciaCamaraMm);
    out.z += 4;
    return out;
  }

  tick(dt, { visible, fichaAbierta }) {
    this.reloj += dt;
    if (this.desactivada) return;
    this.grupo.visible = visible && this.estado !== 'quieta';
    if (!visible) return;

    if (this.estado === 'quieta') {
      if (!fichaAbierta) this.inactividad += dt;
      if (this.inactividad < T.espera) return;
      this.destino = this.elegirDestino();
      this.inactividad = 0;
      if (!this.destino) return;
      this.estado = 'ida'; this.t = 0;
      this.pistas.enfasis = this.destino;
      this.grupo.visible = true;
      this.v.Pant.copy(NIDO);
    }

    const v = this.v;
    this.t += dt;
    // Si la descubrieron mientras volaba, se vuelve
    if (this.estado !== 'vuelta' && estado.descubiertos.has(this.destino)) this.volver();
    const ronda = this.puntoRonda(this.destino, v.ancla) || v.ancla;

    if (this.estado === 'ida') {
      const k = suave(Math.min(1, this.t / T.ida));
      // Sale para arriba, después va hacia el punto de ronda
      v.a.copy(NIDO); v.b.set(NIDO.x, NIDO.y, 22);
      v.c.copy(ronda); v.c.z += 14;
      bezier(v.a, v.b, v.c, ronda, k, v.P);
      if (this.t >= T.ida) { this.estado = 'ronda'; this.t = 0; }
    } else if (this.estado === 'ronda') {
      const ang = this.t * 2.2;
      v.P.copy(ronda).add(v.a.set(Math.cos(ang) * T.rondaMm, Math.sin(ang) * T.rondaMm, Math.sin(ang * 2) * 1.5));
      if (this.t >= T.ronda) this.volver();
    } else if (this.estado === 'vuelta') {
      const k = suave(Math.min(1, this.t / T.vuelta));
      v.c.copy(this.desde); v.c.z += 12;
      v.d.set(NIDO.x, NIDO.y, 20);
      bezier(this.desde, v.c, v.d, NIDO, k, v.P);
      if (this.t >= T.vuelta) {
        this.estado = 'quieta'; this.grupo.visible = false; this.pistas.enfasis = null;
        return;
      }
    }

    // Orientación: hacia donde se mueve, con el lomo hacia arriba
    v.dir.subVectors(v.P, v.Pant);
    if (v.dir.lengthSq() > 1e-8) {
      v.dir.normalize();
      v.X.crossVectors(v.up, v.dir);
      if (v.X.lengthSq() < 1e-6) v.X.set(1, 0, 0);
      v.X.normalize();
      v.Y.crossVectors(v.dir, v.X);
      this.base.makeBasis(v.X, v.Y, v.dir);
    }
    this.grupo.matrix.copy(this.base).scale(v.a.setScalar(T.largoMm)).setPosition(v.P);
    this.grupo.matrixWorldNeedsUpdate = true;
    v.Pant.copy(v.P);

    // Alas: el mismo aleteo que el enjambre de la v1
    const aleteo = 0.2 + 0.9 * Math.sin(this.reloj * Math.PI * 2 * 16);
    const { T: Tm, Rz, Ry, Wl, ESPEJO } = this.m;
    Wl.multiplyMatrices(Tm, Rz.makeRotationZ(aleteo)).multiply(Ry);
    this.alas[0].matrix.copy(Wl);
    this.alas[1].matrix.multiplyMatrices(ESPEJO, Wl);
  }

  volver() {
    if (this.estado === 'vuelta' || this.estado === 'quieta') return;
    this.desde = this.v.P.clone();
    this.estado = 'vuelta'; this.t = 0;
  }
}
