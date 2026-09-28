# Adaptación de la API DiarioProductos (60700)

> Documento de diseño anterior, conservado como referencia. Los datos que aquí figuraban pendientes ya están confirmados en [README-API.md](README-API.md). La implementación actual y su configuración se describen en [almacen.md](almacen.md); ese contrato sustituye las propuestas de este documento.

La página aportada expone líneas de diario; no expone automáticamente los catálogos utilizados por los desplegables del cliente BC. Este documento concreta el contrato para integrar esa página. No cambia todavía el envío de entradas del backend ni representa una extensión AL compilada.

## Comportamiento acordado y correspondencias

| Campo de la API AL | Campo de la aplicación | Comportamiento |
| --- | --- | --- |
| fecharegistro | fechaRegistro | Fecha actual por defecto; confirmar en BC al crear |
| tipomovimiento | tipoMovimiento | Ajuste positivo; usar el valor del enum expuesto por BC, no enviar la etiqueta traducida |
| numdoc | numeroDocumento | Generar en BC con la serie de la sección si la serie se comparte con BC |
| numprod | numeroProducto | Selector de Item, con número y descripción |
| descripcion | descripcion | La validación del producto en BC determina la descripción; solo lectura en React |
| codalmacen | codigoAlmacen | CENTRAL 3 fijo; validar su existencia y volver a imponer la restricción antes de insertar/modificar |
| cantidad | cantidad | Editable, mayor que cero para esta entrada |
| codudmedida | unidadMedida | Por defecto la unidad del producto; selector de Item Unit of Measure filtrado por producto |
| preciounitario | precioUnitario | Editable, sujeto a validaciones de BC |
| importe | importe | Editable, sujeto a recálculos de BC |
| importedto | importeDto | Editable, sujeto a validaciones de BC |
| costeunitario | costeUnitario | Editable, sujeto a recálculos de BC |
| liqpornumorden | liquidacionOrden | Applies-to Entry es un entero referido a Item Ledger Entry; no es un número libre de pedido |
| tipoproyectocodigo | tipoProyecto | Código de valor de dimensión global 1; mostrar nombre, enviar código real |
| pendiente de exponer | departamento | SG-ALMACEN fijo; confirmar qué dimensión representa Departamento |

Los valores Directo/Indirecto/Grupo de la aplicación son actualmente etiquetas locales. No enviarlos como códigos de dimensión sin comprobar los códigos del sandbox. Indirecto será el valor predeterminado, conservando el código real asociado.

## Cambios necesarios en la página AL

1. Añadir `ODataKeyFields = SystemId;` y exponer un campo `id` de solo lectura.
2. Definir plantilla y sección del diario. La inserción debe establecer Journal Template Name, Journal Batch Name y Line No. con control de concurrencia. Limitar también las lecturas/modificaciones al diario autorizado.
3. Aplicar valores iniciales cuando se crea una línea, validar con `Rec.Validate` y comprobar las restricciones antes de persistir. Un valor por defecto puede ser reemplazado por la petición; los campos fijos requieren validación final también en modificaciones.
4. Reservar el número de documento con la serie de BC durante la inserción. No usar el último número visible más uno ni mantener dos numeradores para una misma serie. Mantener una clave de integración única para reconciliar reintentos del backend.
5. Exponer Departamento cuando se confirme su dimensión. Si es global 2, corresponde a Shortcut Dimension 2 Code; si no, manejar el Dimension Set ID mediante las funciones de dimensiones de BC.
6. Validar primero el producto y aplicar después ubicación/dimensiones fijas, porque las validaciones del producto pueden establecer otros valores predeterminados. No revalidar el producto al final indiscriminadamente: podría sobrescribir campos introducidos por el usuario.
7. Devolver la línea resultante de BC y reflejarla en React. Precio, cantidad, importe y coste pueden recalcularse entre sí: el contrato deberá definir qué campo prevalece, en vez de enviar valores contradictorios.

Fragmentos orientativos para incorporar a la página, no una implementación completa de inserción:

```al
// Propiedad de la página
ODataKeyFields = SystemId;

// Dentro del repeater
field(id; Rec.SystemId)
{
    Editable = false;
}

// Inicialización, una vez establecido el contexto del diario
Rec.Validate("Posting Date", Today());
Rec.Validate("Entry Type", Rec."Entry Type"::"Positive Adjmt.");
Rec.Validate("Location Code", 'CENTRAL 3');
```

No usar WorkDate() si el requisito es la fecha actual: la fecha de trabajo de BC puede ser distinta. Revisar zona horaria de la sesión del servicio al integrar.

## Catálogos para reproducir las opciones de BC

- Item: número, descripción, unidad base y estado de bloqueo.
- Item Unit of Measure: producto y código de unidad; filtrar por el producto seleccionado.
- Dimension Value: código de dimensión, código de valor, nombre, bloqueo y tipo de valor; filtrar por la dimensión configurada y valores utilizables.
- Location: código de almacén, para validar CENTRAL 3.
- Item Ledger Entry: solo si se habilita la selección de Applies-to Entry, con los filtros aplicables al producto y movimiento. BC conserva la validación final.
- Entry Type: es un enum, no un catálogo de productos ni una lista de etiquetas españolas. Consultar su definición en $metadata o exponer opciones/captions mediante un endpoint propio. En esta fase permitir únicamente ajuste positivo.

React consultará estos catálogos mediante el backend. Deben replicarse los filtros relevantes del lookup de BC; exponer toda una tabla no garantiza las mismas opciones que el formulario de BC.

## Pendiente de confirmar en el sandbox

- Nombre exacto de plantilla y sección, y serie de documentos configurada.
- Código de la dimensión global 1 y códigos de Directo, Indirecto y Grupo.
- Dimensión de Departamento y código real correspondiente a SG-ALMACEN.
- URL del endpoint con entorno/empresa (sin secretos) para configurar el backend.

La página AL no selecciona el sandbox: lo selecciona la URL del servicio. Crear Item Journal Line no equivale a registrar movimientos ni actualizar existencias.

Referencias: [API personalizada](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-develop-custom-api), [Item Journal Line](https://learn.microsoft.com/en-us/dynamics365/business-central/application/base-application/table/microsoft.inventory.journal.item-journal-line).
