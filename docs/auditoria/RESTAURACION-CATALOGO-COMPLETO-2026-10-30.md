# Restauración del desplegable completo y referencia 20193978

> Nota posterior: el usuario ha solicitado búsqueda desde tres caracteres para evitar la carga completa. Este documento conserva la evidencia de la restauración anterior. El comportamiento vigente se describe en `BUSQUEDA-TRES-CARACTERES-2026-10-30.md`.

El usuario aclaró que necesita el desplegable original con todos los artículos. Se ha revertido el cambio a búsqueda remota en Diario de Productos y Acopio/Movimientos.

## Comportamiento vigente

- Los componentes y la carga inicial vuelven al código de la versión estable: Diario usa `/api/almacen/productos`; Acopio recibe sus artículos en `/api/almacen/movimientos/catalogos`.
- Se cargan **todos** los artículos elegibles y se filtran localmente por referencia o descripción, sin peticiones HTTP al escribir, mínimo de caracteres ni límite de veinte resultados.
- Se muestra la lista completa al abrir. La virtualización conserva solo doce opciones simultáneas en DOM, pero permite recorrer todos los resultados.
- Se han retirado `BuscadorArticulo`, sus servicios frontend y el botón «Reintentar búsqueda».
- La selección sigue guardando el número interno, aunque se muestre la referencia TLM. Se conservan los controles de envío, validación y recuperación de operaciones.

## Referencia comprobada y error de la captura

La carga real desde BC devolvió **11.260 artículos**. Entre ellos aparece una coincidencia exacta de la referencia **20193978**, cuyo código comienza por **ARTEL00204**, como en la captura. También se verificó la consulta individual de su inventario.

La cadena «Recurso no encontrado» coincide con la respuesta 404 de la ruta genérica de `backend/server.js`. Indica un error de ruta HTTP de la aplicación, no una búsqueda sin coincidencias. El frontend anterior utilizaba un endpoint nuevo, `/api/almacen/articulos`; el selector restaurado usa los endpoints originales. No se ha inspeccionado la versión del servidor remoto que atendió la captura ni desplegado cambios en él.

## Coste y caché

Se mantiene la caché backend de cinco minutos y la deduplicación de cargas simultáneas. La consulta inicial selecciona referencia, descripción, unidad y campos de elegibilidad; **no calcula Inventory para los 11.260 artículos**. En Acopio, el inventario se consulta por código cuando se selecciona un artículo, reutilizando `/api/almacen/productos?numprod=...`; sus lecturas simultáneas se comparten y no se conservan con TTL.

Medición real de esta sesión: catálogo completo en **33.848 ms**, tres páginas de 5.000, 5.000 y 1.260 filas; repetición desde caché **<1 ms** y cero peticiones BC. Se conserva la evidencia en `catalogo-completo-20193978-2026-10-30.json`. La carga fría continúa siendo costosa; no se presenta como equivalente a la búsqueda acotada anterior ni se han ampliado timeouts.

## Verificación

- Regresión con 11.260 opciones y la referencia 20193978 situada al final: se encuentra y selecciona sin límite de veinte.
- Regresión en Diario: carga el catálogo una vez, filtra la referencia y persiste su número interno, sin búsqueda remota ni envío automático.
- Regresión en Acopio: actualiza inventario individual sin perder el resto del catálogo; escribir no genera peticiones.
- Ejecución completa: 139 pruebas backend y 142 frontend aprobadas. Tras añadir la regresión de Acopio y ajustar la espera asíncrona del test de Diario, se verificaron de nuevo ambas páginas: 21 pruebas aprobadas sin avisos de React.
- Lint sin advertencias y compilación de producción correcta.

Los cambios están en el proyecto. El frontend y el backend en ejecución deben actualizarse para usar esta versión.
