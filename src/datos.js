/* Capa de datos de la colmena. Hoy devuelve valores de ejemplo; cuando exista la API de Airux,
   se cambia FUENTE a 'api' y se completa pedirApi(). Las fichas no saben de dónde vienen. */

export const FUENTE = 'ejemplo';   // 'ejemplo' | 'api'

const EJEMPLO = {
  peso_kg: 41.2,
  temp_interior_c: 34.8,
  humedad_pct: 62,
  bateria_pct: 78,
  solar_w: 1.4,
  ultimo_envio_min: 12,
  senal_dbm: -97,
};

async function pedirApi() {
  throw new Error('La API de Airux todavía no está conectada');
}

let cache = null;
export async function obtenerDatos() {
  if (FUENTE === 'ejemplo') return { ...EJEMPLO, esEjemplo: true };
  if (!cache) cache = pedirApi().catch((e) => { cache = null; throw e; });
  return { ...(await cache), esEjemplo: false };
}
