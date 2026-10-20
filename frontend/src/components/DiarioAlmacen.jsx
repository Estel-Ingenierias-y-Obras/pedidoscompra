import { useCallback, useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";
import { modosMonetarios } from "../services/almacenPayload";
import DeleteIconButton from "./DeleteIconButton";
import BuscadorMovimiento from "./BuscadorMovimiento";
import * as servicio from "../services/almacen";

export const columnasDiario = [
  ["fecharegistro", "Fecha registro"], ["tipomovimiento", "Tipo mov"], ["numdoc", "Nº documento"],
  ["numprod", "Nº producto"], ["descripcion", "Descripción"], ["codalmacen", "Cód. almacén"],
  ["cantidad", "Cantidad"], ["codudmedida", "Cód. unidad medida"], ["preciounitario", "Precio unitario"],
  ["importe", "Importe"], ["importedto", "Importe dto."], ["costeunitario", "Coste unitario"],
  ["liqpornumorden", "Movimiento aplicado"], ["tipoproyectocodigo", "Tipo proyecto"], ["departamento", "Departamento"]
];
export const columnasResultado = [...columnasDiario, ["cantidadbase", "Cantidad base"], ["factorunidad", "Factor unidad"], ["conjuntodimensiones", "Conjunto dimensiones"]];
const columnasVisibles = [["numprod", "Nº producto"], ["descripcion", "Descripción"], ["cantidad", "Cantidad"], ["codudmedida", "Unidad"], ["tipoproyectocodigo", "Tipo proyecto"], ["liqpornumorden", "Movimiento aplicado"], ["modoMonetario", "Valores monetarios"], ["preciounitario", "Precio unitario"], ["importe", "Importe"], ["costeunitario", "Coste unitario"]];
const columnasNumericas = new Set(["cantidad", "preciounitario", "importe", "importedto", "costeunitario", "liqpornumorden"]);

function seleccionarConTeclado(event, seleccionar) {
  if (event.target === event.currentTarget && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    seleccionar();
  }
}

function SelectorDiario({ children, ...props }) {
  return <span className="bc-compact-select"><select {...props}>{children}</select></span>;
}

function FilaDiario({ fila, indice, productos, tiposProyecto, cambiar, quitar, guardar, corregir, ocupado, seleccion, seleccionar, columnas, informarCatalogos }) {
  const opcionesProductos = useMemo(() => productos.map(item => ({ codigo: item.numprod, nombre: item.descripcion })), [productos]);
  const [catalogos, setCatalogos] = useState({ producto: "", unidades: [], movimientos: [], cargando: false, error: "" });
  const [intento, setIntento] = useState(0);
  const bloqueada = fila.estado !== "borrador";
  useEffect(() => {
    if (!fila.numprod || bloqueada) return undefined;
    let activa = true;
    setCatalogos({ producto: fila.numprod, unidades: [], movimientos: [], cargando: true, error: "" });
    Promise.allSettled([servicio.obtenerUnidades(fila.numprod), servicio.obtenerMovimientosAplicables(fila.numprod)])
      .then(([resultadoUnidades, resultadoMovimientos]) => {
        if (!activa) return;
        const unidades = resultadoUnidades.status === "fulfilled" ? resultadoUnidades.value : [];
        const movimientos = resultadoMovimientos.status === "fulfilled" ? resultadoMovimientos.value : [];
        const describirFallo = (resultado, nombre) => {
          if (resultado.status === "fulfilled") return "";
          const error = resultado.reason;
          const detalle = error.response?.data?.error;
          const mensaje = typeof detalle === "string" ? detalle : "No se pudo cargar este catálogo. Comprueba la conexión y que el backend esté actualizado.";
          return `${nombre}: ${mensaje}${error.response?.status ? ` (HTTP ${error.response.status})` : ""}`;
        };
        const error = [describirFallo(resultadoUnidades, "Unidades"), describirFallo(resultadoMovimientos, "Movimientos aplicables")].filter(Boolean).join(" ");
        setCatalogos({ producto: fila.numprod, unidades, movimientos, cargando: false, error });
        informarCatalogos(fila.solicitudId, fila.numprod, unidades.length, movimientos.length);
        const cambio = {};
        if (!fila.cuerpoEnviado && fila.codudmedida) cambio.codudmedida = "";
        if (resultadoMovimientos.status === "fulfilled" && Number(fila.liqpornumorden) && !movimientos.some(m => m.numero === Number(fila.liqpornumorden))) cambio.liqpornumorden = 0;
        if (Object.keys(cambio).length) cambiar(fila.solicitudId, cambio);
      });
    return () => { activa = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fila.numprod, bloqueada, intento]);
  const disponibles = catalogos.producto === fila.numprod && !catalogos.cargando && !catalogos.error;
  const deshabilitado = ocupado || bloqueada;
  const modificar = cambio => cambiar(fila.solicitudId, cambio);
  const producto = productos.find(item => item.numprod === fila.numprod);
  const tipos = tiposProyecto.filter(item => !item.bloqueado && ["DIRECTO", "INDIRECTO", "GRUPO"].includes(item.codigo));
  const proyectoValido = !tipos.length || tipos.some(item => item.codigo === (fila.tipoproyectocodigo || "INDIRECTO"));
  const unidadValida = !fila.cuerpoEnviado || !fila.codudmedida || catalogos.unidades.some(item => item.codigo === fila.codudmedida);
  const movimiento = catalogos.movimientos.find(item => item.numero === Number(fila.liqpornumorden));
  const movimientoValido = !Number(fila.liqpornumorden) || !!movimiento;
  const unidad = catalogos.unidades.find(item => item.codigo === (fila.cuerpoEnviado ? fila.codudmedida || producto?.codudmedida : producto?.codudmedida));
  const excede = movimiento && unidad && Number(fila.cantidad) * unidad.factor > Math.abs(movimiento.cantidadpendientebase);
  const fijos = { fecharegistro: "Fecha de BC", tipomovimiento: "Ajuste positivo", numdoc: "Asigna BC", descripcion: producto?.descripcion || fila.descripcion || "—", codalmacen: "CENTRAL 3", importedto: "Calcula BC", departamento: "SG-ALMACEN" };
  return <tr className={seleccion === fila.solicitudId ? "bc-row-selected" : ""} tabIndex={0} aria-label={`Borrador ${indice + 1}`} aria-selected={seleccion === fila.solicitudId} onPointerDownCapture={event => { if (event.target.disabled) seleccionar?.(fila.solicitudId); }} onClick={() => seleccionar?.(fila.solicitudId)} onFocus={() => seleccionar?.(fila.solicitudId)} onKeyDown={event => seleccionarConTeclado(event, () => seleccionar?.(fila.solicitudId))}>{columnas.map(([campo, titulo]) => {
    const label = `${titulo}, fila ${indice + 1}`;
    let control;
    if (Object.prototype.hasOwnProperty.call(fijos, campo)) control = fijos[campo];
    else if (bloqueada) control = ["preciounitario", "importe", "costeunitario"].includes(campo) ? (fila.modoMonetario === campo ? fila.valorMonetario : "") : fila[campo] || (campo === "codudmedida" ? "Inicializa BC" : "—");
    else if (campo === "numprod") control = <BuscadorMovimiento label={label} opciones={opcionesProductos} disabled={deshabilitado} value={fila.numprod} onChange={codigo => modificar({ numprod: codigo, codudmedida: "", liqpornumorden: 0 })} />;
    else if (campo === "codudmedida" && !catalogos.unidades.length) control = "";
    else if (campo === "codudmedida") control = <SelectorDiario aria-label={label} disabled={deshabilitado || catalogos.cargando} value={fila.codudmedida} onChange={e => modificar({ codudmedida: e.target.value })}>
      <option value="">Inicializa BC{producto?.codudmedida ? ` (${producto.codudmedida})` : ""}</option>{catalogos.unidades.map(item => <option key={item.id || item.codigo} value={item.codigo}>{item.codigo} · factor {item.factor}</option>)}
    </SelectorDiario>;
    else if (campo === "liqpornumorden" && !catalogos.movimientos.length) control = "";
    else if (campo === "liqpornumorden") control = <SelectorDiario aria-label={label} disabled={deshabilitado || catalogos.cargando} value={fila.liqpornumorden} onChange={e => modificar({ liqpornumorden: e.target.value })}>
      <option value={0}>Sin aplicación</option>{catalogos.movimientos.map(item => <option key={item.id || item.numero} value={item.numero}>{item.numero} · {item.documento} · {item.fecha} · pendiente {item.cantidadpendientebase} (base)</option>)}
    </SelectorDiario>;
    else if (campo === "tipoproyectocodigo") control = <SelectorDiario aria-label={label} disabled={deshabilitado} value={fila.tipoproyectocodigo || "INDIRECTO"} onChange={e => modificar({ tipoproyectocodigo: e.target.value })}>
      {!tipos.some(item => item.codigo === (fila.tipoproyectocodigo || "INDIRECTO")) && <option value={fila.tipoproyectocodigo || "INDIRECTO"}>{!fila.tipoproyectocodigo || fila.tipoproyectocodigo === "INDIRECTO" ? "Estructura (INDIRECTO)" : `${fila.tipoproyectocodigo} · no disponible`}</option>}{tipos.map(item => <option key={item.id || item.codigo} value={item.codigo}>{item.nombre} ({item.codigo})</option>)}
    </SelectorDiario>;
    else if (campo === "modoMonetario") control = <SelectorDiario aria-label={label} disabled={deshabilitado} value={fila.modoMonetario || "bc"} onChange={e => modificar({ modoMonetario: e.target.value, valorMonetario: "" })}>{modosMonetarios.map(([codigo, nombre]) => <option key={codigo} value={codigo}>{nombre}</option>)}</SelectorDiario>;
    else if (campo === "cantidad") control = <input aria-label={label} type="number" step="any" disabled={deshabilitado} value={fila.cantidad} onChange={e => modificar({ cantidad: e.target.value })} />;
    else control = fila.modoMonetario === campo ? <input aria-label={label} type="number" step="any" disabled={deshabilitado} value={fila.valorMonetario} onChange={e => modificar({ valorMonetario: e.target.value })} /> : "";
    return <td key={campo} data-label={titulo} title={typeof control === "string" || typeof control === "number" ? String(control) : undefined} className={[Object.prototype.hasOwnProperty.call(fijos, campo) ? "journal-fixed" : "", columnasNumericas.has(campo) ? "bc-cell-number" : ""].filter(Boolean).join(" ")}>{control}</td>;
  })}
    <td className="warehouse-row-status" data-label="Acciones">
      <div className="warehouse-row-actions">
        {fila.estado === "borrador" && <><button aria-label="Enviar a BC" title="Enviar a BC" disabled={ocupado || !disponibles || !proyectoValido || !unidadValida || !movimientoValido || excede} onClick={() => guardar(fila)}><FontAwesomeIcon icon={faPaperPlane} /></button>{!fila.cuerpoEnviado && <DeleteIconButton disabled={ocupado} label={`Eliminar borrador ${indice + 1}`} onClick={event => { event.stopPropagation(); quitar(fila.solicitudId); }} />}</>}
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
  const [opciones, setOpciones] = useState({});
  const informarCatalogos = useCallback((id, producto, unidades, movimientos) => {
    setOpciones(prev => ({ ...prev, [id]: { producto, unidades, movimientos } }));
  }, []);
  const columnas = columnasVisibles.filter(([campo]) => {
    if (["modoMonetario", "preciounitario", "importe", "costeunitario"].includes(campo)) return false;
    if (campo === "tipoproyectocodigo") return true;
    if (props.historial) return true;
    if (campo === "codudmedida") return false;
    if (campo === "descripcion") return false;
    if (["preciounitario", "importe", "costeunitario"].includes(campo)) return props.filas.some(fila => fila.modoMonetario === campo);
    if (campo === "tipoproyectocodigo") return (props.tiposProyecto || []).some(tipo => !tipo.bloqueado && ["DIRECTO", "INDIRECTO", "GRUPO"].includes(tipo.codigo));
    if (campo === "codudmedida" || campo === "liqpornumorden") return props.filas.some(fila => {
      const catalogo = opciones[fila.solicitudId];
      return (catalogo?.producto === fila.numprod && catalogo[campo === "codudmedida" ? "unidades" : "movimientos"] > 0)
        || (fila.estado !== "borrador" && !!fila[campo]);
    });
    return true;
  });
  const medidas = { numprod: 320, descripcion: 280, cantidad: 120, codudmedida: 160, tipoproyectocodigo: 220, liqpornumorden: 320, modoMonetario: 220 };
  const anchos = [...(props.historial ? [140] : []), ...columnas.map(([campo]) => medidas[campo] || 160), 220];
  const anchoTabla = anchos.reduce((total, ancho) => total + ancho, 0);
  return <div className="warehouse-table-container warehouse-journal-scroll" tabIndex="0" role="region" aria-label={props.historial ? "Historial de envíos a BC" : "Diario editable de entradas"}><table className="warehouse-journal-table warehouse-entries-table" style={{ width: anchoTabla, minWidth: anchoTabla }}>
    <caption>{props.historial ? "Enviados a BC" : "Diario de productos · Líneas pendientes de envío"}</caption>
    <colgroup>{anchos.map((ancho, indice) => <col key={indice} style={{ width: ancho }} />)}</colgroup>
    <thead><tr>{props.historial && <th scope="col" title="Fecha de creación del envío">Fecha</th>}{columnas.map(([campo, titulo]) => <th key={campo} className={columnasNumericas.has(campo) ? "bc-cell-number" : ""} scope="col" title={titulo} aria-label={titulo}>{titulo}</th>)}<th scope="col">{props.historial ? "Estado" : "Acciones"}</th></tr></thead>
    <tbody>{props.filas.map((fila, indice) => <FilaDiario {...props} columnas={columnas} informarCatalogos={informarCatalogos} key={fila.solicitudId} fila={fila} indice={indice} />)}
      {entradas.map(entrada => <tr key={entrada.id} className={props.seleccion === entrada.id ? "bc-row-selected" : ""} tabIndex={0} aria-label={`Documento ${entrada.numdoc || entrada.id}`} aria-selected={props.seleccion === entrada.id} onClick={() => { props.seleccionar?.(entrada.id); props.abrirRegistro?.(entrada); }} onFocus={() => props.seleccionar?.(entrada.id)} onKeyDown={event => seleccionarConTeclado(event, () => { props.seleccionar?.(entrada.id); props.abrirRegistro?.(entrada); })}>
        {props.historial && <td data-label="Fecha">{entrada.fechaEnvio && !Number.isNaN(new Date(entrada.fechaEnvio).getTime()) ? new Date(entrada.fechaEnvio).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—"}</td>}
        {columnas.map(([campo, titulo]) => <td key={campo} data-label={titulo} className={columnasNumericas.has(campo) ? "bc-cell-number" : ""} title={String(entrada[campo] ?? "")}>{entrada[campo] ?? "—"}</td>)}
        <td className="warehouse-row-status" data-label="Estado"><span className="bc-line-status" title="Recepción confirmada por BC. Selecciona la línea para registrarla.">Enviada a BC</span></td>
      </tr>)}
      {!props.filas.length && !entradas.length && <tr><td colSpan={columnas.length + (props.historial ? 2 : 1)} className="bc-empty">{props.historial ? "Todavía no hay envíos confirmados a BC." : "No hay líneas. Pulsa Nueva línea para empezar."}</td></tr>}
    </tbody>
  </table></div>;
}
