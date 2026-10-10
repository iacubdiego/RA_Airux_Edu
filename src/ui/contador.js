/* Contador de puntos descubiertos, uno por grupo. Sin cierre: llegar al total no dispara nada,
   solo deja ver que el recorrido está completo. */
import { estado } from '../estado.js';

const GRUPOS = [['colmena', 'Colmena'], ['airux', 'Airux']];

export function crearContador(el) {
  el.innerHTML = GRUPOS.map(([g, nombre]) =>
    `<span class="cont" data-grupo="${g}">${nombre} <b>0/0</b></span>`).join('');

  function actualizar(nuevo) {
    for (const [g] of GRUPOS) {
      const total = estado.puntos.filter((p) => p.grupo === g);
      const vistos = total.filter((p) => estado.descubiertos.has(p.id)).length;
      const chip = el.querySelector(`[data-grupo="${g}"]`);
      chip.querySelector('b').textContent = `${vistos}/${total.length}`;
      chip.classList.toggle('completo', vistos === total.length);
      if (nuevo && estado.punto(nuevo)?.grupo === g) {
        chip.classList.remove('suma');
        void chip.offsetWidth;            // reinicia la animación
        chip.classList.add('suma');
      }
    }
  }
  estado.alDescubrir(actualizar);
  actualizar();
  return { actualizar };
}
