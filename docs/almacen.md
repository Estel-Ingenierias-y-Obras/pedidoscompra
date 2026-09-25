# Material y almacén

`/material` muestra los dos accesos. El catálogo existente pasa a `/material/catalogo`, conservando sus operaciones. `/material/almacen` presenta los tres apartados y `/material/almacen/entradas` implementa el diario. Acceso: Admin y Comprador, validado también en backend.

## Arquitectura y modelos

React → API Express propia → servicio de almacén → adaptador Business Central. MongoDB conserva entradas locales. React nunca recibe credenciales de BC.

- `MovimientoAlmacen`: quince campos, clave de reintento, autor, timestamps, estado de sincronización, `bcSystemId` y `errorSincronizacion`.
- `SecuenciaAlmacen`: contador atómico de documentos.

Las entradas guardadas quedan pendientesBC e inmutables en esta fase. No se envían ni contabilizan en BC ni modifican stock. Estados futuros: enviadoBC, registradoBC y errorBC. El futuro stock deberá consultar existencias contabilizadas en BC, no sumar entradas locales pendientes. Consumos, inventarios y ajustes negativos requieren ampliar validaciones, modelo y adaptador.

## API propia

Todas las rutas requieren autenticación y rol Admin o Comprador.

| Método | Ruta | Resultado |
| --- | --- | --- |
| GET | `/api/almacen/configuracion` | Valores fijos y selectores |
| GET | `/api/almacen/productos` | Productos de BC no bloqueados |
| GET | `/api/almacen/entradas?pagina=1` | Entradas, 50 por página y total |
| POST | `/api/almacen/entradas` | Guarda entrada pendiente |
| GET | `/api/almacen/movimientos` | 501: futura fase |
| GET | `/api/almacen/stock` | 501: futura fase |

El servidor impone ubicación, departamento, estado, descripción consultada en BC y fecha de guardado en Europe/Madrid. Cantidad mayor que cero; importes finitos no negativos. Precio e importe son independientes y editables. La unidad se inicializa desde el producto y puede modificarse; la futura API AL deberá validar unidades del producto y conversiones.

## Numeración

Configurar ALMACEN_ULTIMO_DOCUMENTO antes del primer uso: 27 produce T00028; por defecto empieza en T00001. El ejemplo T00027 no se presupone como último documento real. La configuración solo inicializa el contador.

MongoDB incrementa mediante $inc atómico. Documento y solicitudId tienen índices únicos. Reintentar la misma fila devuelve la entrada existente. Un fallo después de reservar un número puede dejar huecos; no se reutilizan. Verificar los índices antes de desplegar, especialmente si se desactiva autoIndex.

La serie debe ser exclusiva de PedidosCompra. Si se comparte con BC u otras aplicaciones, la futura API AL deberá reservar números transaccionalmente en BC: el contador local no coordina escritores externos.

## Conexión AL pendiente

Configurar las credenciales backend existentes TENANT_ID, CLIENT_ID, CLIENT_SECRET y BC_SCOPE, y las URLs completas con empresa BC_ALMACEN_ITEMS_URL y BC_ALMACEN_LOCATIONS_URL.

Contrato propuesto para la extensión AL:

- Item: `{ "value": [{ "number": "P001", "displayName": "Producto", "baseUnitOfMeasureCode": "UD", "blocked": false }] }`.
- Location: `{ "value": [{ "code": "CENTRAL 3" }] }`.
- Paginación OData @odata.nextLink; el adaptador sigue páginas del mismo origen HTTPS.

Antes de guardar, el backend comprueba producto y existencia de CENTRAL 3. Sin configuración muestra indisponibilidad; no sustituye productos BC por el catálogo local.

La siguiente fase deberá publicar la API AL basada en Item Journal Line y configurar plantilla/sección del diario, enums, dimensiones (tipo de proyecto/departamento), unidades y significado de «Liq por nº orden». Distinguir crear línea de registrar contablemente. Implementar envío idempotente con solicitudId, reconciliación por bcSystemId y reintentos antes de habilitar contabilización y stock. Esta entrega no incluye extensión AL ni conexión verificada contra BC real.

## Componentes y UX

Páginas Material, Almacen y EntradasAlmacen; componente DiarioAlmacen; cliente services/almacen.js. Tarjetas con accesos claros y retorno. Tabla compacta con quince columnas, scroll horizontal, etiquetas accesibles y campos automáticos diferenciados. Producto muestra número y descripción. Guardado y errores por fila; lista persistida debajo con estado. Los apartados futuros se identifican como próximos.

Las filas sin guardar permanecen en memoria. Hay aviso al cerrar/recargar y al usar el enlace de vuelta; guardar antes de navegar por otros enlaces del menú. El documento muestra «Al guardar» hasta reservarse realmente.

## Verificación

Pruebas backend con node --test, frontend con react-scripts test y compilación de producción. Los tests usan dobles de BC y MongoDB; verificar adicionalmente permisos AL, productos paginados, almacén, índices y concurrencia en el entorno real. No se modifica ni migra el catálogo existente.
