/* Ventilación: cuando hace calor, unas obreras se paran en la entrada mirando hacia la colmena,
   con el abdomen levantado, y baten las alas para sacar el aire caliente. El aire se ve como
   partículas que salen por la entrada y se alejan.

   La entrada de esta miniatura es el hueco entre el cuerpo y el soporte (donde están las celdas
   de carga), del lado de la caja. Coordenadas: grupo en mm de la colmena.

   intensidad 0..1: la pone el día en el peso (según la hora) o la demo de la ficha del cuerpo. */
import { crearAbeja } from './abeja3d.js';

const THREE = AFRAME.THREE;
const ABEJAS_X = [-16, -10, -4, 2];     // mm, "a la derecha mirando de frente" (la caja está en +11)
const N_AIRE = 28;
const DEMO = { subida: 2.5, sostiene: 5, bajada: 2.5, tempBase: 34.8, tempPico: 36.4 };

function texturaAire() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,255,255,.9)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Ventilacion {
  constructor(colmena) {
    this.c = colmena;
    this.objetivo = 0;
    this.k = 0;
    this.reloj = 0;
    this.grupo = new THREE.Group();
    colmena.mm.add(this.grupo);
    this.abejas = ABEJAS_X.map(() => {
      const a = crearAbeja(5);
      this.grupo.add(a.grupo);
      return a;
    });
    const mat = new THREE.SpriteMaterial({ map: texturaAire(), transparent: true, depthWrite: false, opacity: 0.6 });
    this.aire = Array.from({ length: N_AIRE }, (_, i) => {
      const s = new THREE.Sprite(mat.clone());
      s.visible = false;
      s.userData = { vida: -1, edad: 0, desfase: i / N_AIRE };
      this.grupo.add(s);
      return s;
    });
    this.grupo.visible = false;
  }

  /* Ubica la entrada según la calibración (después de colmena.colocar) */
  colocar(cfg) {
    const L = cfg.cajaLado < 0 ? -1 : 1;
    this.L = L;
    const cu = this.c.partes.get('cuerpo'), so = this.c.partes.get('soporte');
    const frente = cu.zona.position.y + L * (cu.zona.scale.y / 2 - cu.margenMm);
    const piso = so.zona.position.z + so.zona.scale.z / 2 - so.margenMm;      // arriba del soporte
    this.entrada = new THREE.Vector3(cu.zona.position.x, frente, piso + 1.5);
    // Mirando hacia la colmena, con la nariz un poco abajo (abdomen levantado)
    const adelante = new THREE.Vector3(0, -L, -0.4).normalize();
    const X = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), adelante).normalize();
    const Y = new THREE.Vector3().crossVectors(adelante, X);
    const rot = new THREE.Matrix4().makeBasis(X, Y, adelante);
    this.abejas.forEach((a, i) => {
      a.grupo.position.set(this.entrada.x - L * ABEJAS_X[i], frente + L * 3, piso + 1.8);
      a.grupo.quaternion.setFromRotationMatrix(rot);
    });
  }

  setIntensidad(k) { this.objetivo = THREE.MathUtils.clamp(k, 0, 1); }

  /* Demo de la ficha del cuerpo: sube la temperatura de ejemplo, ventilan, vuelve a bajar */
  demo(extra) {
    this.demoT = 0;
    this.demoEl = extra;
    if (extra) extra.innerHTML = '<p class="ficha-temp"><span>Adentro</span> <strong></strong></p>'
      + '<p class="ficha-nota">Si adentro pasa de 35 °C, las obreras se paran en la entrada y baten las alas'
      + ' para sacar el aire caliente. Si hace falta, traen agua y la dejan evaporar, como un aire acondicionado.</p>';
  }

  tick(dt, visible) {
    this.reloj += dt;
    // Demo: intensidad y temperatura de ejemplo según el tiempo
    if (this.demoT !== undefined) {
      this.demoT += dt;
      const t = this.demoT, D = DEMO, fin = D.subida + D.sostiene + D.bajada;
      const k = THREE.MathUtils.smoothstep(t, 0, D.subida) * (1 - THREE.MathUtils.smoothstep(t, D.subida + D.sostiene, fin));
      const calorK = THREE.MathUtils.smoothstep(t, 0, D.subida * 0.8) * (1 - THREE.MathUtils.smoothstep(t, D.subida + 1, fin));
      this.objetivo = k;
      const el = this.demoEl?.querySelector('.ficha-temp strong');
      if (el && this.demoEl.isConnected) {
        el.textContent = `${(D.tempBase + (D.tempPico - D.tempBase) * calorK).toLocaleString('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })} °C`;
      }
      if (t >= fin) { this.demoT = undefined; this.objetivo = 0; }
    }

    this.k += (this.objetivo - this.k) * (1 - Math.exp(-dt / 0.4));
    const activo = visible && this.k > 0.02;
    this.grupo.visible = activo;
    if (!activo || !this.entrada) return;

    this.abejas.forEach((a, i) => {
      a.escala.scale.setScalar(5 * THREE.MathUtils.smoothstep(this.k, 0.1 * i, 0.1 * i + 0.4));
      a.aletear(this.reloj + i * 0.13, 22);
    });
    // Aire: nace en la entrada, se aleja hacia afuera y sube un poco mientras se desvanece
    for (const s of this.aire) {
      const u = s.userData;
      u.edad += dt;
      if (u.vida < 0 || u.edad > u.vida) {
        if (Math.random() > this.k * 0.6) { s.visible = false; continue; }
        u.vida = 1.2 + Math.random() * 0.8; u.edad = 0;
        u.x = this.entrada.x - this.L * (ABEJAS_X[0] + Math.random() * (ABEJAS_X[3] - ABEJAS_X[0]));
        u.z = this.entrada.z + Math.random() * 1.5;
      }
      const f = u.edad / u.vida;
      s.visible = true;
      s.position.set(u.x, this.entrada.y + this.L * (1 + 18 * f), u.z + 4 * f * f);
      s.scale.setScalar(1.2 + 2.5 * f);
      s.material.opacity = 0.55 * this.k * Math.sin(Math.PI * f);
    }
  }
}
