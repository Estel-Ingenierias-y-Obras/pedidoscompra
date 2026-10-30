# Auditoría de rendimiento de integraciones — 30/10/2026

## Alcance y evidencia

Revisión estática de las rutas, servicios, modelos, contextos y consumidores React del repositorio, con cambios acotados y pruebas locales. No se ha ejecutado carga contra BC ni MongoDB, ni se han obtenido trazas del navegador en producción. Por tanto, esta revisión no acredita latencias reales, índices desplegados ni tiempos internos de AL. No hay archivos `.al` en el repositorio: la revisión AL se limita a contratos documentados y al cliente que los consume. No se han desplegado cambios.

## 1. APIs analizadas

| Integración | Consumidores y comportamiento observado | Resultado |
|---|---|---|
| Entra ID / OAuth BC | `businessCentral.obtenerToken`, cliente de credenciales; caché existente de 60 s | Ya comparte renovaciones concurrentes; no se modifica |
| Proyectos OData | `/api/proyectos`, `ProjectSelector`, `useProjectCatalog`, movimientos | Caché backend existente de 60 s y frontend de 5 min; abiertos y catálogo completo separados |
| Productos OData | `Ficha_producto_Excel`, productos y artículos de movimientos | Filtros y `$select` ya aplicados; catálogo y referencias cacheados 5 min |
| Recursos y empleados OData | `Recursos`, `Ficha_empleado_Excel`, catálogo y envío de acopios | Dos lecturas paralelas con campos y filtros restringidos; validación actual al enviar conservada |
| BC estándar | `locations`, completo para movimientos y filtrado CENTRAL 3 para entradas | Nueva caché separada por URL y filtro |
| BC personalizada | `valoresDimensionAcopio`, `tiposProyecto` | Nueva caché de departamentos, zonas y tipos |
| BC inventario | `productos`, `unidadesProducto`, `movimientosAplicables`, `diarioProductos` | Stock y movimientos candidatos mantienen lecturas actuales; filtros por producto existentes |
| BC acopios | `acopios`, `lineasAcopio`, `solicitudesAcopio`, acciones de registro | Conservadas comprobaciones de identidad, recibos, recuperación y contabilización |
| BC registro de entradas | `registrosProducto`, creación y registro del diario | Conservadas confirmaciones durables y consultas tras resultados inciertos |
| API propia / Mongo | Pedidos, histórico, materiales, usuarios, accesos, destinatarios, operaciones, registros y envíos | Revisión de filtros, lecturas y modelos; candidatos de mejora pendientes de medición |
| Microsoft Graph | `emailService`, token de aplicación y envío de correo | Se obtiene token para cada envío; oportunidad pendiente de medir e implementar con vencimiento real |
| Autenticación web | `api.js`, MSAL, middleware JWT y claves JWKS | Renovación MSAL ya compartida; JWKS tiene caché de una hora; consulta de autorización al usuario conservada |
| Adjuntos | GridFS y `AttachmentList` | Descarga bajo demanda; no se introduce caché de documentos |

## 2. Llamadas innecesarias y duplicadas

Problema corregido: cada carga de `/api/almacen/movimientos/catalogos` consultaba otra vez almacenes, departamentos, tipos y zonas. El catálogo ya usa `Promise.allSettled`; no había que serializarlo ni reemplazarlo. Ahora estas cuatro lecturas comparten resultados durante 60 segundos en cada proceso backend, también entre solicitudes simultáneas.

El catálogo realiza siete lecturas de colecciones BC en frío, antes de considerar paginación: cuatro auxiliares, productos y dos de recursos/empleados. Con productos ya cacheados, repetirlo dentro de la ventana pasa de seis lecturas a dos: cuatro menos (67 % en este escenario). Frente a una carga fría de siete, una carga caliente realiza dos (71 % menos), pero parte de ese ahorro corresponde a la caché de productos que ya existía. No son porcentajes medidos de tiempo de carga.

Hallazgos conservados para una siguiente fase:

- Los proveedores globales de solicitudes, usuarios y materiales cargan al iniciar sesión aunque la pantalla no utilice todos los datos. `StrictMode` puede repetir efectos en desarrollo; no debe extrapolarse a producción. Carga diferida requiere revisar todos los consumidores y estados de carga.
- Histórico pide archivados mientras el contexto global carga los activos. Son conjuntos distintos, aunque la carga de activos puede resultar prescindible para esa pantalla.
- `NuevaSolicitud` y `ValidarSolicitudes` recargan pedidos tras mutar. Se conserva para mantener sincronización y cambios concurrentes; sustituirlo exige definir el contrato de respuesta y actualización del contexto.
- Cada fila editable del diario consulta unidades y movimientos aplicables al cambiar producto. Los movimientos son dinámicos; una caché duradera podría devolver candidatos obsoletos. Se podría compartir únicamente peticiones simultáneas tras medir cuántas filas repiten producto.
- Entradas carga productos, tipos, operaciones y enviados en paralelo. Enviados combina historial local con diario BC para descartar líneas eliminadas o registradas. Esas llamadas cumplen funciones diferentes.

## 3. Consultas BC optimizadas

`almacenBC.crearCliente` incorpora una caché por instancia para cinco variantes de lectura: almacenes completos, almacén CENTRAL 3, departamentos, zonas y tipos de proyecto. La clave es la URL completa, incluido destino, empresa y filtros. Un cambio de empresa o dimensión produce otra clave.

Se utiliza `crearCacheLecturas`, ya existente: comparte promesa en curso, empieza TTL tras completar la carga, solo conserva colecciones completas y elimina entradas fallidas. No se cachean respuestas parciales ni errores. Se mantienen todas las páginas, tiempos límite y comprobaciones de enlaces.

La primera lectura cuesta lo mismo. Las posteriores ahorran toda la paginación de ese catálogo durante la ventana. La caducidad es perezosa: la siguiente solicitud tras expirar vuelve a BC; no hay precarga periódica. Existe un desfase máximo de 60 s para estos datos auxiliares. Actualizar la pantalla dentro de la ventana puede reutilizarlos. No hay invalidación inmediata desde BC ni caché distribuida entre réplicas.

No se añaden TTL a existencias, diario, acopios, movimientos aplicables, recibos ni validación de solicitantes activos. El catálogo de productos ya incluye `Inventory` y tenía TTL de 5 min: ese comportamiento previo merece revisar su uso informativo; el envío conserva sus validaciones.

## 4. MongoDB

No se han cambiado consultas ni creado índices en esta intervención: falta evidencia de cardinalidad, selectividad y planes de ejecución que justifique el coste de escritura y almacenamiento.

| Colección / consulta | Observación del código | Medición necesaria |
|---|---|---|
| Pedidos / histórico | Activos usa `estado: {$ne: 'Archivar'}` y el histórico igualdad; respuestas completas sin paginación | Volumen y selectividad por estado; `executionStats` antes de añadir índice. `$ne` puede seleccionar casi todo |
| Materiales | Proyección y `lean()` ya existentes; filtra activo y ordena referencia | Probar `{activo:1, referencia:1}` y `{referencia:1}` por separado; índice de referencia normalizada no equivale a orden por referencia |
| Operaciones y registros | Filtro por creador, exclusión de estados y orden descendente; enviados añade destino | Evaluar `{creadoPor:1, createdAt:-1}` y alternativa con destino contra carga representativa |
| Envíos de acopio | Índice único por entorno/empresa/solicitud y compuesto por entorno/empresa/creador/fecha ya declarados | Verificar instalación y plan del listado que también filtra `confirmadoBC` |
| Accesos | Índice único parcial para solicitudes pendientes; listado ordenado por fecha | Comprobar necesidad real de índice de fecha |
| Usuarios | Autorización busca email mediante expresión regular insensible a mayúsculas | Revisar plan; migración a igualdad normalizada necesita comprobar datos históricos |
| Importación | Hasta 5.000 inserciones secuenciales con validación por documento y tratamiento de duplicados | Medir tiempo real antes de sustituir por lotes, preservando validadores y resumen por fila |

No se han encontrado pipelines `aggregate` en rutas/servicios revisados. No hay índices nuevos declarados ni ejecutados contra una base de datos. Se conservan índices únicos que garantizan idempotencia y referencias. Los listados completos de pedidos son un riesgo de crecimiento; paginarlos requiere adaptar filtros, búsquedas y exportaciones del frontend conjuntamente.

## 5. Componentes React y buscadores

`RequestItems.MaterialAutocomplete`: por cada referencia se recorría otra vez todo el catálogo para buscar coincidencias en descripción (`filter` con `some` anidado). Una búsqueda sin resultados podía hacer N² comparaciones. Se construye un mapa memoizado de descripciones por referencia; el filtrado pasa a ser lineal en el tamaño del catálogo, conservando orden, ocho resultados y semántica de referencias duplicadas. Cambiar cantidad u observaciones ya no reconstruye ese mapa si el catálogo conserva su identidad. La selección y validación no cambian.

`EnviadosAlmacen`: el cruce de operaciones con líneas del diario usaba `find` para cada operación. Ahora indexa líneas por GUID y hace búsquedas directas. El cruce pasa de O(operaciones × líneas) a O(operaciones + líneas). Se mantiene comparación sin distinción de mayúsculas y primera coincidencia.

Proyectos, materiales, almacenes y solicitantes utilizan filtrado local; no hacen llamadas por pulsación. No se añade debounce de red a búsquedas que no usan red. `BuscadorMovimiento` ya memoiza normalización y virtualiza opciones. `ProjectSelector` limita resultados a 50. Las tablas de stock y pedidos siguen filtrando datos cargados; no se ha cambiado su comportamiento responsive.

Los valores de los contextos podrían memoizarse, pero no se atribuye una mejora sin perfil de React. El service worker excluye `/api/` y solo atiende navegaciones: se conserva para evitar introducir datos personales o inventario obsoleto en caché persistente.

## 6. Medición y tiempos

Microbenchmark reproducible: `node tools/benchmark-autocompletado.cjs`. Extrae el bloque real anterior desde `git HEAD` y el actual del archivo local, comprueba igualdad de sugerencias y mide cinco muestras después de calentamiento. Tras confirmar los cambios en Git, la referencia HEAD dejará de representar la versión anterior.

Resultado local de esta sesión: 3.000 materiales, búsqueda sin coincidencias, mediana **59,75 ms antes / 2,05 ms después** (aproximadamente 29 veces más rápido). Incluye construir el mapa en cada muestra, sin aprovechar reutilización de `useMemo`. Es una medición sintética del cálculo; no representa tiempo total de pantalla, red, dispositivo móvil ni percentiles de usuarios reales.

Para catálogos BC, el ahorro cuantificable es el número de lecturas descrito arriba. Como esas peticiones se ejecutan en paralelo, quitar cuatro no equivale a sumar cuatro latencias: la mejora de pantalla depende de cuál sea la rama más lenta. No se estiman milisegundos de BC, Mongo ni del cruce de enviados sin medición.

## 7. Validación

La ejecución completa de `npm test` tras los primeros cambios pasó: **127 pruebas backend y 139 frontend**, 25 suites frontend. Tras los últimos cambios pasaron las seis pruebas de catálogos y las diez de enviados; se repitió lint sin advertencias y `git diff --check` sin errores de espacios. No se ejecutaron pruebas contra servicios reales.

Nuevas pruebas de caché comprueban concurrencia, colecciones paginadas completas, separación por empresa, reintento tras fallo de página y que stock sigue consultándose en cada lectura. Las pruebas existentes cubren separación de filtros de almacenes, permisos, idempotencia, registros inciertos y selección de materiales.

## 8. Archivos de esta intervención

- `backend/services/almacenBC.js`: caché de catálogos auxiliares.
- `backend/tests/movimientosCatalogos.test.js`: regresiones de caché.
- `frontend/src/components/RequestItems.jsx`: índice memoizado del autocompletado.
- `frontend/src/pages/EnviadosAlmacen.jsx`: cruce por mapa de GUID.
- `tools/benchmark-autocompletado.cjs`: microbenchmark reproducible.
- `docs/auditoria/RENDIMIENTO-2026-10-30.md`: este informe.

Durante la revisión apareció también `backend/scripts/auditar-rendimiento.js` como archivo ajeno sin seguimiento. No se ha modificado ni ejecutado, ni se atribuye a esta intervención.

## 9. Próxima medición recomendada

1. Registrar p50/p95, tamaño de respuesta y número de llamadas de cada pantalla con sesión caliente y fría; contar páginas OData y separar token, red y transformación.
2. Obtener `explain('executionStats')` de las consultas anteriores con datos representativos y comprobar índices instalados. Elegir índices solo si reducen documentos examinados o eliminan ordenaciones costosas.
3. Medir costes de Graph y gestionar su token según `expires_in`, compartiendo renovaciones concurrentes; no cachear el envío de correos.
4. Perfilar cargas globales de contextos y volumen de pedidos antes de introducir carga diferida o paginación.
5. Auditar código AL y telemetría BC: filtros sobre claves, FlowFields, cálculos de inventario y coste de serialización. No puede inferirse ese coste del contrato HTTP.
6. Evaluar una política explícita de refresco forzado de catálogos y caché distribuida solo si el desfase de 60 s o el número de réplicas lo requieren.

La auditoría operativa queda pendiente de estas mediciones; los cambios locales se limitan a trabajo repetido demostrado por el código y comprobado mediante pruebas.
