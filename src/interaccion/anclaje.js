/* Anclaje: dos cosas sobre la pose que entrega MindAR.

   1) INCLINACIÓN. MindAR solo sabe dónde está la imagen respecto de la cámara, no dónde está el
      piso. El celular sí sabe dónde está la gravedad (evento deviceorientation). Juntando las dos
      cosas se calcula el ángulo entre la normal de la tapa y la vertical: si la tapa está muy
      inclinada (en la mano, una foto en la pared), la escena se oculta y se pide apoyarla.
      Con histéresis (se oculta a +UMBRAL, vuelve a −HISTERESIS) y un tiempo mínimo, para que no
      parpadee en el límite. Sin sensor (compu, permiso negado) no se chequea.

   2) FIRMEZA. Las correcciones chicas del tracking (el temblor) se ignoran: mientras la pose
      nueva difiera de la mostrada en menos que una zona muerta (mm y grados), la escena no se
      mueve. Si la diferencia la supera (el celular se movió de verdad), la escena la sigue rápido
      y vuelve a quedarse quieta. Con ?fijo la zona muerta es grande y se activa después de unos
      segundos de captura estable: para un celular en un soporte fijo (kiosco).
      No se puede "congelar" del todo: MindAR no sabe cómo se mueve el celular, así que una pose
      congelada se movería pegada a la pantalla.

   Cómo se aplica: los grupos raíz de colmena-edu y escena-v1 cuelgan del target. Cada cuadro
   reciben la matriz corrección = inversa(pose de MindAR) · pose mostrada, así en el mundo quedan
   en la pose mostrada. Coordenadas: las del mundo de A-Frame, con la cámara de MindAR en el
   origen sin rotar (su sistema de ejes es el de la pantalla: +X derecha, +Y arriba). */
import { MARKER_MM } from '../config.js';

const THREE = AFRAME.THREE;
const RAD = Math.PI / 180;

export const ANCLAJE = {
  inclinacionMax: 30,       // grados entre la normal de la tapa y la vertical
  histeresis: 6,            // vuelve a mostrarse por debajo de inclinacionMax − histeresis
  sostener: 0.4,            // s que tiene que mantenerse una condición para cambiar de estado
  firme: { mm: 1.5, grados: 1.2 },
  fijo: { mm: 8, grados: 5, estableSeg: 2 },
  seguir: 0.08,             // s: qué tan rápido alcanza a la pose nueva cuando se movió de verdad
};

/* Estado compartido: lo leen main.js y escena-v1.js */
export const anclaje = { oculto: false, inclinacion: null, sensor: false };

/* iOS 13+ pide permiso para los sensores de movimiento, y solo dentro de un toque */
export function pedirSensores() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    return D.requestPermission().then((r) => r === 'granted').catch(() => false);
  }
  return Promise.resolve(!!D);
}

export class Anclaje {
  constructor({ target, raices, fijo = false }) {
    this.target = target;
    this.raices = raices;           // función que devuelve los grupos raíz a corregir
    this.modoFijo = fijo;
    this.beta = null; this.gamma = null;
    this.mostrada = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(1, 1, 1) };
    this.cruda = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3() };
    this.siguiendo = false;
    this.hayPose = false;
    this.estable = 0;
    this.cambio = 0;                // s que lleva la condición contraria al estado actual
    this.tmp = { m: new THREE.Matrix4(), inv: new THREE.Matrix4(), n: new THREE.Vector3(), g: new THREE.Vector3() };
    addEventListener('deviceorientation', (e) => {
      if (e.beta == null || e.gamma == null) return;
      this.beta = e.beta; this.gamma = e.gamma;
      anclaje.sensor = true;
    });
  }

  /* Vertical ("arriba") en el sistema de la cámara/pantalla, desde beta y gamma del celular.
     Abajo en ejes del dispositivo: (cosβ·sinγ, −sinβ, −cosβ·cosγ); después se rota según la
     orientación de la pantalla (vertical, apaisada) para pasar a ejes de pantalla. */
  arriba(out) {
    const b = this.beta * RAD, g = this.gamma * RAD;
    const abajo = out.set(Math.cos(b) * Math.sin(g), -Math.sin(b), -Math.cos(b) * Math.cos(g));
    const ang = (screen.orientation?.angle ?? window.orientation ?? 0) * RAD;
    const x = abajo.x * Math.cos(ang) - abajo.y * Math.sin(ang);
    const y = abajo.x * Math.sin(ang) + abajo.y * Math.cos(ang);
    return out.set(-x, -y, -abajo.z);
  }

  tick(dt) {
    const obj = this.target.object3D;
    const raices = this.raices().filter(Boolean);
    if (!obj.visible) {
      this.hayPose = false; this.estable = 0;
      return;
    }
    obj.updateWorldMatrix(true, false);
    obj.matrixWorld.decompose(this.cruda.p, this.cruda.q, this.cruda.s);

    // 1) Inclinación
    if (anclaje.sensor && this.beta != null) {
      const n = this.tmp.n.set(0, 0, 1).applyQuaternion(this.cruda.q);       // normal de la tapa
      const ang = Math.acos(THREE.MathUtils.clamp(n.dot(this.arriba(this.tmp.g)), -1, 1)) / RAD;
      anclaje.inclinacion = ang;
      const limite = anclaje.oculto ? ANCLAJE.inclinacionMax - ANCLAJE.histeresis : ANCLAJE.inclinacionMax;
      const contraria = anclaje.oculto ? ang < limite : ang > limite;
      this.cambio = contraria ? this.cambio + dt : 0;
      if (this.cambio >= ANCLAJE.sostener) { anclaje.oculto = !anclaje.oculto; this.cambio = 0; }
    } else {
      anclaje.oculto = false;
    }

    // 2) Firmeza
    const M = this.mostrada, C = this.cruda;
    if (!this.hayPose) {
      M.p.copy(C.p); M.q.copy(C.q); M.s.copy(C.s);
      this.hayPose = true; this.siguiendo = false;
    } else {
      this.estable += dt;
      const zona = this.modoFijo && this.estable > ANCLAJE.fijo.estableSeg ? ANCLAJE.fijo : ANCLAJE.firme;
      const mm = M.p.distanceTo(C.p) / (C.s.x || 1) * MARKER_MM;            // 1 u = ancho de la tapa
      const grados = (2 * Math.acos(Math.min(1, Math.abs(M.q.dot(C.q))))) / RAD;
      if (!this.siguiendo && (mm > zona.mm || grados > zona.grados)) this.siguiendo = true;
      if (this.siguiendo) {
        const k = 1 - Math.exp(-dt / ANCLAJE.seguir);
        M.p.lerp(C.p, k); M.q.slerp(C.q, k); M.s.lerp(C.s, k);
        if (mm < zona.mm * 0.25 && grados < zona.grados * 0.25) this.siguiendo = false;
      }
    }

    // Corrección para los grupos raíz: inversa(cruda) · mostrada
    this.tmp.m.compose(M.p, M.q, M.s);
    this.tmp.inv.copy(obj.matrixWorld).invert().multiply(this.tmp.m);
    for (const r of raices) {
      r.matrixAutoUpdate = false;
      r.matrix.copy(this.tmp.inv);
      r.matrixWorldNeedsUpdate = true;
      r.visible = !anclaje.oculto;
    }
  }
}
