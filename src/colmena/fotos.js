/* "Fotos" de las partes para las fichas: se renderizan una vez, al cargar, con las mismas mallas
   del oclusor. Así la imagen de la ficha siempre coincide con la pieza, sin assets aparte.
   Usa un renderer propio y chico que se descarta al terminar (un contexto WebGL extra por un
   instante; el de la escena AR no se toca). */
const THREE = AFRAME.THREE;

export const VISTA = new THREE.Vector3(0.55, -1, 0.75).normalize();   // desde el frente (−Y), a la derecha y arriba

export function generarFotos(colmena, ids, tam = 256) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(tam, tam, false);
  renderer.setClearColor(0x000000, 0);

  const escena = new THREE.Scene();
  escena.add(new THREE.AmbientLight(0xffffff, 1.1));
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(0.4, -0.6, 1);
  escena.add(sol);
  const camara = new THREE.PerspectiveCamera(28, 1, 0.1, 1000);
  const borde = new THREE.LineBasicMaterial({ color: 0x301807, transparent: true, opacity: 0.35 });

  const fotos = new Map();
  for (const id of ids) {
    const { grupo, radioMm } = colmena.fantasma(id);
    // Aristas suaves: sin ellas una pieza blanca se pierde sobre la ficha clara
    grupo.children.forEach((m) => {
      const l = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 30), borde);
      l.matrixAutoUpdate = false;
      l.matrix.copy(m.matrix);
      grupo.add(l);
    });
    escena.add(grupo);
    const d = (radioMm / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2))) * 1.02;
    camara.position.copy(VISTA).multiplyScalar(d);
    camara.up.set(0, 0, 1);
    camara.lookAt(0, 0, 0);
    renderer.render(escena, camara);
    fotos.set(id, renderer.domElement.toDataURL('image/png'));
    escena.remove(grupo);
    grupo.traverse((o) => o.isLineSegments && o.geometry.dispose());
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return fotos;
}
