/* Linterna de rayos X.

   Cómo funciona: el interior de la colmena (marcos, panal, reina, pilas) está siempre dibujado,
   pero los oclusores de la tapa, el cuerpo y la caja lo tapan porque escriben profundidad
   delante. Con la linterna prendida, esos oclusores descartan sus fragmentos (discard) dentro
   de un círculo de la pantalla: ahí dejan de tapar y se ve el interior sobre el video.
   El círculo es un uniform compartido por los tres materiales (piezas.js → colmena.rayos).

   El círculo queda fijo, un poco arriba del centro de la pantalla (la mitad de abajo la puede
   ocupar la ficha): se apunta moviendo el celular. */
const CENTRO_Y = 0.4;     // fracción de la altura de la pantalla

export class RayosX {
  constructor({ colmena, escena, overlay, boton, radioPx }) {
    Object.assign(this, { colmena, escena, overlay, boton });
    this.radioPx = radioPx;
    this.activo = false;
    boton.addEventListener('click', () => this.alternar());
  }

  alternar(si = !this.activo) {
    this.activo = si;
    this.boton.classList.toggle('activo', si);
    this.boton.setAttribute('aria-pressed', si);
    this.overlay.hidden = !si;
    this.colmena.rayos.activa.value = si ? 1 : 0;
  }

  centroCss() {
    const r = this.escena.canvas.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * CENTRO_Y, rect: r };
  }

  /* ¿El punto de pantalla (px CSS) cae dentro del círculo? */
  dentro(p) {
    if (!this.activo || !p) return false;
    const c = this.centroCss();
    return Math.hypot(p.x - c.x, p.y - c.y) < this.radioPx;
  }

  /* Cada cuadro: pasa el círculo a píxeles del canvas (gl_FragCoord: origen abajo a la izquierda) */
  tick() {
    if (!this.activo) return;
    const canvas = this.escena.canvas;
    const { x, y, rect } = this.centroCss();
    const k = canvas.width / rect.width;
    const u = this.colmena.rayos;
    u.centro.value.set((x - rect.left) * k, (rect.bottom - y) * k);
    u.radio.value = this.radioPx * k;
    const d = this.radioPx * 2;
    Object.assign(this.overlay.style, { width: `${d}px`, height: `${d}px`, left: `${x - this.radioPx}px`, top: `${y - this.radioPx}px` });
  }
}
