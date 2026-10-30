# Búsqueda desde tres caracteres, conservando el campo actual

El usuario solicita volver a evitar la carga completa, iniciando la búsqueda con las tres primeras letras o cifras. Se conserva el aspecto y la interacción de `BuscadorMovimiento`: se escribe directamente en el campo y se selecciona con clic, flechas, Enter o Tab. No se reintroduce el selector separado ni el botón «Reintentar búsqueda».

## Flujo vigente

- Abrir el campo o escribir menos de tres caracteres no consulta artículos.
- A partir del tercero se espera una pausa de 300 ms y se consulta únicamente el texto actual. Los cambios posteriores limpian el temporizador y las respuestas antiguas se ignoran.
- Referencia TLM y código interno se buscan por prefijo; descripción, por contenido. También se consulta la referencia exacta para que no se pierda entre coincidencias parciales, sin ocultar las demás coincidencias del prefijo.
- Se devuelven como máximo veinte artículos. Si hay más, el desplegable pide escribir más caracteres. Tres caracteres inician la búsqueda: no garantizan que una referencia concreta esté entre los primeros veinte si el prefijo es muy común.
- Caché de treinta segundos en frontend y backend; las consultas iguales simultáneas se comparten. El inventario se consulta únicamente para artículos seleccionados y no se cachea con TTL.
- Diario ya no descarga productos en su carga inicial. Acopio pide sus catálogos auxiliares con `sinArticulos=1`, sin el catálogo de productos.
- Los artículos guardados se recuperan por su número interno. Se conservan cantidades, identidad de borradores, validación y gestión de resultados inciertos.

## Endpoints y el 404 anterior

La búsqueda utiliza el endpoint original **`GET /api/almacen/productos?buscar=201`**. El detalle utiliza `?numprod=...`. Las peticiones sin esos parámetros conservan el contrato anterior para clientes compatibles, pero los dos diarios actuales no las hacen.

El frontend comprueba primero `/api/almacen/configuracion`, que anuncia `busquedaProductos: true`. Si el backend no se ha actualizado, se muestra un mensaje explícito y **no se envía una consulta que ese backend pueda ignorar y convertir en una descarga completa**. Esa comprobación también se comparte y cachea durante un minuto; los fallos no se cachean. Deben actualizarse frontend y backend juntos.

El endpoint `/api/almacen/articulos` introducido en una iteración anterior no se usa en este flujo. No se añadieron endpoints nuevos. Los errores se distinguen de una lista sin coincidencias; no hay reintentos automáticos ni aumento de timeouts. El presupuesto BC sigue siendo de quince segundos y las cuatro consultas pequeñas se ejecutan en paralelo.

## Comprobación real con BC

Evidencia sanitizada: `busqueda-tres-caracteres-2026-10-30.json`. No se descargó el catálogo completo ni se solicitó Inventory en las búsquedas.

| Texto | Tiempo de servicio | Resultados | Observación |
|---|---:|---:|---|
| `20` | 1 ms | 0 | Cero consultas BC |
| `201` | 2.218 ms | 20 | Hay más coincidencias; 20193978 no estaba entre las primeras veinte |
| `2019` | 439 ms | 20 | Incluye 20193978; permite concretar más |
| `20193978` | 303 ms | 1 | Coincidencia exacta encontrada |
| `20193978`, repetido | <1 ms, redondeado a 0 | 1 | Cero consultas BC, usa caché |
| `PVC` | 359 ms | 20 | Coincidencias con aviso para concretar |

Son muestras del servicio desde este entorno, no tiempos de toda la pantalla desplegada. El debounce añade 300 ms desde la última tecla. La primera búsqueda fría también puede incluir la obtención de token. Se mantiene un límite de 21 filas por consulta BC y 20 en la respuesta final; no se siguen páginas más allá del límite necesario.

La sintaxis OData y la separación entre campos siguen la [documentación de filtros de Business Central](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/webservices/use-filter-expressions-in-odata-uris).

## Archivos y comprobaciones

- `backend/routes/almacen.js`: búsqueda en la ruta original, anuncio de capacidad y omisión opcional de artículos en catálogos.
- `backend/services/businessCentral.js`: búsqueda por prefijo y consultas limitadas en paralelo.
- `frontend/src/services/almacen.js`: verificación de backend, caché acotada por sesión, búsqueda, detalle y auxiliares sin artículos.
- `frontend/src/components/SelectorProducto.jsx`: debounce, estados, respuestas obsoletas y recuperación de artículos guardados.
- `BuscadorMovimiento`, `DiarioAlmacen`, `LineasMovimiento` y ambas páginas: conservan el campo actual y utilizan el flujo acotado.

Validación final: **141 pruebas backend y 150 frontend aprobadas**, lint sin advertencias y compilación de producción correcta. Se incluyen pruebas de dos/tres caracteres, ráfagas de teclas, 20193978, respuesta antigua, caché compartida, backend antiguo y ausencia de catálogo completo en los dos diarios. Se retiró el instrumento temporal de medición. Cambios locales, sin desplegar.

## Incidencia posterior: el aviso persistía tras reiniciar

Se comprobó el frontend real servido en `http://localhost:3000`: su JavaScript contiene la búsqueda nueva y apunta por defecto a `http://localhost:5000`, sin otra URL de API configurada.

El puerto 5000 estaba ocupado por un proceso antiguo de este proyecto arrancado con un preload de diagnóstico `.tmp-debug/comprobar-filtro.cjs`. Ese archivo ya no existía, pero Node conservaba los módulos cargados antes de los cambios. Reiniciar otros procesos no sustituía al que atendía realmente ese puerto.

Se verificó la identidad y el puerto del proceso antes de detenerlo, y se arrancó `backend/server.js` directamente desde el directorio `backend`, sin el preload. El nuevo proceso atiende el puerto 5000; `/healthz` devuelve 200 y `status: ok`, y el registro confirma `application.ready` y `database.connected`. La configuración continúa requiriendo autenticación: una petición sin token devuelve 401. No se ha eliminado ni falseado la comprobación de compatibilidad. Para quitar el error que permanece en el estado de la pantalla basta recargar la página después de sustituir ese proceso.
