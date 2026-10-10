/* Toque sobre la pantalla → rayo desde la cámara → parte de la colmena.

   Raycasting: se convierte el punto tocado a coordenadas normalizadas (−1..1) del canvas y se
   tira un rayo desde la cámara a través de ese punto. MindAR ajusta la proyección de la cámara
   a la del video; por las dudas se recalcula la inversa antes de cada rayo (three la usa para
   "desproyectar" el punto y, si quedara vieja, el rayo saldría torcido). */
const THREE = AFRAME.THREE;

const MAX_MOVIMIENTO_PX = 12;    // más que esto es un arrastre, no un toque
const MAX_DURACION_MS = 450;

export function escucharToques(escena, alTocar) {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let inicio = null;

  const canvas = escena.canvas;
  canvas.addEventListener('pointerdown', (e) => {
    inicio = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!inicio) return;
    const mov = Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y);
    const dur = performance.now() - inicio.t;
    inicio = null;
    if (mov > MAX_MOVIMIENTO_PX || dur > MAX_DURACION_MS) return;

    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const cam = escena.camera;
    cam.updateMatrixWorld();
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    raycaster.setFromCamera(ndc, cam);
    alTocar(raycaster, { x: e.clientX, y: e.clientY });
  });
  canvas.addEventListener('pointercancel', () => (inicio = null));
}
