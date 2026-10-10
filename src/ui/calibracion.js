/* Panel de calibración: solo lo que depende de la colmena real.
   Lo que es diseño (colores, tiempos, cantidades) vive como constante en el código.
   Va abajo, bajo y semitransparente, para seguir viendo la pieza mientras se calibra. */

// [clave, etiqueta, min, max, paso]  — todo en mm
const SLIDERS = [
  ['ejeXmm', 'Eje X', -8, 8, 0.25],
  ['ejeYmm', 'Eje Y', -8, 8, 0.25],
  ['altoColmenaMm', 'Alto total', 44, 58, 0.25],
  ['celdasSepMm', 'Separación de celdas', 10, 36, 0.25],
  ['cajaXmm', 'Caja: corrimiento', -18, 18, 0.25],
  ['cajaZmm', 'Caja: altura', -40, -14, 0.25],
];
// [clave, etiqueta, valor si está marcada, valor si no]
const OPCIONES = [
  ['soporteGiro90', 'Soporte girado 90°', true, false],
  ['cajaLado', 'Caja del lado de la abeja', 1, -1],
];
const VISTAS = [['oclusores', 'Oclusores'], ['zonas', 'Zonas táctiles'], ['interior', 'Interior'], ['ayudas', 'Ejes']];

export function crearPanel({ panel, boton, cfg, original, alCambiar, alVer, info }) {
  const fmt = (v) => `${(+v).toFixed(2).replace(/\.?0+$/, '')} mm`;

  function armar() {
    let html = `<header><strong>Calibración</strong><span id="cal-info"></span>
      <button id="cal-cerrar" aria-label="Cerrar">✕</button></header><div class="cal-grilla">`;
    for (const [k, et, mn, mx, paso] of SLIDERS) {
      html += `<label>${et} <span class="valor" id="v-${k}">${fmt(cfg[k])}</span>
        <input type="range" data-k="${k}" min="${mn}" max="${mx}" step="${paso}" value="${cfg[k]}"></label>`;
    }
    html += `</div><div class="cal-fila">`;
    for (const [k, et, si] of OPCIONES) {
      html += `<label class="chk"><input type="checkbox" data-opcion="${k}" ${cfg[k] === si ? 'checked' : ''}> ${et}</label>`;
    }
    html += `</div><div class="cal-fila cal-vistas"><span>Ver:</span>`;
    for (const [k, et] of VISTAS) html += `<label class="chk"><input type="checkbox" data-vista="${k}"> ${et}</label>`;
    html += `</div><div class="acciones"><button id="cal-copiar">Copiar valores</button>
      <button id="cal-reset" class="sec">Restaurar</button></div><pre id="cal-json"></pre>`;
    panel.innerHTML = html;

    panel.querySelectorAll('input[type=range]').forEach((inp) => inp.addEventListener('input', () => {
      const k = inp.dataset.k;
      cfg[k] = parseFloat(inp.value);
      panel.querySelector('#v-' + k).textContent = fmt(cfg[k]);
      alCambiar(k);
    }));
    panel.querySelectorAll('input[data-opcion]').forEach((inp) => inp.addEventListener('change', () => {
      const [k, , si, no] = OPCIONES.find((o) => o[0] === inp.dataset.opcion);
      cfg[k] = inp.checked ? si : no;
      alCambiar(k);
    }));
    panel.querySelectorAll('input[data-vista]').forEach((inp) => {
      inp.checked = !!estadoVistas[inp.dataset.vista];
      inp.addEventListener('change', () => {
        estadoVistas[inp.dataset.vista] = inp.checked;
        alVer(inp.dataset.vista, inp.checked);
      });
    });
    panel.querySelector('#cal-cerrar').onclick = () => { panel.hidden = true; boton.hidden = false; };
    panel.querySelector('#cal-copiar').onclick = copiar;
    panel.querySelector('#cal-reset').onclick = () => { Object.assign(cfg, original); alCambiar(null); armar(); };
  }

  const estadoVistas = { ...vistas };

  async function copiar() {
    const txt = JSON.stringify(cfg, null, 2);
    const pre = panel.querySelector('#cal-json');
    const btn = panel.querySelector('#cal-copiar');
    pre.textContent = txt;
    pre.style.display = 'block';
    try {
      await navigator.clipboard.writeText(txt);
      btn.textContent = 'Copiado';
    } catch {
      // Sin permiso de portapapeles (HTTP, algunos iPhone): queda seleccionado para copiar a mano
      const r = document.createRange(); r.selectNodeContents(pre);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      btn.textContent = 'Seleccionado: copialo';
    }
    console.log('CALIBRACION:', txt);
    setTimeout(() => (btn.textContent = 'Copiar valores'), 2000);
  }

  boton.addEventListener('click', () => { armar(); panel.hidden = false; boton.hidden = true; });
  setInterval(() => {
    if (panel.hidden) return;
    const el = panel.querySelector('#cal-info');
    const i = info();
    if (el) el.textContent = `${i.fps} fps${i.distCm ? `, cámara a ${i.distCm} cm` : ''}`;
  }, 500);
}
