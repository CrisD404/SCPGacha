# SCP // GACHA

Gacha de cartas coleccionables con los expedientes reales de la **SCP Foundation Wiki** (9.892 cartas), inspirado en [wikigacha.com](https://wikigacha.com/). Funciona **100 % offline** (PWA): el progreso se guarda en el dispositivo (IndexedDB).

**Jugar:** https://crisd404.github.io/SCPGacha/ (se publica automáticamente con GitHub Actions en cada push a `main`).

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de producción + service worker
npm test           # lógica de juego (tiradas, garantías, combate, respaldo)
```

## Features (paridad con wikigacha)

| wikigacha | SCP Gacha |
|---|---|
| Paquetes de 5 cartas, 10 diarios, +1 por minuto | Igual (las misiones pueden superar el máximo) |
| Garantía SR+ tras 10 paquetes | Cada 10.º paquete garantiza SR+ |
| Paquete arcoíris (SSR+) primer tirada del día / cada 100 | **Paquete Thaumiel** (SSR+) con el primer sello del día y cada 100 paquetes |
| Paquete negro (UR+) cada 5 inicios de sesión | **Paquete O5** (UR+) cada 5 sellos de asistencia |
| Misiones diarias (+2 paquetes c/u) | Abrir 5 paquetes · Conseguir SR+ · Leer un expediente en la wiki · Compartir · Ganar un combate |
| Modo de efectos intensos | Igual: revelado cinematográfico 1 a 1, o rápido en cuadrícula |
| Video para cartas raras | **Animaciones cortas por rareza** (ver abajo), sin video |
| Colección con estadísticas, orden, búsqueda, favoritas | Igual + filtro por clase/etiqueta y "mostrar no obtenidas" |
| Vista de colección (hasta 10 cartas) | **Vitrina** |
| Exportar/importar respaldo, borrar colección | Igual (texto/archivo con suma de verificación) |
| 57 trofeos | 71 trofeos con insignias propias (bronce, plata, oro, O5; algunos secretos) |
| Avisos emergentes | Notificaciones temáticas **en cola** (de a una, se pausan al pasar el puntero, tocar para descartar) |
| Botones sueltos de sonido/trofeos/efectos | **Consola del agente**: menú colapsable con efectos intensos, sonido + volumen, trofeos y manual |
| Combate: incursión diaria, 1v1 por grado, equipos 5v5, historia | **Brecha diaria**, **Duelo**, **Equipos**, **Recontención** (100 operaciones con niveles) |
| Copiar/compartir resultado (texto) | **Terminal de filtración**: estudio para compartir imágenes, GIF o video listos para redes (ver abajo) |

## Criterio de rareza

La rareza se mapea a los **Niveles de Autorización** de la Fundación y sale del **Índice de Notoriedad (IN)**, el percentil (0–100) de un puntaje compuesto:

```
puntaje = 45% percentil de valoración global (votos)
        + 25% percentil de valoración dentro de su serie   ← compensa la antigüedad
        + 15% percentil de referencias desde otros SCP     ← peso en el canon
        + 10% clase de objeto (Apollyon > Archon > Thaumiel > Keter > Esotérica > Euclid > …)
        +  5% destacado (featured / Reviewers' Spotlight)
```

| Rango | Autorización | IN | Cartas | Prob. por carta |
|---|---|---|---|---|
| **LR** | O5 · Consejo O5 | ≥ 99,5 | 65 | 0,1 % |
| **UR** | Nivel 5 · Thaumiel | ≥ 98 | 142 | 0,5 % |
| **SSR** | Nivel 4 · Alto Secreto | ≥ 94 | 392 | 1,9 % |
| **SR** | Nivel 3 · Secreto | ≥ 84 | 990 | 6 % |
| **R** | Nivel 2 · Restringido | ≥ 64 | 1.977 | 15 % |
| **UC** | Nivel 1 · Confidencial | ≥ 34 | 2.968 | 30 % |
| **C** | Nivel 0 · Uso Oficial | < 34 | 3.358 | 46,5 % |

Las leyendas del canon (SCP-173, 682, 096, 049, 106, 999, 914, 055, 087, 3000, 3008, 2000, 001…) se fuerzan a LR.

- **ATK (amenaza)**: peligrosidad de la clase + etiquetas hostiles (`hostile`, `reality-bending`, `k-class-scenario`…) × multiplicador de rareza.
- **DEF (contención)**: extensión del expediente + etiquetas de resistencia (`indestructible`, `self-repairing`…) × multiplicador de rareza. Máx. 15.000.
- **Habilidad por clase** en combate: Safe −15 % daño recibido, Euclid 15 % esquiva, Keter +12 % crítico, Thaumiel autocuración, Apollyon ignora mitigación, Neutralizada sobrevive con 1 HP, etc.

## Animaciones de revelado

La carta más rara siempre sale última. Al rasgar el paquete, la luz que escapa por el corte (resplandor, haces que oscilan y partículas) anticipa la rareza con su color e intensidad (hasta SSR, para no arruinar sorpresas mayores).

| Rareza | Secuencia |
|---|---|
| C / UC | Volteo con chispa |
| R | Brillo azul + onda |
| SR | Carga púrpura con temblor, destello y estallido |
| SSR | Oscurecimiento, sello **ALTO SECRETO** que golpea la carta, rayos rojos, holograma |
| UR | Alarma roja giratoria, **⚠ ANOMALÍA DETECTADA** con glitch, destello blanco, explosión dorada |
| LR | Apagón total, latidos, **BRECHA DE CONTENCIÓN** con estrobo, la carta se agrieta y estalla en esquirlas, halo prismático con el emblema girando |

UR y LR pueden empezar con un **amago**: arrancan como una SR y "fallan" antes de escalar. Todo es CSS + canvas + WebAudio sintetizado (0 archivos de audio/video); respeta `prefers-reduced-motion` y se puede saltar tocando.

## Compartir

Todo lo compartible (resultado del paquete, una carta, la vitrina, duelos, equipos y la brecha diaria) abre la misma **Terminal de filtración**, un estudio a pantalla completa que genera una pieza lista para redes sociales:

- **Cartas**: todas, sólo la mejor o una selección (mínimo una).
- **Formato**: Post 1:1 (1080×1080), Retrato 4:5 (1080×1350, Instagram) e Historia 9:16 (1080×1920, estados de WhatsApp e historias de Instagram, con márgenes libres para su interfaz).
- **Estilo**: Archivo, Alerta roja, Thaumiel y Expediente (papel manila con cinta).
- **Salida**: imagen PNG, **GIF animado** en bucle (2,4 s) o **video** (MP4 si el navegador puede grabarlo; si no, WebM).
- **Textos y sello**: título libre o sugerido, firma de agente opcional, sello (automático, clasificado, alto secreto, brecha o ninguno) y resumen de rarezas.
- **Acciones**: *Copiar* (imagen al portapapeles), *Compartir* (hoja nativa del sistema con el archivo; donde no existe, se descarga) y *Descargar*.

La pantalla de resultados del paquete usa un dock de tres columnas: **Volver · Compartir · Abrir otro** (muestra el próximo paquete disponible). Todo se dibuja en canvas en el dispositivo (sin servidores ni librerías de captura); el GIF se codifica con `gifenc` y el video con `MediaRecorder`. El estudio se carga bajo demanda y queda precacheado para usarse offline.

## Idiomas

Español (Latinoamérica) e inglés, desde la **Consola del agente**. El idioma es una preferencia del dispositivo (no viaja en los respaldos) y se detecta del navegador la primera vez.

- **Interfaz**: diccionarios en `src/i18n/es.ts` (referencia) y `src/i18n/en.ts`. TypeScript exige que ambos tengan las mismas claves y un test verifica que coincidan los `{marcadores}`. `t('clave', { n })` para texto plano y `<Trans k="clave" />` para textos con `**negritas**` o enlaces.
- **Cartas**: el original es inglés. En español, apodos y descripciones salen de `public/data/cards.es.json`, una **traducción automática hecha sin conexión** con `Helsinki-NLP/opus-mt-tc-big-en-es` (CTranslate2 int8) y post-edición con las convenciones de SCP-ES (Sitio-19, Clase-D, [DATOS ELIMINADOS]…). El detalle de la carta indica que es traducción automática y muestra el título original.

Para regenerar las traducciones (≈ 25 min en CPU, sin servicios externos), ver la cabecera de `scripts/translate_cards.py`:

```bash
python scripts/translate_cards.py --model .cache/ct2-en-es
```

## Datos

`public/data/cards.json` se genera con `npm run dataset` desde el dump público de [scp-data.tedivm.com](https://scp-data.tedivm.com/) (≈ 500 MB de descarga, se cachea en `.cache/`). El script extrae clase de objeto (incluida la barra ACS), descripción, apodos de los hubs de series y calcula rareza/ATK/DEF. Los párrafos que son metadatos del artículo (autor, créditos, avisos de contenido, nota de licencia) no se usan como descripción: esas cartas muestran [DATOS ELIMINADOS].

**Descripciones.** Se guarda un extracto de la sección *Description* (párrafos y listas consecutivos, hasta ~760 caracteres, cortado siempre al final de una oración). La **vista expandida** de la carta lo muestra completo. En la **cara de la carta** sólo entran 6 líneas, así que se muestra un resumen calculado en el cliente (`src/data/summary.ts`, mismo criterio en inglés y español):

1. Oraciones completas desde el principio, mientras quepan (respeta abreviaturas como *Dr.*, *aprox.*, *EE. UU.*).
2. Si la primera oración no cabe, se corta en una pausa natural que no cambia el sentido (antes de *, which…*, *, que…*, *, y…*, un paréntesis, *;* o *—*) y se cierra con punto.
3. Último recurso (≈ 4 % de las cartas): corte por palabra con "…".

## Arquitectura

- `src/game/` lógica pura y testeada (tiradas, energía, combate, trofeos, respaldo).
- `src/store/game.ts` único punto de escritura del estado (`SaveData`, versionado con `migrateSave`). Para la **sincronización futura** basta con enviar/recibir ese objeto (o sus deltas) desde las acciones del store.
- `src/components/OpeningScene.tsx` secuencias de revelado; `src/fx/` partículas y sonido.
- `src/share/` estudio para compartir: `render.ts` dibuja la escena (función pura del tiempo `t ∈ [0,1)` para bucles perfectos), `export.ts` genera PNG/GIF/video y maneja portapapeles y hoja de compartir.
- En desarrollo: `window.__scpForce(['C','R','SR','UR','LR'])` fuerza un paquete para probar animaciones sin tocar el progreso.

## Licencia y créditos

Proyecto de fans, no oficial. El contenido de los expedientes pertenece a sus autores en la SCP Foundation Wiki y se usa bajo **CC BY-SA 3.0**; cada carta acredita a su autor. Las traducciones automáticas son obras derivadas bajo la misma licencia. Modelo de traducción: Helsinki-NLP/opus-mt-tc-big-en-es (CC BY 4.0). El arte de las cartas es procedural (generado por el juego).
