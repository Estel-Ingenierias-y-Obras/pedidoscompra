import { Children, useEffect, useState } from "react";
import DeleteIconButton from "./DeleteIconButton";
import * as servicio from "../services/almacen";

export const columnasDiario = [
  ["fecharegistro", "Fecha registro"], ["tipomovimiento", "Tipo mov"], ["numdoc", "Nº documento"],
  ["numprod", "Nº producto"], ["descripcion", "Descripción"], ["codalmacen", "Cód. almacén"],
  ["cantidad", "Cantidad"], ["codudmedida", "Cód. unidad medida"], ["preciounitario", "Precio unitario"],
  ["importe", "Importe"], ["importedto", "Importe dto."], ["costeunitario", "Coste unitario"],
  ["liqpornumorden", "Movimiento aplicado"], ["tipoproyectocodigo", "Tipo proyecto"], ["departamento", "Departamento"]
];
export const columnasResultado = [...columnasDiario, ["cantidadbase", "Cantidad base"], ["factorunidad", "Factor unidad"], ["conjuntodimensiones", "Conjunto dimensiones"]];
const columnasOcultas = new Set(["fecharegistro", "tipomovimiento", "numdoc", "codalmacen", "departamento", "codudmedida", "preciounitario", "importe", "importedto", "costeunitario", "liqpornumorden"]);
const columnasVisibles = columnasDiario.filter(([campo]) => !columnasOcultas.has(campo));
const columnasNumericas = new Set(["cantidad", "preciounitario", "importe", "importedto", "costeunitario", "liqpornumorden"]);

function seleccionarConTeclado(event, seleccionar) {
  if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    seleccionar();
  }
}

function SelectorDiario({ children, ...props }) {
  const opcion = Children.toArray(children).find(item => item.props?.value === props.value);
  const texto = opcion ? Children.toArray(opcion.props.children).join("") : "";
  return <span className="bc-compact-select"><select {...props} title={texto}>{children}</select><span className="bc-select-detail" aria-hidden="true">{texto}</span></span>;
}

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
  return <tr className={seleccion === fila.solicitudId ? "bc-row-selected" : ""} tabIndex={0} aria-label={`Borrador ${indice + 1}`} aria-selected={seleccion === fila.solicitudId} onPointerDownCapture={event => { if (event.target.disabled) seleccionar?.(fila.solicitudId); }} onClick={() => seleccionar?.(fila.solicitudId)} onFocus={() => seleccionar?.(fila.solicitudId)} onKeyDown={event => seleccionarConTeclado(event, () => seleccionar?.(fila.solicitudId))}>{columnasVisibles.map(([campo, titulo]) => {
    const label = `${titulo}, fila ${indice + 1}`;
    let control;
    if (Object.prototype.hasOwnProperty.call(fijos, campo)) control = fijos[campo];
    else if (bloqueada) control = ["preciounitario", "importe", "costeunitario"].includes(campo) ? (fila.modoMonetario === campo ? fila.valorMonetario : "Calcula BC") : fila[campo] || (campo === "codudmedida" ? "Inicializa BC" : "—");
    else if (campo === "numprod") control = <SelectorDiario aria-label={label} disabled={deshabilitado} value={fila.numprod} onChange={e => modificar({ numprod: e.target.value, codudmedida: "", liqpornumorden: "" })}>
      <option value="">Seleccionar producto</option>{productos.map(item => <option key={item.id || item.number} value={item.number}>{item.number} · {item.displayName}</option>)}
    </SelectorDiario>;
    else if (campo === "codudmedida") control = <SelectorDiario aria-label={label} disabled={deshabilitado || !disponibles} value={fila.codudmedida} onChange={e => modificar({ codudmedida: e.target.value })}>
      <option value="">Inicializa BC{producto?.baseUnitOfMeasureCode ? ` (${producto.baseUnitOfMeasureCode})` : ""}</option>{catalogos.unidades.map(item => <option key={item.id || item.codigo} value={item.codigo}>{item.codigo} · factor {item.factor}</option>)}
    </SelectorDiario>;
    else if (campo === "liqpornumorden") control = <SelectorDiario aria-label={label} disabled={deshabilitado || !disponibles} value={fila.liqpornumorden} onChange={e => modificar({ liqpornumorden: e.target.value })}>
      <option value="">Sin aplicación</option>{catalogos.movimientos.map(item => <option key={item.id || item.numero} value={item.numero}>{item.numero} · {item.documento} · {item.fecha} · pendiente {item.cantidadpendientebase} (base)</option>)}
    </SelectorDiario>;
    else if (campo === "tipoproyectocodigo") control = <SelectorDiario aria-label={label} disabled={deshabilitado} value={fila.tipoproyectocodigo} onChange={e => modificar({ tipoproyectocodigo: e.target.value })}>
      {!proyectoValido && <option value={fila.tipoproyectocodigo}>{fila.tipoproyectocodigo || "Seleccionar"} · no disponible</option>}{tipos.map(item => <option key={item.id || item.codigo} value={item.codigo}>{item.nombre} ({item.codigo})</option>)}
    </SelectorDiario>;
    else if (campo === "cantidad") control = <input aria-label={label} type="number" step="any" disabled={deshabilitado} value={fila.cantidad} onChange={e => modificar({ cantidad: e.target.value })} />;
    else control = fila.modoMonetario === campo ? <input aria-label={label} type="number" step="any" disabled={deshabilitado} value={fila.valorMonetario} onChange={e => modificar({ valorMonetario: e.target.value })} /> : "Calcula BC";
    return <td key={campo} data-label={titulo} title={typeof control === "string" || typeof control === "number" ? String(control) : undefined} className={[Object.prototype.hasOwnProperty.call(fijos, campo) ? "journal-fixed" : "", columnasNumericas.has(campo) ? "bc-cell-number" : ""].filter(Boolean).join(" ")}>{control}</td>;
  })}
    <td className="warehouse-row-status" data-label="Acciones">
      <div className="warehouse-row-actions">
        {fila.estado === "borrador" && <><button title="Enviar la línea para confirmarla desde Business Central" disabled={ocupado || !disponibles || !proyectoValido || !unidadValida || !movimientoValido || excede} onClick={() => guardar(fila)}>Enviar a BC</button>{!fila.cuerpoEnviado && <DeleteIconButton disabled={ocupado} label={`Eliminar borrador ${indice + 1}`} onClick={event => { event.stopPropagation(); quitar(fila.solicitudId); }} />}</>}
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
  const anchos = props.historial ? ["14%", "16%", "28%", "10%", "18%", "14%"] : ["18%", "30%", "12%", "20%", "20%"];
  return <div className="warehouse-table-container" tabIndex="0" role="region" aria-label={props.historial ? "Historial de envíos a BC" : "Diario editable de entradas"}><table className="gestion-pedidos-table warehouse-entries-table">
    <caption>{props.historial ? "Enviados a BC" : "Diario de productos · Líneas pendientes de envío"}</caption>
    <colgroup>{anchos.map((ancho, indice) => <col key={indice} style={{ width: ancho }} />)}</colgroup>
    <thead><tr>{props.historial && <th scope="col" title="Fecha de creación del envío">Fecha</th>}{columnasVisibles.map(([campo, titulo]) => <th key={campo} className={columnasNumericas.has(campo) ? "bc-cell-number" : ""} scope="col" title={titulo} aria-label={titulo}>{titulo}</th>)}<th scope="col">{props.historial ? "Estado" : "Acciones"}</th></tr></thead>
    <tbody>{props.filas.map((fila, indice) => <FilaDiario {...props} key={fila.solicitudId} fila={fila} indice={indice} />)}
      {entradas.map(entrada => <tr key={entrada.id} className={props.seleccion === entrada.id ? "bc-row-selected" : ""} tabIndex={0} aria-label={`Documento ${entrada.numdoc || entrada.id}`} aria-selected={props.seleccion === entrada.id} onClick={() => props.seleccionar?.(entrada.id)} onFocus={() => props.seleccionar?.(entrada.id)} onKeyDown={event => seleccionarConTeclado(event, () => props.seleccionar?.(entrada.id))}>
        {props.historial && <td data-label="Fecha">{entrada.fechaEnvio && !Number.isNaN(new Date(entrada.fechaEnvio).getTime()) ? new Date(entrada.fechaEnvio).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</td>}
        {columnasVisibles.map(([campo, titulo]) => <td key={campo} data-label={titulo} className={columnasNumericas.has(campo) ? "bc-cell-number" : ""} title={String(entrada[campo] ?? "")}>{entrada[campo] ?? "—"}</td>)}
        <td className="warehouse-row-status" data-label="Estado"><span className="bc-line-status" title="Recepción confirmada por BC. Consulta su registro o contabilización en Business Central.">Enviada a BC</span></td>
      </tr>)}
      {!props.filas.length && !entradas.length && <tr><td colSpan={columnasVisibles.length + (props.historial ? 2 : 1)} className="bc-empty">{props.historial ? "Todavía no hay envíos confirmados a BC." : "No hay líneas. Pulsa Nueva línea para empezar."}</td></tr>}
    </tbody>
  </table></div>;
}
