export const columnasDiario = [
  ["fechaRegistro", "Fecha registro"], ["tipoMovimiento", "Tipo mov"],
  ["numeroDocumento", "Nº documento"], ["numeroProducto", "Nº producto"],
  ["descripcion", "Descripción"], ["codigoAlmacen", "Cód. almacén"],
  ["cantidad", "Cantidad"], ["unidadMedida", "Cód. unidad medida"],
  ["precioUnitario", "Precio unitario"], ["importe", "Importe"],
  ["importeDto", "Importe dto."], ["costeUnitario", "Coste unitario"],
  ["liquidacionOrden", "Liq por nº orden"], ["tipoProyecto", "Tipo proyecto código"],
  ["departamento", "Departamento"]
];
const numericos = ["cantidad", "precioUnitario", "importe", "importeDto", "costeUnitario"];
const fijos = ["fechaRegistro", "numeroDocumento", "descripcion", "codigoAlmacen", "departamento"];

export default function DiarioAlmacen({ filas, productos, configuracion, cambiar, quitar, guardar, ocupado }) {
  return <div className="journal-scroll" tabIndex="0" role="region" aria-label="Diario editable de entradas">
    <table className="journal-table"><caption>Entradas de material · Desplázate horizontalmente para ver todas las columnas</caption>
      <thead><tr>{columnasDiario.map(([campo, titulo]) => <th key={campo} scope="col">{titulo}</th>)}<th scope="col">Acciones</th></tr></thead>
      <tbody>{filas.map((fila, indice) => <tr key={fila.solicitudId}>{columnasDiario.map(([campo, titulo]) => {
        const etiqueta = `${titulo}, fila ${indice + 1}`;
        let control;
        if (fijos.includes(campo)) control = <span>{fila[campo] || (campo === "numeroDocumento" ? "Al guardar" : "—")}</span>;
        else if (campo === "numeroProducto") control = <select aria-label={etiqueta} disabled={ocupado} value={fila[campo]} onChange={e => {
          const producto = productos.find(item => item.numero === e.target.value);
          cambiar(fila.solicitudId, { numeroProducto: e.target.value, descripcion: producto?.descripcion || "", unidadMedida: producto?.unidadMedida || "" });
        }}><option value="">Seleccionar producto</option>{productos.map(item => <option key={item.numero} value={item.numero}>{item.numero} · {item.descripcion}</option>)}</select>;
        else if (campo === "tipoMovimiento" || campo === "tipoProyecto") {
          const opciones = campo === "tipoMovimiento" ? configuracion.tiposMovimiento : configuracion.tiposProyecto.map(valor => ({ valor, etiqueta: valor }));
          control = <select aria-label={etiqueta} disabled={ocupado} value={fila[campo]} onChange={e => cambiar(fila.solicitudId, { [campo]: e.target.value })}>{opciones.map(item => <option key={item.valor} value={item.valor}>{item.etiqueta}</option>)}</select>;
        } else control = <input aria-label={etiqueta} disabled={ocupado} type={numericos.includes(campo) ? "number" : "text"} min={campo === "cantidad" ? "0.000001" : "0"} step="any" maxLength={100} value={fila[campo]} onChange={e => cambiar(fila.solicitudId, { [campo]: e.target.value })} />;
        return <td key={campo} className={fijos.includes(campo) ? "journal-fixed" : ""}>{control}</td>;
      })}<td><div className="journal-actions"><button type="button" disabled={ocupado} onClick={() => guardar(fila)}>Guardar fila {indice + 1}</button><button type="button" disabled={ocupado} aria-label={`Quitar fila ${indice + 1}`} onClick={() => quitar(fila.solicitudId)}>Quitar</button></div>{fila.error && <p role="alert" className="journal-error">{fila.error}</p>}</td></tr>)}</tbody>
    </table>
  </div>;
}
