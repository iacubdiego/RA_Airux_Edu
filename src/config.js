/* ═════════════════════════════════════════════════════════════════════════
   CONFIGURACIÓN DE LA COLMENA AIRUX (proyecto educativo)

   SISTEMA DE COORDENADAS — espacio del target de MindAR (la cara superior de la tapa)

            +Y  hacia la abeja y las alas del logo impreso
             ↑
             ●——→ +X          +Z sale de la tapa hacia el techo
     origen = CENTRO de la cara superior de la tapa; lo que está debajo tiene Z < 0

   MindAR trabaja en u: 1 u = ancho de la imagen del marker = MARKER_MM.
   Acá todo se escribe en MILÍMETROS: piezas.js mete las mallas en un grupo con
   escala 1 / MARKER_MM, así que adentro de ese grupo 1 unidad = 1 mm real.

   La tapa puede ir girada 180°. Como la caja estanca está en una sola cara, eso se
   corrige con cajaLado (−1 = cara opuesta a la abeja, como en la foto de referencia).
   ═════════════════════════════════════════════════════════════════════════ */

export const MARKER_MM = 46.6;        // ancho real de la cara superior de la tapa (= 1 u)
export const MODO_DESARROLLO = true;  // false en la versión final: oculta el botón "Calibrar"

/* VALORES CALIBRADOS — pegá acá el JSON del botón "Copiar valores".
   Los de ahora son estimaciones sacadas del 3MF y de una foto, sin calibrar con la pieza. */
export const CALIBRACION = {
  ejeXmm: 0,             // centro del cuerpo respecto del centro de la tapa
  ejeYmm: 0,
  altoColmenaMm: 50.6,   // de la cara superior de la tapa hasta la mesa (con las piezas del 3MF da 50,6)
  soporteGiro90: false,  // false = placas-pata en las caras ±Y, abiertas hacia ±X (como en la foto)
  cajaLado: -1,          // −1 = caja en la cara −Y (opuesta a la abeja); +1 = tapa puesta al revés
  cajaXmm: 11,           // corrimiento lateral de la caja, a la derecha mirándola de frente
  cajaZmm: -27.7,        // altura del centro de la caja (a la altura de las celdas de carga)
  celdasSepMm: 22,       // distancia entre los centros de las dos celdas de carga
};

/* Piezas. Las mallas salen de assets/stl/ (extraídas del 3MF a escala original; el 3MF
   imprime a 0,5 y stl.js aplica esa escala al cargar). Cada STL se centra en su caja
   envolvente y después se gira y se ubica con estos datos. Ejes del STL → ejes de la tapa. */
export const ESCALA_IMPRESION = 0.5;

export const PIEZAS = {
  // La tapa es el marker. Se modela como caja: el contenido nunca entra en ella.
  tapa: { ancho: 46.6, largo: 55.3, alto: 5.95, techo: 2.2 },   // techo = espesor de la placa superior

  // 50 × 41,25 × 24 en el STL → girado 90°: 41,25 (X) × 50 (Y). Sin piso ni techo.
  cuerpo: { stl: 'cuerpo.stl', giroZ: 90, paredMm: 2.19 },

  // Barras de 55 × 5 × 3 a lo largo de Y, entre el cuerpo y el soporte (asoman 2,5 mm por cara)
  celda: { stl: 'celda_carga.stl', giroZ: 90 },

  // Impreso al revés (la losa sobre la cama): se da vuelta para que las patas queden abajo
  soporte: { stl: 'soporte.stl', giroX: 180 },

  // 12,5 × 10 × 4 más las orejas de montaje; impresa acostada con el dorso en −Z.
  // Girada 90° en X: el dorso queda contra la colmena y las orejas arriba y abajo.
  caja: { stl: 'caja_estanca.stl', giroX: 90 },

  // Interior (solo se ve con rayos X). El STL trae 10 marcos en fila: se separa uno y se instancia.
  marcos: { stl: 'marcos_10x.stl', cantidad: 9 },
  alimentador: { stl: 'alimentador.stl', incluir: true },   // 9 marcos + alimentador: el décimo marco del STL sobra

  // Panel solar: la pieza impresa va apoyada al costado sin lugar fijo, así que se muestra uno
  // virtual en el piso, del lado de la caja. El STL viene ya a escala de impresión (escala 1).
  // piso: corrimiento desde el eje en mm, en la convención de la caja (X a la derecha mirando
  // la caja de frente, Y hacia afuera). En el STL la placa mira hacia −Y y 30° hacia arriba.
  panel: { stl: 'panel_solar.stl', escala: 1, pisoXmm: 36, pisoYmm: 22, giroZ: 0, normalCeldas: [0, -0.87, 0.5] },
};

/* Paleta del logo de Airux */
export const PALETA = { naranja: '#ffb129', marron: '#301807', pla: '#fafaf8', madera: '#d9b26f',
  naranjaImpreso: '#e8743b' };   // el filamento naranja de la pieza, más rojizo que el del logo
