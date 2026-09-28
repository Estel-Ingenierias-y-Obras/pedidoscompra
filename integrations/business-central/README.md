# Registro desde PedidosCompra — versión 1.0.2.20260928

Esta carpeta contiene una copia de la extensión original con el mismo app ID y una versión superior. No se ha sobrescrito el proyecto externo `Documents/AL/API-GestionMaterial`, ni publicado en BC. El paquete compilado está en `API-GestionMaterial.app`.

## Publicación y permisos

1. Publicar este paquete en el sandbox Production-Estel-IT, conservando los datos de la extensión anterior. Alternativamente, incorporar estos fuentes a tu proyecto AL y compilar/publicar. No publicar después la versión antigua desde el otro proyecto.
2. En **Aplicaciones Microsoft Entra**, localizar el CLIENT_ID del backend y la empresa ESTEL. Asignar **GM ENTRADAS API** para crear líneas y **GM REGISTRAR API** para permitir el registro desde la web. Este último incluye el primero. Reiniciar el backend para cargar cambios de código.
3. Comprobar los permisos base de ejecución de rutinas estándar de inventario/contabilidad de la identidad. El conjunto nuevo declara escrituras indirectas: otras extensiones/configuraciones pueden exigir permisos adicionales, que se deben resolver según el mensaje concreto, sin conceder SUPER.

Diagnóstico real del 28/09/2026: el reintento con la clave original de la solicitud fallida devuelve HTTP 403, `TableData 60702 GM Entry Request ... IndirectInsert`. Esto identifica el permiso ausente en la identidad de integración. La llamada se rechazó; no se creó una entrada ni se registró stock. El backend ahora muestra ese detalle saneado en lugar de ocultarlo detrás de un error genérico.

## API añadida

`POST .../api/Estel/GestionMaterial/v1.0/companies({companyId})/registrosProducto`

```json
{
  "claveintegracion": "UUID original de la entrada",
  "idlinea": "SystemId de la línea que se quiere registrar"
}
```

La respuesta incluye `id` del recibo, `claveintegracion`, `idlinea`, `numdoc`, `registrado: true` y `fecharegistrocontable`. GET muestra recibos registrados. PATCH/DELETE deshabilitados.

Objetos nuevos: página 60708 GM Post Entry, codeunit 60709 GM Post Management, permissionset 60710 GM REGISTRAR API. La tabla 60702 incorpora Posted y Posted At, con valores iniciales false/0DT en registros antiguos.

Se bloquean sección/recibo/línea, se valida que la línea pertenece a esa petición, ELEMENTO/GENERICO, CENTRAL 3 y ajuste positivo. Se ejecuta **Item Jnl.-Post Line.RunWithCheck** sobre una sola línea, nunca se registra la sección entera. Solo tras éxito se elimina esa línea y se guarda el recibo en la misma transacción. CommitBehavior(Error) prohíbe commits explícitos durante la operación. La serie del documento ya se consumió al crear la línea y no se vuelve a reservar.

Los reintentos con la misma clave/id devuelven el recibo si ya se registró. Otro id produce GM_KEY_CONFLICT. Una línea eliminada/registrada fuera de esta operación produce GM_ENTRY_GONE y no se recrea ni se presupone éxito.

## Alcance de registro

Esta fase registra ajustes positivos de productos de inventario **sin variantes ni seguimiento, y en almacén sin ubicaciones obligatorias ni circuitos de recepción/ubicación/picking/envío obligatorios**. Esas configuraciones se rechazan explícitamente antes de registrar: requieren el flujo completo de almacén, que esta API no captura. No se implementan ajustes negativos, consumos ni registro de toda la sección.

La rutina estándar aplica validaciones y la contabilización de costes según la configuración de BC. Esta vía por línea no ejecuta todo el procesamiento posterior del diario por lotes (por ejemplo vistas de análisis y ajuste automático de costes del lote); revisar esos procesos operativos en BC. No se modifican la configuración ni los permisos efectivos automáticamente.

## Verificación

Compilación local con símbolos BC 27.5 y runtime 16. Pruebas Node/React con dobles cubren selección, confirmación, permisos web, persistencia y recuperación de reintentos. Falta prueba de registro real en sandbox tras publicar/asignar permisos: verificar incremento de existencias, movimientos de producto/valor/contabilidad según configuración, recibo y ausencia de duplicados al repetir o cortar la respuesta. Comprobar también rollback ante errores, rechazo de líneas ajenas, bloqueos/dimensiones y configuraciones avanzadas de almacén. La compilación no sustituye estas pruebas funcionales.
