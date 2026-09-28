import { useEffect, useState } from "react";
import * as servicio from "../services/almacen";
import { modosMonetarios } from "../services/almacenPayload";

export const columnasDiario = [
  ["fecharegistro", "Fecha registro"], ["tipomovimiento", "Tipo mov"], ["numdoc", "Nº documento"],
  ["numprod", "Nº producto"], ["descripcion", "Descripción"], ["codalmacen", "Cód. almacén"],
  ["cantidad", "Cantidad"], ["codudmedida", "Cód. unidad medida"], ["preciounitario", "Precio unitario"],
  ["importe", "Importe"], ["importedto", "Importe dto."], ["costeunitario", "Coste unitario"],
  ["liqpornumorden", "Movimiento aplicado"], ["tipoproyectocodigo", "Tipo proyecto"], ["departamento", "Departamento"]
];
export const columnasResultado = [...columnasDiario, ["cantidadbase", "Cantidad base"], ["factorunidad", "Factor unidad"], ["conjuntodimensiones", "Conjunto dimensiones"]];

function FilaDiario({ fila, indice, productos, tiposProyecto, cambiar, quitar, guardar, corregir, ocupado, seleccion, seleccionar }) {
  const [catalogos, setCatalogos] = useState({ producto: "", unidades: [], movimientos: [], cargando: false, error: "" });
  const [intento, setIntento] = useState(0);
  const bloqueada = fila.estado !== "borrador";
  useEffect(() => {
    if (!fila.numprod || bloqueada) return undefined;
    let activa = true;
    setCatalogos({ producto: fila.numprod, unidades: [], movimientos: [], cargando: true, error: "" });
    Promise.all([servicio.obtenerUnidades(fila.numprod), servicio.obtenerMovimientosAplicables(fila.numprod)])
      .then(([unidades, movimientos]) => { if (activa) setCatalogos({ producto: fila.numprod, unidades, movimientos, cargando: false, error: "" }); })
      .catch(error => { if (activa) setCatalogos({ producto: fila.numprod, unidades: [], movimientos: [], cargando: false, error: error.response?.data?.error || "No se pudieron cargar las unidades y movimientos del producto." }); });
    return () => { activa = false; };
  }, [fila.numprod, bloqueada, intento]);
  const disponibles = catalogos.producto === fila.numprod && !catalogos.cargando && !catalogos.error;
  const deshabilitado = ocupado || bloqueada;
  const modificar = cambio => cambiar(fila.solicitudId, cambio);
  const producto = productos.find(item => item.number === fila.numprod);
  const tipos = tiposProyecto.filter(item => !item.bloqueado);
  const proyectoValido = tipos.some(item => item.codigo === fila.tipoproyectocodigo);
  const unidadValida = !fila.codudmedida || catalogos.unidades.some(item => item.codigo === fila.codudmedida);
  const movimiento = catalogos.movimientos.find(item => item.numero === Number(fila.liqpornumorden));
  const movimientoValido = !fila.liqpornumorden || !!movimiento;
  const unidad = catalogos.unidades.find(item => item.codigo === (fila.codudmedida || producto?.baseUnitOfMeasureCode));
  const excede = movimiento && unidad && Number(fila.cantidad) * unidad.factor > Math.abs(movimiento.cantidadpendientebase);
  const fijos = { fecharegistro: "Fecha de BC", tipomovimiento: "Ajuste positivo", numdoc: "Asigna BC", descripcion: producto?.displayName || fila.descripcion || "—", codalmacen: "CENTRAL 3", importedto: "Calcula BC", departamento: "SG-ALMACEN" };
  return <tr className={seleccion === fila.solicitudId ? "bc-row-selected" : ""} onFocus={() => seleccionar?.(fila.solicitudId)}><td className="bc-row-selector"><input type="radio" name="linea-diario" aria-label={`Seleccionar borrador ${indice + 1}`} checked={seleccion === fila.solicitudId} onChange={() => seleccionar?.(fila.solicitudId)} /></td>{columnasDiario.map(([campo, titulo]) => {
    const label = `${titulo}, fila ${indice + 1}`;
    let control;
    if (Object.prototype.hasOwnProperty.call(fijos, campo)) control = fijos[campo];
    else if (bloqueada) control = ["preciounitario", "importe", "costeunitario"].includes(campo) ? (fila.modoMonetario === campo ? fila.valorMonetario : "Calcula BC") : fila[campo] || (campo === "codudmedida" ? "Inicializa BC" : "—");
    else if (campo === "numprod") control = <select aria-label={label} disabled={deshabilitado} value={fila.numprod} onChange={e => modificar({ numprod: e.target.value, codudmedida: "", liqpornumorden: "" })}>
      <option value="">Seleccionar producto</option>{productos.map(item => <option key={item.id || item.number} value={item.number}>{item.number} · {item.displayName}</option>)}
    </select>;
    else if (campo === "codudmedida") control = <select aria-label={label} disabled={deshabilitado || !disponibles} value={fila.codudmedida} onChange={e => modificar({ codudmedida: e.target.value })}>
      <option value="">Inicializa BC{producto?.baseUnitOfMeasureCode ? ` (${producto.baseUnitOfMeasureCode})` : ""}</option>{catalogos.unidades.map(item => <option key={item.id || item.codigo} value={item.codigo}>{item.codigo} · factor {item.factor}</option>)}
    </select>;
    else if (campo === "liqpornumorden") control = <select aria-label={label} disabled={deshabilitado || !disponibles} value={fila.liqpornumorden} onChange={e => modificar({ liqpornumorden: e.target.value })}>
      <option value="">Sin aplicación</option>{catalogos.movimientos.map(item => <option key={item.id || item.numero} value={item.numero}>{item.numero} · {item.documento} · {item.fecha} · pendiente {item.cantidadpendientebase} (base)</option>)}
    </select>;
    else if (campo === "tipoproyectocodigo") control = <select aria-label={label} disabled={deshabilitado} value={fila.tipoproyectocodigo} onChange={e => modificar({ tipoproyectocodigo: e.target.value })}>
      {!proyectoValido && <option value={fila.tipoproyectocodigo}>{fila.tipoproyectocodigo || "Seleccionar"} · no disponible</option>}{tipos.map(item => <option key={item.id || item.codigo} value={item.codigo}>{item.nombre} ({item.codigo})</option>)}
    </select>;
    else if (campo === "cantidad") control = <input aria-label={label} type="number" step="any" disabled={deshabilitado} value={fila.cantidad} onChange={e => modificar({ cantidad: e.target.value })} />;
    else control = fila.modoMonetario === campo ? <input aria-label={label} type="number" step="any" disabled={deshabilitado} value={fila.valorMonetario} onChange={e => modificar({ valorMonetario: e.target.value })} /> : "Calcula BC";
    return <td key={campo} className={Object.prototype.hasOwnProperty.call(fijos, campo) ? "journal-fixed" : ""}>{control}</td>;
  })}<td><select aria-label={`Modo monetario, fila ${indice + 1}`} value={fila.modoMonetario} disabled={deshabilitado} onChange={e => modificar({ modoMonetario: e.target.value, valorMonetario: "" })}>{modosMonetarios.map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}</select></td>
    <td className="journal-row-status">
      <div className="journal-actions">
        {fila.estado === "borrador" && <><button disabled={ocupado || !disponibles || !proyectoValido || !unidadValida || !movimientoValido || excede} onClick={() => guardar(fila)}>Crear entrada pendiente</button><button disabled={ocupado} aria-label={`Quitar borrador ${indice + 1}`} onClick={() => quitar(fila.solicitudId)}>Quitar</button></>}
        {["incierta", "procesando", "preparada"].includes(fila.estado) && <button disabled={ocupado} onClick={() => guardar(fila)}>Confirmar resultado / Reintentar</button>}
        {fila.estado === "rechazada" && <button disabled={ocupado} onClick={() => corregir(fila)}>Corregir solicitud rechazada</button>}
      </div>
      {fila.estado === "procesando" && <p role="status">Solicitud en curso. Conserva esta operación hasta confirmar el resultado.</p>}
      {fila.estado === "incierta" && <p role="status">Resultado pendiente de confirmar. Se reenviarán la misma clave y los mismos datos.</p>}
      {fila.estado === "bloqueada" && <p>Requiere revisión. No se creará una sustituta.</p>}
      {fila.proximoIntento && <p>Próximo intento a partir de {new Date(fila.proximoIntento).toLocaleTimeString("es")}</p>}
      {!bloqueada && catalogos.cargando && <p role="status">Cargando unidades y movimientos…</p>}
      {!bloqueada && catalogos.error && <p role="alert" className="journal-error">{catalogos.error} <button onClick={() => setIntento(valor => valor + 1)}>Recargar opciones</button></p>}
      {excede && !bloqueada && <p role="alert" className="journal-error">La cantidad base supera la pendiente del movimiento seleccionado.</p>}
      {fila.error && <p role="alert" className="journal-error">{fila.error}</p>}
    </td>
  </tr>;
}

export default function DiarioAlmacen(props) {
  const entradas = props.entradas || [];
  const anchos = [32, 95, 105, 95, 155, 180, 100, 80, 100, 95, 95, 90, 95, 140, 135, 110, 170, 210];
  return <div className="journal-scroll" tabIndex="0" role="region" aria-label="Diario editable de entradas"><table className="journal-table" style={{ width: anchos.reduce((total, ancho) => total + ancho, 0) }}>
    <caption>Diario de productos · Borradores y líneas pendientes en BC</caption>
    <colgroup>{anchos.map((ancho, indice) => <col key={indice} style={{ width: ancho }} />)}</colgroup>
    <thead><tr><th scope="col" aria-label="Seleccionar línea"></th>{columnasDiario.map(([campo, titulo]) => <th key={campo} scope="col">{titulo}</th>)}<th scope="col">Modo monetario</th><th scope="col">Estado / Acciones</th></tr></thead>
    <tbody>{props.filas.map((fila, indice) => <FilaDiario {...props} key={fila.solicitudId} fila={fila} indice={indice} />)}
      {entradas.map(entrada => <tr key={entrada.id} className={props.seleccion === entrada.id ? "bc-row-selected" : ""} onClick={() => props.seleccionar?.(entrada.id)}>
        <td className="bc-row-selector"><input type="radio" name="linea-diario" aria-label={`Seleccionar documento ${entrada.numdoc || entrada.id}`} checked={props.seleccion === entrada.id} onChange={() => props.seleccionar?.(entrada.id)} /></td>
        {columnasDiario.map(([campo]) => <td key={campo} title={String(entrada[campo] ?? "")}>{entrada[campo] ?? "—"}</td>)}
        <td>Valores de BC</td><td className="journal-row-status"><span className="bc-line-status">{entrada.estadoRegistro ? "Registro por confirmar" : "Guardada · Pendiente de registrar"}</span>{entrada.errorRegistro && <p role="alert" className="journal-error">{entrada.errorRegistro}</p>}</td>
      </tr>)}
      {!props.filas.length && !entradas.length && <tr><td colSpan={18} className="bc-empty">No hay líneas. Pulsa Nueva línea para empezar.</td></tr>}
    </tbody>
  </table></div>;
}
