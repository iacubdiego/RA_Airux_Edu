/* Vuelo de la pieza a la ficha: una copia visible de la parte arranca exactamente sobre la pieza
   real, se acerca a la cámara hacia el lugar de la foto en la ficha, se achica hasta el tamaño de
   la foto y se desvanece mientras la foto aparece. La pieza real queda resaltada en su lugar.
   Mientras viaja gira: arranca con el ángulo con que se ve la colmena y llega con el de la foto.

   La copia vive en la escena (no dentro del target), así no la mueve el tracking mientras vuela.
   Posiciones en coordenadas del mundo de A-Frame; el destino se calcula desproyectando el centro
   de la foto (coordenadas de pantalla) a una distancia menor que la de la pieza. */
import { VISTA } from '../colmena/fotos.js';

const THREE = AFRAME.THREE;

/* Orientación de la cámara de la foto, en coordenadas de la pieza (misma que usa fotos.js) */
const Q_FOTO_INV = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().lookAt(VISTA, new THREE.Vector3(), new THREE.Vector3(0, 0, 1))).invert();

const DURACION_S = 0.75;
const ACERCAR = 0.6;          // la copia termina al 60% de la distancia original a la cámara
const suave = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);   // ease-in-out cúbica

export class Vuelo {
  constructor(escena) {
    this.escena = escena;
    this.v = null;
    this.tmp = { a: new THREE.Vector3(), b: new THREE.Vector3(), s: new THREE.Vector3(), cam: new THREE.Vector3(),
      up: new THREE.Vector3(), m: new THREE.Matrix4(), qCam: new THREE.Quaternion(), q1: new THREE.Quaternion(),
      q: new THREE.Quaternion() };
  }

  /* rect: dónde termina la foto en pantalla (DOMRect). alLlegar: cuando la copia empieza a desvanecerse. */
  lanzar(colmena, id, rect, alLlegar) {
    this.cancelar();
    const { grupo, centro, radioMm, mats } = colmena.fantasma(id);
    // Delante del oclusor de la misma pieza: sin esto, al arrancar pelean por la profundidad
    mats.forEach((m) => {
      m.transparent = true;
      m.polygonOffset = true; m.polygonOffsetFactor = -2; m.polygonOffsetUnits = -8;
    });
    grupo.traverse((o) => { if (o.isMesh) o.renderOrder = 10; });
    grupo.matrixAutoUpdate = false;

    // Pose de partida: la del grupo en mm, trasladada al centro de la pieza
    const mm = colmena.mm;
    mm.updateWorldMatrix(true, false);
    const p0 = mm.localToWorld(centro.clone());
    const q0 = new THREE.Quaternion(), s0 = new THREE.Vector3(), basura = new THREE.Vector3();
    mm.matrixWorld.decompose(basura, q0, s0);

    this.escena.object3D.add(grupo);
    this.v = { grupo, mats, p0, q0, s0, radioMm, rect, t: 0, alLlegar, avisado: false };
  }

  cancelar() {
    if (!this.v) return;
    this.escena.object3D.remove(this.v.grupo);
    this.v.mats.forEach((m) => m.dispose());
    if (!this.v.avisado) this.v.alLlegar?.();
    this.v = null;
  }

  tick(dt) {
    const v = this.v;
    if (!v) return;
    v.t += dt / DURACION_S;
    const t = Math.min(1, v.t), k = suave(t);

    // Destino: rayo desde la cámara por el centro de la foto
    const cam = this.escena.camera, canvas = this.escena.canvas;
    const r = canvas.getBoundingClientRect();
    const ndcX = ((v.rect.left + v.rect.width / 2 - r.left) / r.width) * 2 - 1;
    const ndcY = -((v.rect.top + v.rect.height / 2 - r.top) / r.height) * 2 + 1;
    cam.getWorldPosition(this.tmp.cam);
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const dir = this.tmp.a.set(ndcX, ndcY, 0.5).unproject(cam).sub(this.tmp.cam).normalize();
    const d0 = v.p0.distanceTo(this.tmp.cam), d1 = d0 * ACERCAR;
    const p1 = this.tmp.b.copy(this.tmp.cam).addScaledVector(dir, d1);

    // Escala final: que el radio proyectado sea el de la foto (f = distancia focal en px)
    const f = (r.height / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const rPx = (Math.min(v.rect.width, v.rect.height) / 2) * 0.9;
    const s1 = (rPx * d1) / (v.radioMm * f);
    const s = THREE.MathUtils.lerp(v.s0.x, s1, k);

    // Orientación final: la pieza vista desde la cámara real igual que la cámara de la foto la ve.
    // R_pieza · R_foto = R_vista  →  R_pieza = R_vista · R_foto⁻¹
    cam.getWorldQuaternion(this.tmp.qCam);
    const up = this.tmp.up.set(0, 1, 0).applyQuaternion(this.tmp.qCam);
    this.tmp.q1.setFromRotationMatrix(this.tmp.m.lookAt(this.tmp.cam, p1, up)).multiply(Q_FOTO_INV);
    const q = this.tmp.q.copy(v.q0).slerp(this.tmp.q1, k);

    const pos = this.tmp.a.copy(v.p0).lerp(p1, k);
    v.grupo.matrix.compose(pos, q, this.tmp.s.setScalar(s));
    v.grupo.matrixWorldNeedsUpdate = true;

    // Se desvanece en el último 40%; al empezar a desvanecerse aparece la foto
    const op = 1 - THREE.MathUtils.smoothstep(t, 0.6, 1);
    v.mats.forEach((m) => (m.opacity = op));
    if (t >= 0.6 && !v.avisado) { v.avisado = true; v.alLlegar?.(); }
    if (t >= 1) this.cancelar();
  }
}
