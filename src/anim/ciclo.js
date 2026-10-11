/* De huevo a abeja: 21 días de una obrera en 12 segundos, dibujados en la ficha de "Cría y
   reina". Una celda en corte (el fondo a la izquierda, la boca a la derecha):
   huevo (días 1–3) → larva que crece (4–9) → la tapan con cera (9) → pupa que se oscurece y
   forma ojos (10–20) → la abeja roe la tapa y sale (21). Al terminar llama a alNacer(), que hace
   salir una abeja del marco en la AR. */
const DURACION_MS = 12000;
const ETAPAS = [[1, 3, 'Huevo'], [4, 9, 'Larva: las nodrizas la alimentan'], [10, 20, 'Pupa: la celda está tapada con cera'],
  [21, 21, 'Abeja adulta: roe la tapa y sale']];

export function mostrarCiclo(extra, { alNacer } = {}) {
  if (!extra) return;
  extra.innerHTML = `
    <svg class="ciclo" viewBox="0 0 300 110" role="img" aria-label="Ciclo de una abeja obrera dentro de su celda">
      <path class="celda" d="M40 22 H262 M40 88 H262 M40 22 V88"/>
      <rect class="jalea" x="42" y="62" width="0" height="24" rx="6"/>
      <ellipse class="huevo" cx="52" cy="55" rx="3" ry="9"/>
      <path class="larva" d=""/>
      <g class="pupa">
        <ellipse class="p-cuerpo" cx="0" cy="0" rx="44" ry="17"/>
        <circle class="p-cabeza" cx="50" cy="0" r="13"/>
        <circle class="p-ojo" cx="55" cy="-6" r="4"/>
        <path class="p-rayas" d="M-22 -15 V15 M-8 -16 V16 M6 -16 V16"/>
      </g>
      <path class="tapa" d="M262 22 Q252 55 262 88"/>
      <text class="dia" x="150" y="14" text-anchor="middle"></text>
    </svg>
    <p class="ficha-nota ciclo-etapa"></p>`;
  const $ = (s) => extra.querySelector(s);
  const larva = $('.larva'), huevo = $('.huevo'), pupa = $('.pupa'), tapa = $('.tapa'), jalea = $('.jalea');
  const t0 = performance.now();
  let nacio = false;

  function cuadro(ahora) {
    if (!extra.isConnected || !$('.ciclo')) return;                 // se cerró la ficha
    const f = Math.min(1, (ahora - t0) / DURACION_MS);
    const dia = Math.min(21, 1 + Math.floor(f * 21));
    const d = 1 + f * 20;                                            // día continuo
    $('.dia').textContent = `Día ${dia}`;
    $('.ciclo-etapa').textContent = ETAPAS.find(([a, b]) => dia >= a && dia <= b)?.[2] || '';

    // Huevo: parado al principio, se va acostando
    huevo.style.display = d < 4 ? '' : 'none';
    huevo.setAttribute('transform', `rotate(${Math.min(90, (d - 1) * 40)} 52 62)`);
    // Larva: una C blanca que crece sobre un poco de jalea
    const crece = Math.max(0, Math.min(1, (d - 4) / 5.5));
    larva.style.display = d >= 4 && d < 10 ? '' : 'none';
    jalea.setAttribute('width', d >= 4 && d < 10 ? 40 + 60 * crece : 0);
    // C abierta hacia la boca de la celda, apoyada contra el fondo (x = 40)
    const r = 8 + 20 * crece, cx = 48 + r, cy = 55;
    const punto = (g) => `${(cx + r * Math.cos(g * Math.PI / 180)).toFixed(1)} ${(cy + r * Math.sin(g * Math.PI / 180)).toFixed(1)}`;
    larva.setAttribute('d', `M${punto(-40)} A ${r} ${r} 0 1 0 ${punto(40)}`);
    larva.style.strokeWidth = 6 + 10 * crece;
    // Tapa de cera desde el día 9, y se rompe el 21
    const roe = Math.max(0, (d - 20.3) / 0.7);
    tapa.style.display = d >= 9 && roe < 1 ? '' : 'none';
    tapa.style.opacity = 1 - roe;
    // Pupa: de blanca a marrón, con ojos cada vez más oscuros; al final sale por la boca
    const enPupa = d >= 10;
    pupa.style.display = enPupa ? '' : 'none';
    const osc = Math.max(0, Math.min(1, (d - 12) / 8));
    pupa.style.setProperty('--pupa', `rgb(${245 - 160 * osc}, ${236 - 170 * osc}, ${220 - 190 * osc})`);
    pupa.querySelector('.p-ojo').style.opacity = Math.max(0, (d - 13) / 4);
    pupa.querySelector('.p-rayas').style.opacity = osc;
    const sale = Math.max(0, (d - 20.6) / 0.4);
    pupa.setAttribute('transform', `translate(${150 + 130 * sale} 55)`);

    if (f >= 1 && !nacio) { nacio = true; alNacer?.(); }
    if (f < 1) requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);
}
