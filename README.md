# Colmena Airux — proyecto educativo (esqueleto)

Primer paso del proyecto educativo: la colmena virtual alineada con la real, con oclusores, zonas táctiles, resaltado al tocar y panel de calibración. Todavía no tiene fichas, contador, rayos X, abejas ni sonido.

## Qué hace hoy

Se escanea la tapa (MindAR, anclaje por imagen; funciona en iPhone). Al tocar una parte en la pantalla, la parte real se resalta con un contorno naranja y arriba aparece su nombre. Las partes tocables son la tapa, el cuerpo, el soporte, las celdas de carga, la caja estanca y la antena LoRa. La antena es virtual, porque no está en la pieza impresa.

Cada toque emite el evento `parte-tocada` en la escena, con `{ id }`. La ficha y el contador del paso siguiente se cuelgan de ahí.

## Estructura

```
index.html                 escena A-Frame + UI mínima
src/config.js              ejes, CALIBRACION (lo que se pega del panel) y PIEZAS
src/main.js                arranque, componente colmena-edu, toques y panel
src/colmena/stl.js         lector de STL binario + separación de los 10 marcos
src/colmena/piezas.js      oclusores, zonas táctiles, interior y resaltado
src/interaccion/toque.js   toque → rayo desde la cámara
src/ui/calibracion.js      panel reducido
assets/stl/                mallas extraídas del 3MF (escala original; se cargan a 0,5)
targets/tapa.jpg           imagen del marker (referencia)
```

Usa módulos ES sin empaquetador. A-Frame 1.5.0 y MindAR 1.2.5 se cargan por `<script>` antes del módulo, y el código propio usa `AFRAME.THREE`. Nunca importa `three` aparte, porque traería una segunda copia de three que no funciona con la escena de A-Frame.

## Assets

- **`targets/tapa.mind`: falta.** La tapa no cambió, así que se copia el de la v1, `colmena-airux-v1/targets/tapa.mind`. Si no está, el inicio muestra "Falta el marker compilado".
- **STL** (`assets/stl/`, 576 KB, unos 135 KB con gzip): cuerpo, marcos, alimentador, soporte, celda de carga y caja estanca. Salieron del 3MF sin cambios de orientación. Si se reemplazan por los STL originales, hay que revisar que estén en la misma orientación; los giros están en `PIEZAS`, en `config.js`.
- **Interior:** 9 marcos y el alimentador. Con las mallas del 3MF miden 37,8 mm contra 36,9 mm de interior, así que el paso se achica un 3% para que no se encimen.

## Rayos X y el marco que sale

El botón **Rayos X** (arriba a la derecha) abre un círculo fijo en la pantalla, un poco arriba del centro. Se apunta moviendo el celular: dentro del círculo, los oclusores de la tapa, el cuerpo y la caja descartan sus fragmentos y se ve el interior virtual (marcos con panal, reina y obreras, y pilas AAA genéricas dentro de la caja). El radio se ajusta en el panel (**Rayos X: radio**, en px).

Tocar un marco dentro del círculo abre la ficha de Marcos y saca el marco del centro: sube por encima de la tapa, se agranda y gira para mostrar la cara con la reina a la cámara. Sobre ese marco, la cría (elipse del centro) abre "Cría y reina" y el resto abre "Panal". Al cerrar la ficha, el marco vuelve. Las pilas abren la ficha de la caja.

## Pistas y abeja guía

Sobre cada parte de afuera que falta descubrir (tapa, cuerpo, soporte, celdas, caja, panel solar y una flor) late un punto naranja; desaparece al descubrirla. Para lo de adentro late el botón **Rayos X**, a partir de que se descubren dos cosas de afuera.

Si pasan 12 s sin descubrir nada (con la ficha cerrada), sale de la tapa una abeja grande, vuela hasta una parte que falta (primero las esenciales), la ronda unos segundos mientras su pista late más fuerte y vuelve a entrar. Con `?grupo` en la URL (alguien explica con el celular espejado) o con "reducir movimiento" activado, la abeja guía no sale. Los tiempos están en `T`, en `src/interaccion/guia.js`.

## Animaciones de las fichas

Algunas fichas tienen un botón ▶ que lanza una animación (`acciones` en `contenidos/puntos.json`, código en `src/anim/`):

- **Celdas de carga → Ver un día de la colmena** (`dia.js`): 24 h en 24 s. Un sol cruza detrás de la colmena, las luces y un velo de color sobre toda la pantalla pasan de noche a día, el enjambre sale a la mañana y vuelve al atardecer, y en la ficha se dibuja la curva de peso de ejemplo. Al mediodía ventilan.
- **Cuerpo → ¿Qué pasa si hace calor?** (`ventilacion.js`): la temperatura de ejemplo sube y cuatro obreras se paran en la entrada a batir las alas; el aire caliente sale como partículas.
- **Cría y reina → Ver de huevo a abeja** (`ciclo.js`): los 21 días de una obrera dibujados en la ficha; al final sale una abeja del marco en la AR.
- **Flores → Ver cómo se forma un fruto**: la flor de la abeja marcada se vuelve fruto con la próxima visita. Además pasa solo: una flor con muchas visitas pierde los pétalos y crece un fruto que madura de verde a rojo (`FRUTO` en `escena-v1.js`).

## Inclinación y anclaje firme

`src/interaccion/anclaje.js` corrige la pose de MindAR antes de que la usen los demás:

- **Inclinación:** con el sensor de orientación del celular se calcula el ángulo entre la tapa y la vertical. Si pasa de 30° durante 0,4 s (la tapa en la mano, una foto en la pared), la escena se oculta, no se puede tocar nada y abajo aparece "Apoyá la colmena sobre una mesa". Vuelve por debajo de 24°. En iPhone pide permiso de movimiento en el toque de "Abrir la cámara"; sin sensor o sin permiso no se chequea. El panel de calibración muestra la inclinación medida.
- **Firmeza:** se ignoran las correcciones del tracking menores a 1,5 mm y 1,2°, así la escena no tiembla; si el celular se mueve de verdad, la sigue en ~0,1 s y vuelve a quedarse quieta. Con `?fijo` (celular en un soporte), después de 2 s de captura estable la zona muerta pasa a 8 mm y 5°.

Los umbrales están en `ANCLAJE`.

## Calibrar con la colmena real

1. Servir la carpeta (ver abajo), abrir la cámara, apuntar a la tapa y tocar **Calibrar**.
2. Activar **Ver: Oclusores**: las piezas se ven en rosa translúcido sobre la colmena real.
3. Ajustar, en este orden: **Eje X / Eje Y** hasta que el cuerpo rosa coincida con el real; **Alto total** hasta que el soporte toque la mesa; **Soporte girado 90°** si las patas quedan cruzadas; **Separación de celdas** con las puntas naranjas; **Caja: corrimiento y altura**.
4. Si la caja aparece del lado contrario, la tapa está girada: marcar **Caja del lado de la abeja**.
5. **Ver: Zonas táctiles** muestra en verde las cajas que reciben el toque. **Ver: Interior** muestra los marcos; con los oclusores rosas se ven a través del cuerpo.
6. **Copiar valores** y pegar el JSON en `CALIBRACION` (`src/config.js`).

## Probar en el teléfono

La cámara exige HTTPS, salvo en `localhost`. Los módulos ES necesitan servidor: abrir `index.html` como archivo no funciona.

- **Compu con webcam:** `python3 -m http.server 8085` → `http://localhost:8085`.
- **Android por USB:** `adb reverse tcp:8085 tcp:8085` → `http://localhost:8085` en el celular; depurar con `chrome://inspect`.
- **iPhone:** `cloudflared tunnel --url http://localhost:8085`; consola en pantalla con `?eruda`.

## Valores calibrados finales

Pendientes. Los de `CALIBRACION` son estimaciones sacadas del 3MF y de una foto.

## Compatibilidad probada

| Dispositivo / navegador | Estado |
|---|---|
| Escritorio con webcam | a probar |
| Android — Chrome | a probar |
| iPhone — Safari | a probar |

## Qué se verificó y qué no

Se verificó, sin navegador:

- la sintaxis de todos los módulos (`node --check`);
- el lector de STL y la separación de marcos en Node, con un mock mínimo de three: las seis mallas cargan con las medidas esperadas, los marcos se separan en 10 de 3,44 mm y un archivo que no es STL da error claro;
- el armado con los mismos parámetros, en una vista previa en Python, comparada con la foto: las patas se abren en la cara −Y, la celda asoma a la izquierda y la caja queda a la derecha.

No se probó en un navegador real: A-Frame no se pudo cargar en este entorno, que no tiene acceso a la red. Quedan sin probar el render, la oclusión, el raycasting y el resaltado.

## Problemas conocidos

- Si falla la carga de un STL, no se arma ninguna pieza: el error aparece en la pantalla de inicio y en la consola.
- El resaltado es un contorno de aristas, con un relleno que destella y queda suave. En partes con muchas aristas internas (el soporte) puede verse cargado; se puede pasar a una silueta si molesta.
# Colmena Airux — proyecto educativo (esqueleto)

Primer paso del proyecto educativo: la colmena virtual alineada con la real, con oclusores, zonas táctiles, resaltado al tocar y panel de calibración. Todavía no tiene fichas, contador, rayos X, abejas ni sonido.

## Qué hace hoy

Se escanea la tapa (MindAR, anclaje por imagen; funciona en iPhone). Al tocar una parte en la pantalla, la parte real se resalta con un contorno naranja y arriba aparece su nombre. Las partes tocables son la tapa, el cuerpo, el soporte, las celdas de carga, la caja estanca y la antena LoRa. La antena es virtual, porque no está en la pieza impresa.

Cada toque emite el evento `parte-tocada` en la escena, con `{ id }`. La ficha y el contador del paso siguiente se cuelgan de ahí.

## Estructura

```
index.html                 escena A-Frame + UI mínima
src/config.js              ejes, CALIBRACION (lo que se pega del panel) y PIEZAS
src/main.js                arranque, componente colmena-edu, toques y panel
src/colmena/stl.js         lector de STL binario + separación de los 10 marcos
src/colmena/piezas.js      oclusores, zonas táctiles, interior y resaltado
src/interaccion/toque.js   toque → rayo desde la cámara
src/ui/calibracion.js      panel reducido
assets/stl/                mallas extraídas del 3MF (escala original; se cargan a 0,5)
targets/tapa.jpg           imagen del marker (referencia)
```

Usa módulos ES sin empaquetador. A-Frame 1.5.0 y MindAR 1.2.5 se cargan por `<script>` antes del módulo, y el código propio usa `AFRAME.THREE`. Nunca importa `three` aparte, porque traería una segunda copia de three que no funciona con la escena de A-Frame.

## Assets

- **`targets/tapa.mind`: falta.** La tapa no cambió, así que se copia el de la v1, `colmena-airux-v1/targets/tapa.mind`. Si no está, el inicio muestra "Falta el marker compilado".
- **STL** (`assets/stl/`, 576 KB, unos 135 KB con gzip): cuerpo, marcos, alimentador, soporte, celda de carga y caja estanca. Salieron del 3MF sin cambios de orientación. Si se reemplazan por los STL originales, hay que revisar que estén en la misma orientación; los giros están en `PIEZAS`, en `config.js`.
- **Interior:** 9 marcos y el alimentador. Con las mallas del 3MF miden 37,8 mm contra 36,9 mm de interior, así que el paso se achica un 3% para que no se encimen.

## Calibrar con la colmena real

1. Servir la carpeta (ver abajo), abrir la cámara, apuntar a la tapa y tocar **Calibrar**.
2. Activar **Ver: Oclusores**: las piezas se ven en rosa translúcido sobre la colmena real.
3. Ajustar, en este orden: **Eje X / Eje Y** hasta que el cuerpo rosa coincida con el real; **Alto total** hasta que el soporte toque la mesa; **Soporte girado 90°** si las patas quedan cruzadas; **Separación de celdas** con las puntas naranjas; **Caja: corrimiento y altura**.
4. Si la caja aparece del lado contrario, la tapa está girada: marcar **Caja del lado de la abeja**.
5. **Ver: Zonas táctiles** muestra en verde las cajas que reciben el toque. **Ver: Interior** muestra los marcos; con los oclusores rosas se ven a través del cuerpo.
6. **Copiar valores** y pegar el JSON en `CALIBRACION` (`src/config.js`).

## Probar en el teléfono

La cámara exige HTTPS, salvo en `localhost`. Los módulos ES necesitan servidor: abrir `index.html` como archivo no funciona.

- **Compu con webcam:** `python3 -m http.server 8085` → `http://localhost:8085`.
- **Android por USB:** `adb reverse tcp:8085 tcp:8085` → `http://localhost:8085` en el celular; depurar con `chrome://inspect`.
- **iPhone:** `cloudflared tunnel --url http://localhost:8085`; consola en pantalla con `?eruda`.

## Valores calibrados finales

Pendientes. Los de `CALIBRACION` son estimaciones sacadas del 3MF y de una foto.

## Compatibilidad probada

| Dispositivo / navegador | Estado |
|---|---|
| Escritorio con webcam | a probar |
| Android — Chrome | a probar |
| iPhone — Safari | a probar |

## Qué se verificó y qué no

Se verificó, sin navegador:

- la sintaxis de todos los módulos (`node --check`);
- el lector de STL y la separación de marcos en Node, con un mock mínimo de three: las seis mallas cargan con las medidas esperadas, los marcos se separan en 10 de 3,44 mm y un archivo que no es STL da error claro;
- el armado con los mismos parámetros, en una vista previa en Python, comparada con la foto: las patas se abren en la cara −Y, la celda asoma a la izquierda y la caja queda a la derecha.

No se probó en un navegador real: A-Frame no se pudo cargar en este entorno, que no tiene acceso a la red. Quedan sin probar el render, la oclusión, el raycasting y el resaltado.

## Problemas conocidos

- Si falla la carga de un STL, no se arma ninguna pieza: el error aparece en la pantalla de inicio y en la consola.
- El resaltado es un contorno de aristas, con un relleno que destella y queda suave. En partes con muchas aristas internas (el soporte) puede verse cargado; se puede pasar a una silueta si molesta.
