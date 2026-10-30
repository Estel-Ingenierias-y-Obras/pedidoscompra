# Selector de artículos: desplegable con búsqueda

> Última actualización: el usuario ha solicitado búsqueda desde tres caracteres, conservando el campo original. Véase `BUSQUEDA-TRES-CARACTERES-2026-10-30.md`. Las iteraciones siguientes son históricas.

> Estado actual tras la aclaración del usuario: se ha restaurado el **catálogo completo con filtrado local** y el selector original de la versión estable. Se retiraron los componentes y servicios frontend de búsqueda remota. Ya no hay mínimo de tres caracteres, límite de veinte resultados ni «Reintentar búsqueda» en el selector. Se mantiene la caché backend; el inventario se consulta únicamente para el artículo seleccionado. La referencia concreta `20193978` se verificó contra BC dentro de los 11.260 artículos, coincidiendo con el prefijo de código mostrado en la captura. Detalles vigentes en `RESTAURACION-CATALOGO-COMPLETO-2026-10-30.md`. El resto de este documento es histórico y describe una iteración retirada.

## Diagnóstico comprobado

Se compararon cuatro artículos reales de BC mediante consultas pequeñas, sin Inventory ni descarga completa: dos referencias numéricas y dos alfanuméricas.

Antes del cambio, las cuatro referencias TLM encontraban el artículo correcto, también usando mayúsculas o minúsculas. Sus cuatro números internos, distintos de las referencias TLM, no lo encontraban. La causa reproducida está en `businessCentral.buscarArticulos`: solo se consultaban `Referencia_TLM` y `Description`; faltaba `No`. No se ha reproducido un fallo general del campo TLM, de su mapeo ni de mayúsculas/minúsculas en esta muestra.

Además, la lista parcial se ordenaba por `No` antes de limitarse, sin dar prioridad a referencias exactas. Una coincidencia exacta podía quedar fuera de los primeros resultados si compartía texto con muchas referencias. Esta condición está cubierta por una regresión controlada, no se atribuye a todos los casos reales del usuario.

El problema de interacción era independiente: `BuscadorMovimiento` mezclaba texto editado y selección. Al escribir llamaba a `onChange("")`, borrando el artículo guardado, y al salir restablecía el texto según esa selección ya vacía. Abrir dependía del foco, lo que impedía reabrir con un clic un campo que seguía enfocado después de Escape. El aspecto de input tampoco indicaba claramente que había un desplegable.

Evidencias sanitizadas:

- `diagnostico-referencia-selector-2026-10-30.json`: comprobación anterior, cuatro números internos no encontrados.
- `diagnostico-referencia-selector-despues-2026-10-30.json`: los mismos cuatro artículos encontrados por referencia y número interno tras corregir la búsqueda.
- `diagnostico-ux-select-articulo-2026-10-30.json`: prueba de interacción y presentación en Edge, escritorio y móvil.

## Experiencia implementada

`SelectArticulo` presenta un campo con flecha y el valor seleccionado. Un clic abre un panel con buscador enfocado y lista de resultados en formato **Referencia - Descripción**. La referencia aparece destacada. Se puede elegir con clic o flechas y Enter; Escape, Tab o clic fuera cierran sin cambiar el artículo anterior.

El texto del buscador queda separado de la selección. Buscar otro material o cancelar no modifica el borrador. El campo vuelve a abrirse con clic aunque conserve el foco. La lista mantiene virtualización, como máximo 12 opciones montadas a la vez, y se posiciona en un portal para no quedar recortada por las tablas. Se ha comprobado que cabe en una pantalla móvil de 390 px.

El componente común `BuscadorArticulo` utiliza el nuevo selector en Diario de Productos y Acopio/Movimientos de Almacén. Los selectores locales de almacenes, proyectos y solicitantes mantienen su comportamiento.

## Estrategia de búsqueda y coste

Se mantienen mínimo de tres caracteres, debounce de 300 ms, cachés de 30 segundos, deduplicación de peticiones simultáneas, límite de 20 resultados, aviso de más coincidencias y recuperación individual de artículos guardados.

1. Se comprueba primero la referencia TLM exacta, sin distinguir mayúsculas/minúsculas. Si existe, se devuelven sus artículos directamente: **una consulta limitada**, sin Inventory. Las referencias TLM duplicadas conservan sus números internos distintos.
2. Si no existe una referencia exacta, se consultan en paralelo la referencia parcial, la descripción parcial y el número interno exacto. El código interno exacto se sitúa primero, seguido de los prefijos de referencia y descripción.
3. Se siguen devolviendo como máximo 20 resultados; se pide concretar el texto cuando hay más. El inventario se consulta únicamente para el artículo seleccionado.

La búsqueda textual fría puede hacer **hasta cuatro consultas pequeñas**: una comprobación exacta y tres búsquedas paralelas. Es un cambio explícito frente a las dos consultas anteriores: garantiza la coincidencia exacta y añade el campo `No` omitido, sin descargar el catálogo. Cada colección tiene `$top` y límite local (21 filas, o 2 para el código interno). Se comparte un presupuesto total de 15 segundos entre ambas fases; no se amplían los timeouts. Las repeticiones calientes no consultan BC.

BC no admite OR entre campos diferentes; por eso las búsquedas se separan. Las comparaciones usan `$schemaversion=2.1` y `tolower`. Referencia: [filtros OData de Business Central](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/use-filter-expressions-in-odata-uris).

## Resultados medidos

En la muestra posterior:

| Búsqueda | Tiempo del servicio | Consultas BC |
|---|---:|---:|
| Referencias TLM completas | 135–156 ms | 1 por referencia fría |
| Misma referencia en otra capitalización, con caché | <1 ms, redondeado a 0 | 0 |
| Números internos | 377–694 ms | Hasta 4 pequeñas |
| PVC | 1.249 ms | 4 pequeñas; 20 resultados |
| TUBO | 1.045 ms | 4 pequeñas; 20 resultados |

Todas esas consultas de búsqueda excluyeron Inventory.

Prueba de UI con bundle real de producción y BC real para artículos, simulando endpoints auxiliares: escritorio **1.487 ms** desde escribir PVC hasta presentar la lista fría; móvil **357 ms** para la búsqueda caliente. Incluyen debounce. En ambos casos: cero peticiones de artículos al abrir, 12 opciones en DOM, panel dentro de pantalla, cierre tras seleccionar, reapertura con buscador vacío, conservación de selección al cancelar y devolución del foco al campo.

Son muestras puntuales, no una medición de toda la aplicación desplegada ni una garantía de latencia de BC.

## Archivos y validación

- `frontend/src/components/SelectArticulo.jsx`: desplegable, buscador, teclado, foco, portal y virtualización.
- `frontend/src/components/BuscadorArticulo.jsx`: separa búsqueda y valor seleccionado.
- `frontend/src/pages/Almacen.css`: presentación del selector y panel.
- `backend/services/businessCentral.js`: referencia exacta, búsqueda por número interno y prioridad de resultados.
- Tests de búsqueda backend, selector y página de entradas: regresiones de referencia, descripción, código interno y conservación de selección.

Validación: **138 pruebas backend y 151 frontend aprobadas**, lint sin advertencias y compilación de producción correcta. Pruebas de navegador en escritorio y móvil completadas. No se han desplegado los cambios. Se retiraron los scripts y capturas temporales; se conservan solo las métricas sanitizadas.
