# Diario de Productos y Lista de Acopio: causa raíz y corrección

Fecha: 30 de octubre de 2026. Cambios locales, sin desplegar.

## 1. Causa confirmada

Los dos diarios dependían de descargar **todo el catálogo elegible de artículos, incluido Inventory**, antes de terminar la carga inicial. El recuento real de BC es **11.260 artículos**. La consulta original agotó su timeout de 30 segundos sin devolver siquiera la primera página. No se trataba de descargar artículos al pulsar cada tecla: la pantalla ya estaba esperando la descarga completa para ofrecer búsqueda local.

El cuello de botella observado está en la petición HTTP a `Ficha_producto_Excel`, antes de que el backend pueda transformar los datos y antes de que React pueda mostrarlos. La caché de cinco minutos solo protegía cargas calientes exitosas; tras caducar, reiniciar el proceso o fallar una carga, se repetía el trabajo completo. Por eso cachear el catálogo no eliminaba la recurrencia.

La evidencia confirma el fallo de diseño —hacer depender un selector del catálogo completo con inventario— y la consulta que agota el tiempo. No permite atribuir porcentajes de ese coste a SQL, FlowFields o código AL interno; sería necesaria telemetría de BC. No se ha aumentado ningún timeout existente.

## 2. Flujo y archivos responsables

### Antes

**Diario de Productos**:

`EntradasAlmacen.jsx` → `servicio.obtenerProductos()` → `GET /api/almacen/productos` → `almacenBC.obtenerProductos()` → `businessCentral.obtenerMaterialesConReferencia()` → `Ficha_producto_Excel` completo.

El efecto de carga esperaba `Promise.allSettled` de productos, tipos, operaciones y enviados. El botón Nueva línea dependía además de que el array de productos tuviera contenido. Cada fila construía opciones para todo el catálogo y `BuscadorMovimiento` normalizaba y filtraba esos datos localmente.

**Lista de Acopio / Movimientos de Almacén**:

`MovimientosAlmacen.jsx` → `GET /api/almacen/movimientos/catalogos` → `obtenerArticulosMovimiento()` → el mismo catálogo completo. El endpoint esperaba las colecciones auxiliares y artículos antes de responder. `LineasMovimiento` transformaba todo el catálogo y cada selector preparaba su índice local.

Consulta responsable:

```text
Ficha_producto_Excel
$select=No,Referencia_TLM,Description,Base_Unit_of_Measure,Inventory,Blocked,Type
$filter=Referencia_TLM ne '' and Blocked eq false and Type eq 'Inventory'
Prefer: odata.maxpagesize=5000
```

No había `$top` ni filtro por texto o artículo seleccionado. Se recorrían todos los `@odata.nextLink` hasta completar el catálogo.

### Después

Las dos pantallas utilizan `BuscadorArticulo`, que consulta `GET /api/almacen/articulos?buscar=...`. No se solicita ningún catálogo de artículos al cargar una pantalla vacía ni al abrir un selector sin texto.

El diario carga tres recursos iniciales en paralelo: tipos, operaciones y enviados. Acopio mantiene su endpoint de catálogos auxiliares y proyectos, pero el endpoint de catálogos ya no consulta artículos. Devuelve `articulos: []` y los artículos seleccionados se recuperan individualmente.

## 3. Mediciones reales

Fuentes conservadas sin credenciales, URLs de empresa, códigos ni descripciones:

- `diagnostico-articulos-2026-10-30.json`: consultas BC y servicio backend.
- `diagnostico-navegador-articulos-2026-10-30.json`: prueba con Edge headless y bundle de producción.

### BC y backend

| Medición | Tiempo total | Tiempo HTTP BC | Filas recibidas | Llamadas BC |
|---|---:|---:|---:|---:|
| Consulta original completa | 30.224 ms | 30.011 ms y timeout | Ninguna página completada | 1 GET fallido |
| Prototipo limitado para «cab» sin Inventory | 744 ms | 507 y 741 ms, en paralelo | 0 + 21 | 2 |
| Servicio final, búsqueda «cab» fría | 949 ms | 554 y 946 ms, en paralelo | 21 desde BC; 20 al cliente | 2 |
| Mismo servicio final, repetición caliente | <1 ms, redondeado a 0 | Sin petición | 20 al cliente | 0 |
| Detalle de un artículo con Inventory | 360 ms | 360 ms | 1 | 1 |
| Recuento de catálogo con `$count=true`, sin Inventory | 313 ms | 313 ms | 1 fila y total 11.260 | 1, solo diagnóstico |

La medición original de servicio incluye obtención de token y manejo del error. La comparación posterior se hizo con token disponible. No se obtuvo el tamaño completo del catálogo original porque la primera página nunca terminó: no sería correcto afirmar que se descargaron 11.260 registros durante ese intento.

En la búsqueda fría final, ambas respuestas BC sumaron **5.609 bytes de JSON descomprimido**. El array normalizado de 20 artículos ocupó 5.703 bytes; la respuesta HTTP completa `{articulos, hayMas}` medida en navegador fue de 5.731 bytes. No son bytes comprimidos en el cable ni tamaños extrapolados del catálogo original.

### Frontend en navegador

Se usó Edge headless, el bundle real de producción y el servicio real de búsqueda contra BC, mediante HTTP local. **Los endpoints auxiliares se simularon** para aislar el selector: estos resultados no equivalen a medir toda la pantalla con autenticación y backend desplegados.

| Selector | Desde escribir hasta presentar resultados | Antes de HTTP, incluido debounce | HTTP local + backend/BC | Presentación tras recibir HTTP |
|---|---:|---:|---:|---:|
| Diario de Productos, búsqueda fría | 1.165 ms | 313 ms | 846 ms | 6 ms |
| Acopio, misma búsqueda con caché backend caliente | 334 ms | 311 ms | 2 ms | 21 ms |

En esta prueba el servicio backend tardó 844 ms en frío, con dos peticiones BC de 602 y 841 ms ejecutadas en paralelo. La repetición caliente no hizo peticiones BC. Ambos selectores tenían **0 llamadas de artículos al abrirse** y mostraban **12 opciones en el DOM**, gracias a la virtualización existente.

El tiempo tras HTTP incluye actualización y presentación observada con dos frames, no es un perfil exclusivo de CPU React. Son muestras puntuales, no p50/p95 ni una garantía de latencia futura de BC.

## 4. Número de llamadas y paginación

| Acción | Llamadas frontend de artículos | Consultas BC en frío |
|---|---:|---:|
| Cargar pantalla sin artículos guardados | 0 | 0 |
| Abrir el selector sin escribir | 0 | 0 |
| Escribir menos de tres caracteres | 0 | 0 |
| Escribir una ráfaga de teclas y parar 300 ms | 1 búsqueda | 2 consultas filtradas y paralelas |
| Repetir el mismo texto durante 30 s | Reutiliza caché frontend; si llega al backend, reutiliza su caché | 0 mientras la caché siga vigente |
| Seleccionar un artículo / recuperar código guardado | 1 detalle por código; simultáneas compartidas | 1 consulta exacta |

La búsqueda se divide en referencia y descripción porque BC no admite `OR` entre campos distintos. Cada consulta usa `$top=21`, `$schemaversion=2.1`, `$orderby=No`, un filtro `contains(tolower(...))` y una proyección sin Inventory. Las coincidencias se unen por **número interno**, conservando referencias TLM duplicadas, y se devuelven como máximo 20 con `hayMas` para pedir al usuario que concrete el texto.

Se siguen páginas pequeñas si BC las devuelve, pero se detiene la lectura al reunir 21 registros por campo aunque exista otro `nextLink`. Se mantienen la comprobación de origen/ruta, detección de páginas repetidas y límite temporal. En las mediciones limitadas no apareció ningún `nextLink`. El intento original falló en la primera petición, por lo que el timeout reproducido no procede de un ciclo de páginas.

La limitación deliberada no se presenta como un catálogo completo: se indica «Hay más coincidencias. Escribe más caracteres para concretar». El usuario puede localizar artículos fuera de los primeros veinte mediante un texto más específico. No se usan catálogos completos como fallback ante un error.

Referencia técnica: [filtros OData admitidos por BC](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/use-filter-expressions-in-odata-uris) y [rendimiento de clientes OData](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/odata-client-performance).

## 5. Efectos, estados, caché y memoria

- Los efectos de carga inicial dependen de usuario/clave y actualización explícita. No se encontró un efecto que vuelva a descargar productos por cada render ni por cada tecla. StrictMode puede repetir montajes de desarrollo; no explica el timeout BC medido.
- La búsqueda espera 300 ms y al menos tres caracteres. El temporizador se limpia al cambiar el texto, cerrar el selector o desmontar el componente.
- Las respuestas de búsquedas antiguas se ignoran; una respuesta lenta no reemplaza resultados de un texto posterior. Los resultados previos no se presentan para el nuevo texto mientras carga.
- Cada búsqueda termina en resultado o error visible con reintento explícito. No hay reintentos automáticos en bucle. El detalle guardado tiene su propio error y reintento.
- Las llamadas iguales simultáneas se comparten en frontend y backend. Los fallos se expulsan de la caché para permitir recuperar la consulta.
- La caché frontend de búsqueda dura 30 s, separa sesión y conserva como máximo 100 claves. La backend dura 30 s, separa empresa/configuración y conserva 200 claves. Los artículos por código comparten solo peticiones en curso: no se mantiene inventario individual mediante TTL.
- La caché auxiliar de almacenes, departamentos, tipos y zonas de 60 s, introducida en la revisión previa, sigue vigente. No se cachea la validación de solicitantes activos al enviar.
- Las páginas conservan los artículos seleccionados y los buscadores una lista limitada; ya no generan arrays de 11.260 opciones por fila. Las filas desmontadas ignoran respuestas pendientes. Las peticiones compartidas ya enviadas pueden terminar en segundo plano; no se cancela la lectura de otro consumidor al cerrar un selector.
- El catálogo completo anterior permanece disponible para consumidores compatibles, pero estos dos diarios no lo utilizan. Stock y validaciones de BC conservan su flujo. No se ha modificado el service worker ni añadido caché persistente de inventario.

## 6. Solución y archivos

| Archivo | Cambio |
|---|---|
| `backend/services/businessCentral.js` | Búsqueda acotada por texto, consulta exacta por código, proyección ligera, unión de resultados y cachés |
| `backend/routes/almacen.js` | Nuevo endpoint de búsqueda; retira artículos de la carga inicial de catálogos de acopio |
| `backend/utils/cacheLecturas.js` | Límite opcional de claves para cachés de búsqueda |
| `frontend/src/services/articulos.js` | Contrato de búsqueda/detalle, validación, caché por sesión y deduplicación |
| `frontend/src/components/BuscadorArticulo.jsx` | Debounce, estados de carga/error, descarte de respuestas antiguas y recuperación individual |
| `frontend/src/components/BuscadorMovimiento.jsx` | Admite resultados remotos y estados visibles; mantiene teclado, portal y virtualización |
| `frontend/src/components/DiarioAlmacen.jsx` | Usa búsqueda remota en el diario editable |
| `frontend/src/components/LineasMovimiento.jsx` | Usa búsqueda remota en acopio |
| `frontend/src/pages/EntradasAlmacen.jsx` | Quita descarga inicial completa y dependencia de ese catálogo para crear líneas |
| `frontend/src/pages/MovimientosAlmacen.jsx` | Conserva solo artículos seleccionados y recupera los guardados por código |
| Tests de búsqueda, HTTP, caché, componentes y páginas | Regresiones de límites, permisos, recuperación, errores y ausencia de descarga completa |

No se cambia el cuerpo de los POST, identidades durables, gestión de respuestas inciertas, registro contable ni validaciones AL. Las selecciones siguen transmitiendo el número interno correcto, aunque varios artículos compartan referencia TLM.

Los instrumentos de diagnóstico fueron temporales y no forman parte del código de producción. Se conservan únicamente métricas sanitizadas en los JSON de evidencia; no se añadieron logs por pulsación ni por artículo.

Validación final: **135 pruebas backend y 148 frontend aprobadas** (27 suites frontend), lint sin advertencias y compilación de producción correcta. Se verifican permisos del endpoint, ausencia de descarga de artículos en catálogos de acopio, debounce, respuestas obsoletas, errores recuperables, códigos guardados, separación de sesión, paginación y límite de memoria de caché. Las pruebas existentes de idempotencia y recuperación de envíos siguen aprobadas.

## 7. Mejora esperada y límites

La dependencia que reproducía el timeout desaparece de ambas páginas: abrir y buscar ya no necesita descargar los 11.260 artículos ni calcular su inventario completo. En la muestra real, una consulta que no devolvía primera página en 30 s se sustituye por búsquedas acotadas de alrededor de un segundo hasta resultados, y unos 334 ms con caché, incluido debounce.

BC puede seguir devolver errores o estar inaccesible. En esos casos la interfaz muestra el fallo y permite reintentar; no oculta el problema ni promete evitar cualquier timeout externo. La medición de una sesión completa en el despliegue y la telemetría interna de AL/SQL siguen fuera del alcance de estas muestras. Para usar la corrección deben desplegarse backend y frontend juntos, porque el frontend utiliza el nuevo endpoint.
