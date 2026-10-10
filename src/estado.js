/* Estado del recorrido. Solo vive mientras la página está abierta: en una feria cada visitante
   (o cada recarga del guía) arranca de cero. */
const descubiertos = new Set();
const oyentes = [];

export const estado = {
  puntos: [],                        // se carga desde contenidos/puntos.json
  descubiertos,
  punto: (id) => estado.puntos.find((p) => p.id === id),
  /* Devuelve true si el punto no estaba descubierto */
  descubrir(id) {
    if (descubiertos.has(id)) return false;
    descubiertos.add(id);
    oyentes.forEach((f) => f(id));
    return true;
  },
  alDescubrir: (f) => oyentes.push(f),
};

export async function cargarPuntos(url = './contenidos/puntos.json') {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  estado.puntos = (await r.json()).puntos;
  return estado.puntos;
}
