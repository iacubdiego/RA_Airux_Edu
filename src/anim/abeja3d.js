/* Abeja suelta con alas (la misma geometría y el mismo aleteo que el enjambre de la v1), para
   las animaciones que necesitan pocas abejas propias: ventilación. Largo en mm; +Z adelante,
   +Y lomo. */
import { geometriaAbeja, geometriaAla } from '../v1/escena-v1.js';
import { PALETA } from '../config.js';

const THREE = AFRAME.THREE;
let geoCuerpo = null, geoAla = null, matCuerpo = null, matAla = null;

export function crearAbeja(largoMm) {
  geoCuerpo ??= geometriaAbeja();
  geoAla ??= geometriaAla();
  matCuerpo ??= new THREE.MeshLambertMaterial({ vertexColors: true });
  matAla ??= new THREE.MeshBasicMaterial({ color: PALETA.marron, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthWrite: false });
  const grupo = new THREE.Group();          // posición y orientación las pone quien la usa
  const escala = new THREE.Group();
  escala.scale.setScalar(largoMm);
  grupo.add(escala);
  escala.add(new THREE.Mesh(geoCuerpo, matCuerpo));
  const alas = [0, 1].map(() => {
    const a = new THREE.Mesh(geoAla, matAla);
    a.matrixAutoUpdate = false;
    a.renderOrder = 2;
    escala.add(a);
    return a;
  });
  const T = new THREE.Matrix4().makeTranslation(0.1, 0.15, 0.12);
  const Ry = new THREE.Matrix4().makeRotationY(0.55), Rz = new THREE.Matrix4();
  const ESPEJO = new THREE.Matrix4().makeScale(-1, 1, 1);
  return {
    grupo, escala,
    /* tiempo en s; hz: aleteos por segundo */
    aletear(t, hz = 16) {
      const ang = 0.2 + 0.9 * Math.sin(t * Math.PI * 2 * hz);
      alas[0].matrix.multiplyMatrices(T, Rz.makeRotationZ(ang)).multiply(Ry);
      alas[1].matrix.multiplyMatrices(ESPEJO, alas[0].matrix);
    },
  };
}
