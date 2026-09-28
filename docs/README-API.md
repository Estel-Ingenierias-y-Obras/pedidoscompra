# Entradas de materiales

La aplicación crea una **línea pendiente en el diario de productos**. No ejecuta Registrar,
no crea movimientos de producto ni asientos contables y no aumenta las existencias.
Un usuario autorizado podrá revisar y registrar después desde BC, con sus validaciones.

## Configuración confirmada contigo

| Dato | Valor |
|---|---|
| Plantilla / sección | ELEMENTO / GENERICO |
| Serie de documentos | DIAP-GEN |
| Almacén | CENTRAL 3 |
| Dimensión global y acceso directo 1 | TIPO PROYECTO |
| Valores código → nombre | DIRECTO → Obra; INDIRECTO → Estructura; GRUPO → Grupo |
| Valor predeterminado de proyecto | INDIRECTO |
| Dimensión global y acceso directo 2 | DEPART |
| Valor fijo de departamento | SG-ALMACEN → alm |
| IDs de objetos | 60700–60707; dentro de 60700–60749 |

No se crean ni modifican estos datos de configuración. Si no coinciden, el POST falla.
El rango no presenta conflictos locales; falta comprobar otras extensiones instaladas.
La versión de la extensión pasa a 1.0.1.20260925 conservando su app ID.

## Objetos

| Archivo / objeto | Función |
|---|---|
| DiarioProductos.api.al — página 60700 | GET y POST de líneas propias. Conserva los nombres actuales. Clave OData SystemId e id de solo lectura. PATCH y DELETE deshabilitados. |
| GMIntegration.TableExt.al — extensión 60701 | Marca las líneas con un UUID de integración. Las líneas previas no se migran ni se muestran. |
| GMRequest.Table.al — tabla 60702 | Guarda permanentemente clave, solicitud normalizada, SystemId y documento. Evita recrear entradas incluso después de eliminar o registrar la línea. |
| GMEntryManagement.Codeunit.al — codeunit 60703 | Reglas, validaciones, bloqueo, numeración e inserción transaccional. |
| GMItemUnits.Api.al — página 60704 | Unidades y conversiones del producto seleccionado. Solo lectura. |
| GMProjectTypes.Api.al — página 60705 | Valores permitidos y no bloqueados de TIPO PROYECTO. Solo lectura. |
| GMEligibleEntries.Api.al — página 60706 | Movimientos candidatos para liquidación. Solo lectura. |
| GMEntries.PermissionSet.al — conjunto 60707 | Permisos de integración; escritura del diario indirecta a través del código. |

## Campos y contrato

| Campo API | Campo BC | Comportamiento |
|---|---|---|
| id | SystemId | UUID de la línea, solo lectura; clave para GET individual. |
| claveintegracion | GM Integration Key | UUID obligatorio generado UNA vez por entrada en el backend. Reutilizarlo con el mismo cuerpo en reintentos. |
| fecharegistro | Posting Date | Today() al crear, no WorkDate(). Solo lectura. Revisar la zona horaria de la sesión de integración al probar cambios de día. |
| tipomovimiento | Entry Type | Positive Adjmt. asignado en AL. Solo lectura en esta fase. |
| numdoc | Document No. | Asignado con No. Series.GetNextNo y la fecha de la línea. Solo lectura. |
| numprod | Item No. | Obligatorio; producto existente, no bloqueado y de tipo inventario. Validate estándar. |
| descripcion | Description | Descripción del producto, solo lectura. |
| codalmacen | Location Code | CENTRAL 3 existente y no de tránsito; solo lectura. |
| cantidad | Quantity | Obligatoria y positiva; también debe resultar positiva en unidad base. |
| codudmedida | Unit of Measure Code | Opcional; si se omite, unidad inicializada por BC a partir del producto. En BC estándar, base para ajuste positivo. Si se envía, debe pertenecer al producto. |
| preciounitario | Unit Amount | Una posible entrada monetaria; BC calcula importe y coste. |
| importe | Amount | Otra posible entrada monetaria; BC calcula precio y coste. |
| importedto | Discount Amount | Solo lectura, cero para estas entradas; BC lo define como no editable. |
| costeunitario | Unit Cost | Tercera posible entrada monetaria; se obtiene precio directo y BC recalcula el resultado. |
| liqpornumorden | Applies-to Entry | Entero, 0 por defecto. Número de movimiento de producto, no de pedido. |
| tipoproyectocodigo | Shortcut Dimension 1 Code | DIRECTO, INDIRECTO o GRUPO; por defecto INDIRECTO. No enviar Obra o Estructura. |
| departamento | Shortcut Dimension 2 Code | SG-ALMACEN fijo, solo lectura. |
| cantidadbase | Quantity (Base) | Resultado calculado, solo lectura. |
| factorunidad | Qty. per Unit of Measure | Conversión aplicada por BC, solo lectura. |
| conjuntodimensiones | Dimension Set ID | Conjunto calculado por las funciones estándar, solo lectura. |

Omitir los campos de solo lectura en POST. No enviar de vuelta la respuesta completa.
Los nombres anteriores se conservan; se añaden id, claveintegracion, departamento y
los tres resultados auxiliares. El cambio de clave OData a SystemId cambia la URL
de lectura individual respecto de cualquier consumidor antiguo.

Los campos editables se reciben en variables y después se validan en un orden fijo.
Así, cambiar el orden de las propiedades JSON no cambia los cálculos. Esos campos
variables (incluida claveintegracion) no sirven para filtros/ordenación OData de líneas.
Usar id para recuperar una línea; para recuperar un POST cuya respuesta se perdió,
repetir exactamente la solicitud con la misma clave. Los campos de los catálogos sí
están vinculados a tablas y permiten los filtros indicados abajo.

### Precio, importe, coste y descuento

Enviar **como máximo uno** de preciounitario, importe o costeunitario. Si no se
envía ninguno, se conservan los valores calculados por BC a partir del producto.
Enviar cero expresamente significa precio/coste/importe cero; omitir significa usar BC.
Enviar dos o tres produce error, aunque parezcan coincidir.

Comportamiento comprobado en el código fuente de la tabla 83 de los símbolos
Microsoft Base Application 27.5.46862.54684:

- Unit Amount valida Amount y Unit Cost. El importe es cantidad × precio con
  redondeo estándar. El coste puede incluir porcentaje de coste indirecto y coste adicional.
- Amount divide por Quantity, valida Unit Amount y redondea. No hay cuatro cantidades
  monetarias independientes; el importe y precio finales pueden reflejar redondeos.
- Para ajuste positivo, el coste deriva del precio directo mediante:
  round(precio × (1 + indirecto/100), precisión BC) + coste adicional × factor unidad.
- La conversión inversa de Unit Cost en la tabla estándar depende de CurrFieldNo
  (edición de pantalla). En AL de servidor no se debe asumir ese contexto.
  Esta API aplica la misma fórmula inversa y después Validate(Unit Amount).
  El coste final puede diferir por redondeo del introducido: la respuesta es la autoridad.
- Los productos de coste estándar no aceptan entradas monetarias explícitas
  en esta API. BC determina los valores. Esta restricción se comprueba expresamente
  porque parte de las protecciones de pantalla estándar depende de CurrFieldNo.
- Discount Amount está definido como Editable = false y no se resta en
  UpdateAmount de la tabla 83. Se conserva el nombre importedto pero se hace de
  solo lectura; convertirlo en un descuento comercial requiere un diseño distinto.

Orden: fecha → ajuste positivo → producto → almacén → unidad → cantidad →
movimiento aplicado → dimensiones → entrada monetaria → número de documento →
comprobación de restricciones → Insert(true).

Las dimensiones se aplican DESPUÉS del producto y almacén porque estos pueden
recrear el conjunto. Se usan Validate de las dimensiones de acceso directo y se
comprueban bloqueos, tipo Estándar, combinaciones y reglas de dimensiones
predeterminadas de producto y almacén. No se asigna manualmente un Dimension Set ID.
Otras dimensiones predeterminadas del producto/almacén se conservan.

### Movimientos aplicables

El lookup estándar de Applies-to Entry para una cantidad positiva y ajuste positivo
busca movimientos del mismo producto, negativos y abiertos, y filtra por almacén
si está informado. Por tanto, sí tiene sentido un selector de salidas pendientes.

Esta fase limita además a CENTRAL 3, variante vacía, sin lote, serie ni paquete y
cantidad pendiente negativa. El POST verifica esas condiciones, exige que la
cantidad base no supere la pendiente y ejecuta Validate(Applies-to Entry).
La comprobación de producto/almacén es explícita: la validación estándar por sí
sola no reproduce todos los filtros del lookup y puede cambiar almacén y variante.

No confundirlo con Applies-from Entry, utilizado en otros escenarios de devolución
de coste. Esta API no lo añade. La selección no reserva el movimiento: otras líneas
pendientes pueden seleccionarlo y deberá volver a comprobarse al registrar.
El catálogo ofrece candidatos; la cantidad concreta, dimensiones y demás reglas
se comprueban al crear. No es una promesa de que cualquier combinación sea válida.

## Endpoints para Node.js

Usar autenticación OAuth en el backend. No guardar secretos en React ni en este repositorio.
Sustituir los identificadores entre llaves por los valores reales; aquí no se inventan.

```text
BASE = https://api.businesscentral.dynamics.com/v2.0/{tenant}/{entorno}
CUSTOM = BASE/api/Estel/GestionMaterial/v1.0
STANDARD = BASE/api/v2.0
COMPANY = companies({companyId})
```

El launch.json declara environmentType Sandbox y environmentName Production-Estel-IT.
Verificar en la administración que ese nombre corresponde al sandbox deseado.
El nombre de entorno por sí solo no indica si es producción o sandbox.

| Operación | URL relativa |
|---|---|
| Productos para el selector | STANDARD/COMPANY/items?$filter=blocked eq false and type eq 'Inventory'&$select=id,number,displayName,baseUnitOfMeasureCode,blocked |
| Almacén fijo | STANDARD/COMPANY/locations?$filter=code eq 'CENTRAL 3' |
| Unidades por producto | CUSTOM/COMPANY/unidadesProducto?$filter=numprod eq '1000' |
| Tipos de proyecto | CUSTOM/COMPANY/tiposProyecto |
| Movimientos candidatos | CUSTOM/COMPANY/movimientosAplicables?$filter=numprod eq '1000' |
| Consultar líneas de integración | CUSTOM/COMPANY/diarioProductos |
| Consultar una línea | CUSTOM/COMPANY/diarioProductos({id}) |
| Crear o reintentar | POST CUSTOM/COMPANY/diarioProductos |
| Metadatos | CUSTOM/$metadata |

Codificar espacios y caracteres de la URL con URLSearchParams; duplicar comillas
simples dentro de códigos de filtros OData. Seguir @odata.nextLink en los listados.
Unidades y movimientos exigen filtro de igualdad para un único producto; no exponen
toda la tabla cuando se omite. Las claves individuales siguen siendo SystemId.

Se reutilizan items y locations estándar porque contienen los campos necesarios.
La API dimensionValues documentada no expone bloqueo ni tipo de valor; por eso
se crea tiposProyecto. unitsOfMeasure global no representa las conversiones por
producto; se crea unidadesProducto. movimientosAplicables incorpora los filtros
del lookup y las restricciones de esta fase. No se duplican catálogos innecesarios.

Ejemplo mínimo de creación, con un UUID de ejemplo que debes generar de nuevo para
cada entrada real:

```json
{
  "claveintegracion": "3ce0be21-a7ef-46fc-a959-b00680bb1b15",
  "numprod": "1000",
  "cantidad": 2
}
```

Ejemplo con unidad y precio directo, solo si el producto permite edición de coste:

```json
{
  "claveintegracion": "c8b17c1c-2e16-4967-9e50-f08b430f6918",
  "numprod": "1000",
  "cantidad": 2,
  "codudmedida": "UNIDADES",
  "tipoproyectocodigo": "INDIRECTO",
  "preciounitario": 10,
  "liqpornumorden": 0
}
```

Para introducir importe, sustituir preciounitario por importe. Para introducir coste,
sustituirlo por costeunitario. La unidad y producto del ejemplo se vieron en tus capturas;
su configuración de costes no está comprobada. No se inventan importes finales.
La respuesta contiene los campos anteriores con valores finales calculados por BC.
React debe mostrar nombre y enviar código: Obra → DIRECTO, Estructura → INDIRECTO,
Grupo → GRUPO. Si se prefieren otras etiquetas visuales, mantener los códigos reales.

### Literal del enum: comprobación pendiente en el servicio

tipomovimiento es solo lectura: **no admite que el cliente lo seleccione en POST**.
El valor AL es "Positive Adjmt." (ordinal 2 en los símbolos de BC 27.5).
No se afirma que la etiqueta española ni el nombre AL sean el literal JSON publicado.

No hay acceso autenticado al $metadata de tu sandbox en esta sesión, por lo que
el literal exacto de respuesta queda pendiente. scripts/Verify-Metadata.ps1 obtiene
la propiedad y su EnumType y muestra el Member.Name del ordinal 2, sin suponer
normalización de espacios o puntos. Ejecutarlo después de publicar:

```powershell
# Variables suministradas por tu entorno local/backend; no guardar el token en archivos.
# BC_API_ROOT = URL completa hasta /api/Estel/GestionMaterial/v1.0
# BC_ACCESS_TOKEN = token OAuth vigente
./scripts/Verify-Metadata.ps1
```

Para permitir otros tipos en el futuro, añadir reglas por tipo y hacer explícito el
contrato; cambiar únicamente el default no es suficiente.

## Concurrencia e idempotencia

Cada alta lógica necesita un UUID persistido por el backend antes de llamar a BC.
Su ámbito es la empresa de BC. Las propiedades relevantes se serializan en orden
estable después de normalizar Code, números y defaults. No se compara JSON crudo.
No cambiar unidad omitida por unidad explícita ni precio omitido por un valor en un
reintento: son solicitudes diferentes. La fecha automática no forma parte de la clave,
por lo que reintentar mañana devuelve la entrada original y su fecha original.

Se bloquea y lee la fila existente de ELEMENTO/GENERICO antes de consultar la clave.
Esto serializa las peticiones de esta integración incluso con tablas vacías. La tabla
de solicitudes tiene la clave como PK. Misma clave/mismos datos devuelve la línea
existente; misma clave/otros datos devuelve GM_KEY_CONFLICT.

La línea y el recibo de la petición se insertan dentro de la misma transacción.
No hay COMMIT; se prohíben commits explícitos durante CreateEntry. La serie se consume
solo después de deduplicar y validar. DIAP-GEN debe admitir numeración automática y
usar implementación sin huecos: se rechaza MayProduceGaps para que un fallo posterior
pueda revertir también el número. Se omiten números que ya aparecen en diarios o
movimientos, incluyendo borradores manuales que usaron PeekNextNo.

Line No. se asigna bajo bloqueo con incrementos de 10000. Esto solo es la clave interna
de línea; el documento nunca se obtiene mediante MAX + 1. Las colisiones con usuarios
ajenos a la integración pueden producir un error transitorio, no un alta duplicada.
En bloqueos, desconexiones o limitación de servicio, reintentar con espera progresiva
y el MISMO UUID/cuerpo. No generar otro UUID tras un timeout.

Si la línea ya se registró o eliminó desde BC, el recibo se conserva y la repetición
devuelve GM_ENTRY_GONE sin crear nada. No limpiar esta tabla como si fuera una caché.
Si un usuario modifica manualmente una línea, el reintento devuelve su estado actual.
No se promete una copia histórica de la primera respuesta HTTP.

La API filtra en grupo 2 por plantilla, sección y clave no vacía. GET por id también
queda sujeto a ese filtro. PATCH y DELETE están deshabilitados. Los borradores antiguos
y las líneas manuales no aparecen. No se cambian las reglas de las pantallas estándar
para usuarios que ya tienen otros permisos.

## Publicación y permisos

1. Comprobar que los IDs 60701–60707 no están ocupados por otras extensiones del sandbox.
2. Conservar ELEMENTO/GENERICO para esta integración operativamente. La captura muestra
   una sección genérica que puede compartirse con trabajo manual; la API la aísla por
   marca, pero no convierte la sección en exclusiva para otros usuarios de BC.
3. Revisar DIAP-GEN: numeración automática, línea vigente a fecha actual y sin huecos.
   No cambiar contador ni inventar T00027. BC decide el próximo número válido.
4. Verificar CENTRAL 3, las dimensiones confirmadas, productos y sus unidades.
   Si la configuración requiere ubicación, variante, lotes o series, revisar esos
   datos antes de registrar. Esta versión crea borradores y no implementa captura
   de seguimiento ni de variantes. No sustituye todas las comprobaciones del registro.
5. Compilar con AL: Package en VS Code. Publicar en el sandbox seleccionado con
   AL: Publish without debugging o instalar el paquete API-GestionMaterial.app.
   No requiere publicar la página en la lista de servicios web: es PageType API.
6. Asignar GM ENTRADAS API al usuario/aplicación de integración para la empresa correcta,
   junto con permisos base de plataforma y ejecución de las rutinas estándar necesarias.
   La identidad OAuth necesita acceso a BC y estar configurada en Aplicaciones Microsoft
   Entra con los permisos correspondientes. La autorización efectiva debe probarse con
   esa identidad, no con SUPER.
7. El conjunto añade lecturas y permisos indirectos para las escrituras necesarias;
   no otorga modificación/eliminación del diario ni escritura de movimientos/asientos.
   Las validaciones estándar y otras extensiones pueden necesitar permisos adicionales
   según configuración. Resolver esos permisos concretos al probar; no dar SUPER al backend.
   Las páginas estándar items/locations necesitan además autorización de ejecución de
   las APIs estándar. No se incluyen objetos de _Exclude_APIV2_ como dependencia del proyecto.
8. Verificar metadatos y ejecutar las pruebas descritas abajo.

No se ha publicado ninguna extensión ni modificado datos del sandbox desde esta sesión.

## Pruebas

tests/sandbox.mjs es una suite HTTP preparada para el sandbox. **Crea líneas pendientes**;
no registra ni borra. Requiere Node 18 o posterior, sin paquetes adicionales.
Definir BC_API_ROOT, BC_STANDARD_ROOT (hasta /api/v2.0), BC_COMPANY_ID,
BC_ACCESS_TOKEN y opcionalmente BC_TEST_ITEM (por defecto 1000), después:

```powershell
node tests/sandbox.mjs
```

Comprueba catálogos, defaults, descripción, unidad base, dimensiones, reintentos,
orden inverso de JSON, ocho llamadas simultáneas con clave nueva y con clave ya
existente, cinco altas diferentes y unicidad de documentos, errores sin líneas
residuales, campos fijos, claves reutilizadas con otro cuerpo, PATCH/DELETE y
existencias sin cambios. Ejecutar sin movimientos externos del producto durante
la prueba para poder comparar existencias.

Variables opcionales para ampliar pruebas con datos reales:

- BC_NONSTANDARD_ITEM: producto que permita probar precio, importe y coste.
- BC_STANDARD_ITEM: producto de coste estándar; debe rechazar edición monetaria.
- BC_BLOCKED_ITEM: producto bloqueado; debe rechazarlo.
- BC_OTHER_JOURNAL_LINE_ID: UUID de una línea manual o de otro diario; GET debe dar 404.

Estas pruebas se anuncian pendientes cuando no se suministran sus datos. Completar
además la siguiente matriz con un administrador del sandbox:

| Caso | Resultado esperado |
|---|---|
| Cambiar WorkDate a otro día | Nueva línea usa Today de la sesión, no WorkDate. |
| Producto con otra unidad y factor > 1 | Quantity (Base) y coste/precio corresponden a esa unidad. |
| Dimensión o valor bloqueado / valor Total | No aparece como elegible; POST se rechaza. |
| Dimensiones predeterminadas obligatorias/incompatibles | POST se rechaza sin número ni línea persistida. |
| Movimiento positivo, cerrado, otro producto/almacén o seguimiento | Rechazo; aplicar un candidato válido llama a validación estándar. |
| Cantidad base superior a pendiente | Rechazo. Selección válida no reserva existencias. |
| Error tras reservar número, con serie sin huecos | Transacción revierte número, línea y recibo. |
| Repetir una entrada y revisar DIAP-GEN antes/después | Contador sin cambios; mismo id y documento. |
| Repetir una entrada cuya línea se eliminó manualmente | GM_ENTRY_GONE; nunca se recrea. |
| Repetir después de registrar manualmente una entrada de prueba | GM_ENTRY_GONE; nunca se registra ni crea otra. Esta prueba sí requiere una acción manual de registro separada. |
| Intentar filtrar otro diario o acceder a id ajeno | No se obtiene la línea ajena. |
| Misma petición con propiedades JSON reordenadas | Mismo id, documento y resultado calculado. |
| Dos entradas con claves distintas simultáneas | Dos líneas, dos documentos; reintentar errores transitorios con la misma clave. |
| Número ya presente en un borrador manual | El asignador lo omite y obtiene otro mediante DIAP-GEN. |
| Permisos de la aplicación sin SUPER | Altas y catálogos funcionan; no puede escribir movimientos/asientos ni otros diarios mediante esta API. |

La compilación local con símbolos BC 27.5 y runtime 16 es una comprobación de tipos,
firmas y sintaxis. **No equivale a haber ejecutado estas pruebas HTTP**, comprobado
los permisos efectivos ni consultado los metadatos del servicio.

Resultado local del 25/09/2026: compilación de los ocho objetos AL completada con
código de salida 0, sin errores ni advertencias; paquete API-GestionMaterial.app
generado. Sintaxis de tests/sandbox.mjs comprobada con node --check y sintaxis del
script PowerShell comprobada con su analizador. Pruebas funcionales y concurrencia
contra BC: preparadas, no ejecutadas por falta de conexión autenticada.

## Fuentes y criterios

Se consultó documentación oficial de Microsoft y el código fuente incluido en los
símbolos locales de Microsoft Base Application y Business Foundation 27.5.

- [API personalizada y metadatos de enums](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-develop-custom-api): SystemId como clave; EnumType describe los literales publicados.
- [Today](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/methods-auto/system/system-today-method): fecha actual frente a fecha de trabajo.
- [No. Series](https://learn.microsoft.com/en-us/dynamics365/business-central/application/business-foundation/codeunit/microsoft.foundation.noseries.no.-series): asignación con fecha, sin calcular números en Node.
- [LockTable](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/methods-auto/record/record-locktable-method): bloqueo para proteger la lectura previa a inserción.
- [Items API](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/resources/dynamics_item): datos del selector de productos.
- [Locations API](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/resources/dynamics_location): código/nombre de almacén.
- [Dimension values API](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/api-reference/v2.0/resources/dynamics_dimensionvalue): campos publicados por la API estándar.
- [Permisos de objetos](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-permissions-on-database-objects): permisos directos e indirectos.

El detalle de costes y lookup se verificó en ItemJournalLine.Table.al de los símbolos:
validaciones de Unit Amount, Unit Cost, Amount, Applies-to Entry, SelectItemEntry,
ValidateShortcutDimCode y UpdateAmount. No se dedujo de etiquetas traducidas.
