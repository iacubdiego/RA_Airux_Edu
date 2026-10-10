/* Ficha de un punto: sube desde abajo y ocupa a lo sumo ~45% de la pantalla, para que la parte
   resaltada siga a la vista. Idea simple primero; "Saber más" despliega el resto. */
import { estado } from '../estado.js';
import { obtenerDatos } from '../datos.js';

const fmtNum = (v) => (typeof v === 'number' ? v.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : v);

export function crearFicha(el, { alAbrirRelacionado, alCerrar }) {
  let actual = null;

  /* foto: dataURL de la pieza (si es una parte). Arranca invisible: la revela revelarFoto(),
     cuando llega la copia que vuela desde la pieza real. */
  function abrir(id, { foto } = {}) {
    const p = estado.punto(id);
    if (!p) { console.warn('Punto sin contenido:', id); return; }
    actual = id;
    el.dataset.grupo = p.grupo;
    el.innerHTML = '';

    const cab = document.createElement('header');
    const h = document.createElement('h2');
    h.textContent = p.nombre;
    const x = document.createElement('button');
    x.className = 'ficha-cerrar'; x.setAttribute('aria-label', 'Cerrar'); x.textContent = '✕';
    x.onclick = cerrar;
    if (foto) {
      const marco = document.createElement('div');
      marco.className = 'ficha-foto';
      const img = document.createElement('img');
      img.src = foto; img.alt = '';
      marco.append(img);
      cab.append(marco);
    }
    cab.append(h, x);

    const simple = document.createElement('p');
    simple.className = 'ficha-simple';
    simple.textContent = p.simple;
    el.append(cab, simple);

    if (p.datos?.length) {
      const caja = document.createElement('div');
      caja.className = 'ficha-datos';
      el.append(caja);
      obtenerDatos().then((d) => {
        if (actual !== id) return;
        for (const dato of p.datos) {
          const fila = document.createElement('div');
          const v = document.createElement('strong');
          // "formato" permite textos como "hace {v} min"; si no, valor + unidad
          v.textContent = dato.formato ? dato.formato.replace('{v}', fmtNum(d[dato.clave]))
            : `${fmtNum(d[dato.clave])} ${dato.unidad}`;
          const et = document.createElement('span');
          et.textContent = dato.etiqueta;
          fila.append(et, v);
          caja.append(fila);
        }
        if (d.esEjemplo) {
          const aviso = document.createElement('em');
          aviso.textContent = 'Dato de ejemplo, no es una medición real';
          caja.append(aviso);
        }
      }).catch((e) => { caja.textContent = 'No se pudieron leer los datos.'; console.error(e); });
    }

    if (p.saberMas?.length) {
      const det = document.createElement('details');
      const sum = document.createElement('summary');
      sum.textContent = 'Saber más';
      det.append(sum);
      for (const t of p.saberMas) {
        const par = document.createElement('p');
        par.textContent = t;
        det.append(par);
      }
      el.append(det);
    }

    const rel = (p.relacionados || []).map(estado.punto).filter(Boolean);
    if (rel.length) {
      const nav = document.createElement('nav');
      nav.className = 'ficha-rel';
      const t = document.createElement('span');
      t.textContent = 'Seguí con';
      nav.append(t);
      for (const r of rel) {
        const b = document.createElement('button');
        b.textContent = r.nombre;
        if (estado.descubiertos.has(r.id)) b.classList.add('visto');
        b.onclick = () => alAbrirRelacionado(r.id);
        nav.append(b);
      }
      el.append(nav);
    }

    el.hidden = false;
    el.scrollTop = 0;
    requestAnimationFrame(() => el.classList.add('abierta'));
  }

  function cerrar() {
    if (!actual) return;
    actual = null;
    el.classList.remove('abierta');
    setTimeout(() => { if (!actual) el.hidden = true; }, 250);
    alCerrar?.();
  }

  /* Dónde va a quedar la foto cuando la ficha termine de subir (la ficha puede estar a mitad
     de la animación: se descuenta lo que le falta) */
  function rectFoto() {
    const img = el.querySelector('.ficha-foto');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    const falta = el.getBoundingClientRect().top - (window.innerHeight - el.offsetHeight);
    return new DOMRect(r.left, r.top - falta, r.width, r.height);
  }

  function revelarFoto() { el.querySelector('.ficha-foto')?.classList.add('visible'); }

  return { abrir, cerrar, rectFoto, revelarFoto, get actual() { return actual; } };
}
