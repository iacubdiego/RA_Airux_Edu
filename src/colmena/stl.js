/* STL binario → BufferGeometry, con el THREE que trae A-Frame.
   No usamos el STLLoader de three: es un módulo que importa 'three' por su cuenta y
   traería una segunda copia de three (sus geometrías no sirven en la escena de A-Frame). */
const THREE = AFRAME.THREE;

/* Devuelve la geometría en mm reales (aplica la escala de impresión) y centrada en su caja
   envolvente. Formato: 80 bytes de encabezado, uint32 con la cantidad de triángulos y
   50 bytes por triángulo (normal, 3 vértices en float32 y 2 bytes de atributo). */
export async function cargarSTL(url, escala) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const buf = await r.arrayBuffer();
  const dv = new DataView(buf);
  const n = buf.byteLength >= 84 ? dv.getUint32(80, true) : 0;
  if (84 + n * 50 !== buf.byteLength) throw new Error(`${url}: no es un STL binario (¿ASCII o página 404?)`);

  const pos = new Float32Array(n * 9);
  for (let i = 0; i < n; i++) {
    const o = 84 + i * 50 + 12;                       // saltea la normal guardada; se recalcula
    for (let j = 0; j < 9; j++) pos[i * 9 + j] = dv.getFloat32(o + j * 4, true) * escala;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();                          // sin índice: normales planas, bien para piezas impresas
  g.center();
  g.computeBoundingBox();
  return g;
}

/* Separa en piezas una malla que trae varias en fila (los 10 marcos), cortando donde hay un
   hueco a lo largo del eje. Barre los triángulos ordenados por su mínimo en ese eje y abre un
   grupo nuevo cuando el triángulo empieza después del máximo del grupo actual (+ tolerancia). */
export function separarPorHuecos(geo, eje = 0, tolerancia = 0.05) {
  const p = geo.attributes.position.array;
  const nTri = p.length / 9;
  const tri = [];
  for (let i = 0; i < nTri; i++) {
    const a = p[i * 9 + eje], b = p[i * 9 + 3 + eje], c = p[i * 9 + 6 + eje];
    tri.push({ i, min: Math.min(a, b, c), max: Math.max(a, b, c) });
  }
  tri.sort((x, y) => x.min - y.min);

  const grupos = [];
  let actual = null;
  for (const t of tri) {
    if (!actual || t.min > actual.max + tolerancia) { actual = { max: t.max, tri: [] }; grupos.push(actual); }
    actual.max = Math.max(actual.max, t.max);
    actual.tri.push(t.i);
  }

  return grupos.map((gr) => {
    const out = new Float32Array(gr.tri.length * 9);
    gr.tri.forEach((i, k) => out.set(p.subarray(i * 9, i * 9 + 9), k * 9));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(out, 3));
    g.computeVertexNormals();
    g.center();
    g.computeBoundingBox();
    return g;
  });
}
