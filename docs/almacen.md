# Integración del diario de almacén

Contrato de creación AL suministrado: [README-API.md](README-API.md). Enviar una línea la deja pendiente en el diario de BC; su confirmación y registro se realizan exclusivamente desde Business Central en el flujo actual de la web.

`/material/almacen/entradas` muestra únicamente borradores y envíos cuya recepción sigue sin confirmar. La columna **Acciones** ofrece **Enviar a BC** y **Eliminar** para borradores nunca enviados. Un envío incierto conserva su identidad y solo admite el reintento existente; no se permite eliminarlo porque puede haber llegado a BC. Las validaciones y el POST de creación permanecen iguales.

El botón **Enviados a BC** abre `/material/almacen/enviados`: vista de solo lectura de los envíos propios que siguen presentes en el diario de BC. Al cargar o actualizar, la pantalla cruza `GET /api/almacen/enviados` con la colección completa y paginada de `GET /api/almacen/entradas`, comparando los identificadores de BC. Las líneas eliminadas o retiradas del diario al registrarlas dejan de mostrarse. Si falla cualquiera de las consultas, se conservan las filas mostradas y se informa del error. La API de enviados conserva las respuestas e identificadores originales en OperacionAlmacen para evitar duplicados y permitir que la pantalla de entradas reconcilie respuestas perdidas; no se eliminan esos datos técnicos ni se contabiliza en BC.

Se han retirado el botón Registrar, su confirmación y sus llamadas del frontend. Las rutas de registro anteriores (`POST /api/almacen/entradas/:id/registrar`, `GET /api/almacen/registros-pendientes`) y sus datos se conservan por compatibilidad, sin uso desde estas pantallas. No se borran solicitudes de registro antiguas ni se reintentan automáticamente.

Error real diagnosticado: la identidad OAuth carece de inserción indirecta en TableData 60702 GM Entry Request. Asignar GM ENTRADAS API a esa aplicación Entra para la empresa. GM REGISTRAR API corresponde únicamente a la operación de registro heredada, que ya no se utiliza desde estas pantallas. El backend conserva ahora el detalle de errores 403 sin exponer credenciales.

## Configuración

Configurar exclusivamente en backend:

| Variable | Uso |
| --- | --- |
| TENANT_ID | Tenant de la identidad BC y de la URL del servicio |
| CLIENT_ID, CLIENT_SECRET | Identidad confidencial existente |
| BC_SCOPE | Scope OAuth existente para BC |
| BC_ENVIRONMENT | Nombre exacto del entorno |
| BC_COMPANY_ID | UUID de empresa |
| BC_COMPANY_NAME | Nombre interno exacto de la misma empresa para proyectos OData |
| BC_LOG_REQUESTS | `true` activa logs de destino sin tokens, cuerpos ni filtros; `false` los desactiva |
| MONGO_URI | Persistencia durable de las operaciones antes de llamar a BC |

El cliente construye las raíces `https://api.businesscentral.dynamics.com/v2.0/{tenant}/{entorno}/api/Estel/GestionMaterial/v1.0/companies({companyId})` y su equivalente estándar `/api/v2.0/companies({companyId})`.

La configuración común está en `backend/services/bcConfig.js`. `BC_ENVIRONMENT` controla proyectos OData, APIs estándar y APIs personalizadas. Se admiten `BC_TENANT_ID`, `BC_CLIENT_ID` y `BC_CLIENT_SECRET` con prioridad sobre los nombres anteriores sin prefijo. Las variables ENTRA_* de acceso a la web y GRAPH_* de correo son independientes y no se cambian.

`BC_API_URL` deja de utilizarse: proyectos construye `BASE/ODataV4/Company('{BC_COMPANY_NAME}')/API_Proyectos`, a partir del servicio real facilitado por el usuario. Tampoco se usan BC_ALMACEN_ITEMS_URL, BC_ALMACEN_LOCATIONS_URL ni ALMACEN_ULTIMO_DOCUMENTO. La serie DIAP-GEN se gestiona solo en AL.

### Paso a Producción (28/09/2026)

Configuración local verificada mediante consulta de empresas en Production:

```dotenv
BC_ENVIRONMENT=Production
BC_COMPANY_ID=e2747643-9342-ed11-946f-000d3aa816c0
BC_COMPANY_NAME="ESTEL INGENIERIA Y OBRAS"
BC_LOG_REQUESTS=true
```

`node backend/scripts/verificar-bc.js` consulta exclusivamente GET con `$top=1`. Proyectos, items y locations devuelven HTTP 200. diarioProductos, tiposProyecto, unidadesProducto, movimientosAplicables y registrosProducto devuelven HTTP 404. La conexión ya apunta a Production, pero esas APIs no están disponibles en las rutas esperadas: comprobar/publicar la extensión en Production y sus permisos antes de utilizar entradas. No se han probado escrituras ni registrado existencias.

En Render, configurar las cuatro variables anteriores y desplegar el código actualizado. Las credenciales existentes siguen siendo válidas; no se han cambiado variables remotas desde este workspace. `render.yaml` declara los nuevos ajustes, pero no modifica por sí solo un servicio ya desplegado. Reiniciar el backend local para cargar `.env`. Desactivar `BC_LOG_REQUESTS` tras el diagnóstico.

Para volver al sandbox, ejecutar `node backend/scripts/configurar-empresa-almacen.js Production-Estel-IT "ESTEL Ingeniería y Obras SA"` y reiniciar el backend. El script verifica la empresa por GET antes de guardar entorno, UUID y nombre interno. En Render, actualizar las mismas variables al destino verificado y redesplegar. Las operaciones pendientes mantienen su destino original: no se deben reenviar a otro entorno ni borrar sus claves para eludir ese control.

## Backend

- `services/almacenBC.js`: URLs, filtros OData escapados, lectura de todas las páginas, validación del origen/empresa de nextLink, límites de tiempo, errores saneados y hasta tres intentos para fallos transitorios. No sigue redirecciones con credenciales. Reintenta con espera progresiva respetando Retry-After; si la espera supera cinco segundos, devuelve la operación pendiente con fecha mínima de reintento, sin mantener una petición larga.
- `services/almacen.js`: lista explícita de campos de entrada, control de usuario/cuerpo, persistencia previa y coordinación de envíos. No asigna documentos, fechas, dimensiones ni costes.
- `models/OperacionAlmacen.js`: identidad web, UUID BC generado en Node, destino (sin secretos), cuerpo inmutable, huella, autor, estado, bloqueo temporal, próxima fecha de intento y respuesta BC completa, incluido id y numdoc.
- `routes/almacen.js`: autenticación existente; Admin y Comprador. No expone secretos ni objetos de error Axios.

### Rutas propias

| Método | Ruta /api/almacen | Uso |
| --- | --- | --- |
| GET | /configuracion | Información fija del módulo |
| GET | /productos | items estándar filtrados por inventario y no bloqueados |
| GET | /almacenes | locations estándar para CENTRAL 3 |
| GET | /tipos-proyecto | tiposProyecto de la API AL |
| GET | /unidades-producto?numprod=… | unidadesProducto con igualdad para un producto |
| GET | /movimientos-aplicables?numprod=… | movimientosAplicables del producto |
| GET | /entradas | Todas las líneas actuales de integración en BC |
| GET | /entradas/:id | Lectura BC por SystemId |
| POST | /entradas | Crear/reintentar una operación lógica |
| GET | /operaciones | Operaciones propias pendientes o bloqueadas, recuperables tras recarga |
| GET | /enviados | Historial propio de respuestas confirmadas en el destino actual, conservado aunque la línea salga de BC |
| GET | /movimientos y /stock | 501, fases futuras |

El POST web contiene `solicitudId` (UUID estable del borrador) y los campos AL editables. Node sustituye esa identidad web por su `claveintegracion` persistida al llamar a BC. Omitir y enviar cero son solicitudes distintas. No se admiten campos fijos ni más de uno entre preciounitario, importe y costeunitario.

Respuesta web: `{ solicitudId, estado, cuerpo, claveintegracion, respuesta, error, codigoError, proximoIntento }`. `respuesta` contiene los valores de BC. HTTP 201 = creada; 202 = preparada/procesando/incierta; 422 = rechazada; 409 = bloqueada o conflicto de operación.

### Idempotencia y recuperación

1. El navegador conserva el UUID web y el cuerpo enviado antes del POST. Node persiste UUID BC y cuerpo antes de contactar con BC. El índice único de `_id` evita dos operaciones para el mismo identificador web.
2. La huella usa una representación de orden estable, conservando omisiones y ceros. Otro cuerpo o usuario con el mismo identificador se rechaza. No se reenvía una operación a otro entorno/empresa si cambia la configuración.
3. Una actualización atómica reclama la operación durante 180 segundos. Las llamadas concurrentes reciben el estado actual. El token del bloqueo evita que una respuesta tardía sobrescriba un intento posterior. Tras caída del proceso, la misma solicitud puede reclamar el bloqueo caducado.
4. Un timeout o fallo al persistir la confirmación deja una operación recuperable. Repetir el POST original utiliza el mismo UUID/cuerpo; la idempotencia AL protege incluso si dos peticiones llegan a BC por expiración del bloqueo.
5. Errores de validación/autorización no se reintentan automáticamente. Una solicitud rechazada permite corregir explícitamente en un nuevo borrador. Si ya había incertidumbre, se conserva hasta resolverla. GM_KEY_CONFLICT y GM_ENTRY_GONE bloquean la operación: nunca se crea una sustituta automática.
6. Repetir explícitamente una operación confirmada vuelve a consultar mediante el POST original, para recibir la línea actual o GM_ENTRY_GONE. El historial conserva la respuesta confirmada del envío y no pretende representar el estado contable actual en BC.

No eliminar operaciones como si fueran caché. Mantener copias de seguridad y los índices de MongoDB. No se migran ni envían automáticamente los antiguos documentos locales de MovimientoAlmacen. Los modelos MovimientoAlmacen/SecuenciaAlmacen quedan como referencia histórica; las nuevas rutas no los utilizan ni borran sus colecciones.

## React

`EntradasAlmacen` coordina catálogos, recuperación y confirmaciones. `DiarioAlmacen` conserva el formato de tabla y sus quince columnas, más el modo monetario. `services/almacenPayload.js` construye exclusivamente los campos permitidos.

- Producto: número y descripción. Cambiarlo limpia unidad y movimiento. Las respuestas de un producto anterior se descartan.
- Unidad: opción «Inicializa BC» (se omite del POST) o unidad del catálogo del producto.
- Proyecto: nombres reales del catálogo y código al enviar; INDIRECTO predeterminado. Si queda bloqueado/no disponible, exige otro valor disponible.
- Movimiento: opcional, muestra número, documento, fecha y pendiente en unidad base. Comprueba la cantidad base cuando dispone del factor; la validación definitiva es de BC.
- Moneda: usar BC o introducir uno de los tres campos monetarios. El descuento es solo lectura. No se infiere el método de coste del producto; el error de coste estándar de AL se muestra al usuario.
- Fecha, documento, almacén, tipo y departamento informativos antes del alta. La lista posterior muestra los valores reales devueltos, incluidos cantidad base, factor y conjunto de dimensiones. El literal tipomovimiento de respuesta no se interpreta ni se envía.
- Doble envío bloqueado. Borradores conservados por usuario en localStorage. El cuerpo de una solicitud enviada queda congelado mientras se desconozca el resultado. Si falla el almacenamiento, no se inicia un envío nuevo. Los envíos pendientes del servidor también se recuperan mediante /operaciones, aunque falle otro catálogo.
- No hay edición ni eliminación de líneas creadas en BC. «Eliminar» solo afecta a borradores todavía no enviados.

## Verificación y límites

Pruebas automatizadas locales con dobles de HTTP y persistencia: cuerpos monetarios, campos fijos, catálogos y respuestas tardías, doble envío, recarga, timeouts/reintentos, conflictos, línea desaparecida, paginación, permisos y conservación de la respuesta final. Compilación de producción React.

Pendiente con la configuración real: publicar la extensión y verificar permisos de la identidad de integración; contrastar los catálogos y metadatos del sandbox; crear una entrada de prueba y comprobar su documento/valores; reintentar sin duplicar; verificar que las existencias no cambian. También quedan pendientes pruebas de concurrencia sobre MongoDB y BC reales. Ninguna prueba local hace POST a BC ni conecta con producción.

Comprobación real de solo lectura tras publicar la extensión: 21.202 productos, CENTRAL 3 encontrado, tres tipos de proyecto (DIRECTO → Obra, INDIRECTO → Estructura, GRUPO → Grupo), ninguno bloqueado. El diario responde correctamente y está vacío. Para un producto del catálogo, unidadesProducto devuelve una unidad y movimientosAplicables una lista vacía válida. Se utilizó el cliente backend, incluida su paginación. No se ejecutaron pruebas reales de POST ni se modificaron datos de BC; creación, recálculos e idempotencia reales siguen pendientes de verificar.
