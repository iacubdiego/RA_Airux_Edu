/* Arranque de la experiencia.

   Estados: inicio → buscando la tapa → explorando ⇄ ficha. No hay estado final.
   Explorando, el botón Rayos X abre un círculo en los oclusores para ver el interior; tocar algo
   adentro saca el marco del centro de la colmena, que vuelve al cerrar la ficha.

   A-Frame y MindAR se cargan antes como <script> clásicos; este módulo usa su THREE global
   (AFRAME.THREE) y nunca importa three por su cuenta. */
import { CALIBRACION, MODO_DESARROLLO, MARKER_MM } from './config.js';
import { Colmena } from './colmena/piezas.js';
import { escucharToques } from './interaccion/toque.js';
import { crearPanel } from './ui/calibracion.js';
import { estado, cargarPuntos } from './estado.js';
import { crearFicha } from './ui/ficha.js';
import { crearContador } from './ui/contador.js';
import { generarFotos } from './colmena/fotos.js';
import { Vuelo } from './interaccion/vuelo.js';
import './v1/escena-v1.js';                 // registra el componente escena-v1 (abejas, flores, logo)
import { Zumbido } from './v1/sonido.js';
import { Interior } from './colmena/interior.js';
import { RayosX } from './interaccion/rayosx.js';
import { Pistas, EXTERIORES } from './interaccion/pistas.js';
import { Guia } from './interaccion/guia.js';
import { Ventilacion } from './anim/ventilacion.js';
import { Dia } from './anim/dia.js';
import { mostrarCiclo } from './anim/ciclo.js';
import { Anclaje, anclaje, pedirSensores } from './interaccion/anclaje.js';

/* Puntos que están adentro de la colmena: al mostrarlos sale el marco del centro */
const PUNTOS_INTERIOR = new Set(['marcos', 'panal', 'cria_reina']);
let rayos = null;

const THREE = AFRAME.THREE;
const cfg = { ...CALIBRACION };

/* ?debug en la URL arranca con oclusores y ejes visibles: sirve para probar sin la colmena
   (con una foto de la tapa): los oclusores son invisibles y sin la pieza delante no se ve la colmena. */
const VISTAS_INICIALES = location.search.includes('debug') ? { oclusores: true, ayudas: true } : {};
/* ?grupo: modo guía (alguien explica con el celular espejado): la abeja guía no sale sola */
const MODO_GRUPO = location.search.includes('grupo');
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (s) => document.querySelector(s);
const escena = $('a-scene');
const target = $('#target');
const ui = {
  inicio: $('#inicio'), mensaje: $('#inicio p'), empezar: $('#btn-empezar'),
  pista: $('#pista'), calibrar: $('#btn-cal'), panel: $('#panel'),
  ficha: $('#ficha'), contador: $('#contador'), sonido: $('#btn-sonido'),
  rayos: $('#btn-rayos'), linterna: $('#linterna'), cielo: $('#cielo'), reloj: $('#reloj'),
};

/* Componente que vive en el target de MindAR: arma la colmena y la anima */
AFRAME.registerComponent('colmena-edu', {
  init() {
    this.raiz = new THREE.Group();            // espacio de la tapa (ver config.js)
    this.el.object3D.add(this.raiz);
    this.colmena = new Colmena(this.raiz);
    // Inclinación y firmeza de la pose (ver anclaje.js). ?fijo: celular en un soporte fijo.
    this.anclaje = new Anclaje({ target: this.el, raices: () => [this.raiz, v1()?.raiz],
      fijo: location.search.includes('fijo') });
    this.vuelo = new Vuelo(this.el.sceneEl);
    this.fotos = new Map();
    this.fps = { n: 0, t: 0, valor: 0 };
    this.distCm = 0;
    this.tmp = { p: new THREE.Vector3(), q: new THREE.Quaternion(), s: new THREE.Vector3(), cam: new THREE.Vector3() };
    this.colmena.cargar()
      .then(() => {
        this.colmena.colocar(cfg);
        this.interior = new Interior(this.colmena);
        this.interior.decorar();
        this.pistas = new Pistas(this.colmena, v1, { sinMovimiento });
        this.pistas.colocar(cfg);
        this.guia = new Guia({ colmena: this.colmena, pistas: this.pistas, escena: this.el.sceneEl,
          desactivada: MODO_GRUPO || sinMovimiento });
        this.ventilacion = new Ventilacion(this.colmena);
        this.ventilacion.colocar(cfg);
        const luz = (sel) => document.querySelector(sel)?.getObject3D('light');
        this.dia = new Dia({ colmena: this.colmena, v1, ventilacion: this.ventilacion, cielo: ui.cielo, reloj: ui.reloj,
          luzAmbiente: luz('#luz-ambiente'), luzSol: luz('#luz-sol') });
        this.fotos = generarFotos(this.colmena, [...this.colmena.partes.keys()]);
        if (VISTAS_INICIALES.oclusores) this.colmena.verOclusores(true);
        if (VISTAS_INICIALES.ayudas) this.colmena.verAyudas(true);
      })
      .catch((e) => { console.error(e); avisar('No se pudieron cargar las piezas: ' + e.message); });
  },

  tick(_, dtMs) {
    const dt = Math.min(dtMs || 16, 50) / 1000;
    this.anclaje.tick(dt);                     // primero: corrige la pose que usan todos los demás
    actualizarPista();
    const f = this.fps; f.n++; f.t += dt;
    if (f.t >= 0.5) { f.valor = Math.round(f.n / f.t); f.n = 0; f.t = 0; }
    this.colmena.tick(dt);
    this.vuelo.tick(dt);
    this.interior?.tick(dt, this.el.sceneEl.camera);
    rayos?.tick();
    const visible = this.el.object3D.visible && !anclaje.oculto;
    this.pistas?.tick(dt, visible);
    this.guia?.tick(dt, { visible, fichaAbierta: !!ficha.actual });
    this.ventilacion?.tick(dt, visible);
    this.dia?.tick(dt);

    // Distancia cámara–tapa, para el panel (en u → cm)
    if (this.el.object3D.visible) {
      const { p, q, s, cam } = this.tmp;
      this.el.object3D.matrixWorld.decompose(p, q, s);
      this.el.sceneEl.camera.getWorldPosition(cam);
      this.distCm = Math.round(p.distanceTo(cam) / (s.x || 1) * MARKER_MM / 10);
    }
  },
});

const comp = () => target.components['colmena-edu'];
const v1 = () => target.components['escena-v1'];
// Se agregan acá porque los módulos corren después de parsear el HTML
target.setAttribute('colmena-edu', '');
target.setAttribute('escena-v1', '');
const recalibrarV1 = () => v1()?.recalibrar(cfg);
if (escena.hasLoaded) recalibrarV1(); else escena.addEventListener('loaded', recalibrarV1, { once: true });

/* Avisos: en el inicio si todavía se ve; si la cámara ya está abierta, en la pista de abajo */
function avisar(texto) {
  ui.mensaje.textContent = texto;
  if (ui.inicio.classList.contains('oculto')) { ui.pista.textContent = texto; ui.pista.hidden = false; }
}

/* Inicio: el toque del botón habilita la cámara (y en el paso del sonido, el audio de iOS) */
ui.empezar.addEventListener('click', async () => {
  Zumbido.iniciar();                         // dentro del toque: si no, iOS no deja sonar el audio
  pedirSensores();                           // también dentro del toque: permiso de movimiento en iOS
  ui.empezar.disabled = true;
  ui.empezar.textContent = 'Abriendo cámara…';
  // Un .mind ausente rompe MindAR con un error críptico de msgpack: se chequea antes
  try {
    const r = await fetch('./targets/tapa.mind', { cache: 'no-store' });
    const largo = (await r.clone().arrayBuffer()).byteLength;
    const tipo = r.headers.get('content-type') || '';
    if (!r.ok || tipo.includes('text/html') || largo < 2000) {
      throw new Error(`targets/tapa.mind no es válido (HTTP ${r.status}, ${largo} bytes)`);
    }
  } catch (e) {
    console.error(e);
    avisar('Falta el marker compilado: ' + e.message);
    ui.empezar.disabled = false; ui.empezar.textContent = 'Reintentar';
    return;
  }
  if (!escena.hasLoaded) await new Promise((r) => escena.addEventListener('loaded', r, { once: true }));
  escena.systems['mindar-image-system'].start();
});

escena.addEventListener('arReady', () => {
  ui.inicio.classList.add('oculto');
  ui.pista.hidden = false;
  ui.contador.hidden = false;
  ui.sonido.hidden = false;
  if (comp()?.colmena) {
    rayos = new RayosX({ colmena: comp().colmena, escena, overlay: ui.linterna, boton: ui.rayos,
      radioPx: cfg.linternaRadioPx });
    ui.rayos.hidden = false;
  }
  if (MODO_DESARROLLO) ui.calibrar.hidden = false;
  escucharToques(escena, alTocar);
});
escena.addEventListener('arError', () => {
  ui.empezar.disabled = false; ui.empezar.textContent = 'Reintentar';
  avisar('No se pudo abrir la cámara. La página tiene que estar en HTTPS y hay que dar permiso de cámara.');
});
/* Pista de abajo: "apuntá a la tapa" sin tracking, "apoyala" si está inclinada, nada si está bien */
const PISTA = { buscar: 'Apuntá a la tapa de la colmena', inclinada: 'Apoyá la colmena sobre una mesa: está muy inclinada' };
let pistaActual = null;
function actualizarPista() {
  if (ui.inicio && !ui.inicio.classList.contains('oculto')) return;
  const estadoPista = !target.object3D.visible ? 'buscar' : anclaje.oculto ? 'inclinada' : null;
  if (estadoPista === pistaActual) return;
  pistaActual = estadoPista;
  ui.pista.hidden = !estadoPista;
  if (estadoPista) ui.pista.textContent = PISTA[estadoPista];
}

/* Explorando: tocar una parte la resalta, abre su ficha y lanza una copia de la pieza que vuela
   hasta la foto de la ficha. Tocar afuera cierra todo. */

/* El botón de Rayos X late cuando falta algo de adentro y ya se descubrieron dos cosas de afuera
   (al principio no: primero que se explore lo que se ve) */
function actualizarPulsoRayos() {
  const afuera = EXTERIORES.filter((id) => estado.descubiertos.has(id)).length;
  const faltaAdentro = [...PUNTOS_INTERIOR].some((id) => !estado.descubiertos.has(id));
  ui.rayos.classList.toggle('pulsa', afuera >= 2 && faltaAdentro && !rayos?.activo);
}
estado.alDescubrir(actualizarPulsoRayos);
ui.rayos.addEventListener('click', () => setTimeout(actualizarPulsoRayos));

cargarPuntos()
  .then(() => crearContador(ui.contador))
  .catch((e) => console.error('No se pudieron cargar los contenidos:', e));

/* Acciones de las fichas: animaciones que se lanzan con un botón */
let ultimaFlor = 0;
function alAccion(accion) {
  const c = comp();
  if (!c) return;
  c.guia?.actividad();
  const extra = ficha.extra();
  if (accion === 'dia') c.dia?.iniciar(extra, cfg.cajaLado);
  else if (accion === 'calor') c.ventilacion?.demo(extra);
  else if (accion === 'ciclo') mostrarCiclo(extra, { alNacer: () => c.interior?.nacer() });
  else if (accion === 'fruto') {
    v1()?.forzarFruto(ultimaFlor);
    v1()?.destacarFlor(ultimaFlor);
    if (extra) extra.innerHTML = '<p class="ficha-nota">Mirá la flor de la abeja marcada: con la próxima visita'
      + ' se le caen los pétalos y empieza a crecer un fruto.</p>';
  }
}
target.addEventListener('fruto', () => {
  const extra = ficha.actual === 'flores' && ficha.extra();
  if (extra) extra.innerHTML = '<p class="ficha-nota"><strong>¡Se formó un fruto!</strong> El polen que trajeron'
    + ' las abejas fecundó la flor: se le cayeron los pétalos y lo que quedaba creció hasta ser un fruto con semillas.</p>';
});

const ficha = crearFicha(ui.ficha, {
  alAccion,
  alAbrirRelacionado: (id) => mostrarPunto(id),
  alCerrar: () => { comp()?.colmena.resaltar(null); comp()?.interior?.sacar(false); },
});

/* Resalta la parte (si el punto es una parte tocable), lo marca como descubierto, abre su ficha
   y, si la pieza está a la vista, la hace volar hasta la foto */
function mostrarPunto(id) {
  const c = comp();
  const esParte = !!c?.colmena.partes.has(id);
  c?.vuelo.cancelar();
  c?.colmena.resaltar(esParte ? id : null);
  c?.interior?.sacar(PUNTOS_INTERIOR.has(id));
  c?.guia?.actividad();
  estado.descubrir(id);
  ficha.abrir(id, { foto: esParte ? c.fotos.get(id) : null });
  escena.emit('parte-tocada', { id });
  const rect = ficha.rectFoto();
  if (!rect) return;
  if (sinMovimiento || !target.object3D.visible) ficha.revelarFoto();
  else c.vuelo.lanzar(c.colmena, id, rect, ficha.revelarFoto);
}

function alTocar(raycaster, punto) {
  if (!target.object3D.visible || anclaje.oculto || !comp()) return;
  comp().guia?.actividad();
  // Primero el interior: dentro del círculo de rayos X, o el marco que está afuera de la colmena
  const adentro = comp().interior?.elegir(raycaster, !!rayos?.dentro(punto));
  if (adentro) { mostrarPunto(adentro); return; }
  const parte = comp().colmena.elegir(raycaster);
  if (parte) { mostrarPunto(parte.id); return; }
  // Flores: no tienen pieza física; se destaca una abeja que va a la flor tocada y vuelve con polen
  const flor = v1()?.elegirFlor(raycaster) ?? -1;
  if (flor >= 0) { ultimaFlor = flor; mostrarPunto('flores'); v1().destacarFlor(flor); return; }
  comp().vuelo.cancelar(); ficha.cerrar(); comp().colmena.resaltar(null);
}

ui.sonido.addEventListener('click', () => {
  Zumbido.activo = !Zumbido.activo;
  ui.sonido.textContent = Zumbido.activo ? '🔊' : '🔇';
  ui.sonido.setAttribute('aria-label', Zumbido.activo ? 'Silenciar' : 'Activar sonido');
});

/* Panel de calibración */
crearPanel({
  panel: ui.panel, boton: ui.calibrar, cfg, original: { ...CALIBRACION }, vistas: VISTAS_INICIALES,
  alCambiar: () => {
    comp()?.colmena.colocar(cfg);
    comp()?.pistas?.colocar(cfg);
    comp()?.ventilacion?.colocar(cfg);
    recalibrarV1();
    if (rayos) rayos.radioPx = cfg.linternaRadioPx;
  },
  alVer: (vista, si) => {
    const c = comp()?.colmena;
    if (!c) return;
    ({ oclusores: () => c.verOclusores(si), zonas: () => c.verZonas(si),
      ayudas: () => c.verAyudas(si) })[vista]();
  },
  info: () => ({ fps: comp()?.fps.valor ?? 0, distCm: target.object3D.visible ? comp()?.distCm : 0 }),
});
