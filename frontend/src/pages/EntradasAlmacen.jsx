import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import DiarioAlmacen, { columnasDiario } from "../components/DiarioAlmacen";
import * as servicio from "../services/almacen";
import "./Almacen.css";

export default function EntradasAlmacen() {
  const [configuracion, setConfiguracion] = useState(null);
  const [productos, setProductos] = useState([]);
  const [filas, setFilas] = useState([]);
  const [historico, setHistorico] = useState({ entradas: [], total: 0 });
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError("");
    Promise.all([servicio.obtenerConfiguracion(), servicio.obtenerProductos()]).then(([config, items]) => {
      if (activo) { setConfiguracion(config); setProductos(items); }
    }).catch(err => { if (activo) setError(err.response?.data?.error || "No se pudieron cargar los productos de Business Central."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intento]);
  useEffect(() => {
    let activo = true;
    servicio.obtenerEntradas(pagina).then(data => { if (activo) setHistorico(data); })
      .catch(() => { if (activo) setError("No se pudieron cargar las entradas guardadas."); });
    return () => { activo = false; };
  }, [pagina, intento]);
  useEffect(() => {
    const avisar = event => { if (filas.length) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [filas.length]);
  const cambiar = (id, cambio) => setFilas(actuales => actuales.map(fila => fila.solicitudId === id ? { ...fila, ...cambio, error: "" } : fila));
  const nueva = () => setFilas(actuales => [...actuales, {
    solicitudId: crypto.randomUUID(), fechaRegistro: new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date()),
    tipoMovimiento: "ajustePositivo", numeroProducto: "", descripcion: "", codigoAlmacen: configuracion.codigoAlmacen,
    cantidad: "", unidadMedida: "", precioUnitario: "0", importe: "0", importeDto: "0", costeUnitario: "0",
    liquidacionOrden: "", tipoProyecto: "Indirecto", departamento: configuracion.departamento
  }]);
  const guardar = async fila => {
    if (!fila.numeroProducto || !fila.unidadMedida.trim() || Number(fila.cantidad) <= 0 ||
      ["cantidad", "precioUnitario", "importe", "importeDto", "costeUnitario"].some(campo => fila[campo] === "" || !Number.isFinite(Number(fila[campo])) || Number(fila[campo]) < 0)) {
      cambiar(fila.solicitudId, { error: "Selecciona producto, unidad y cantidad mayor que cero. Los importes deben ser números no negativos." }); return;
    }
    setOcupado(true); setMensaje("");
    try {
      const entrada = await servicio.guardarEntrada(fila);
      setFilas(actuales => actuales.filter(item => item.solicitudId !== fila.solicitudId));
      setMensaje(`${entrada.numeroDocumento} guardado. Pendiente de envío a Business Central.`);
      try { setHistorico(await servicio.obtenerEntradas(pagina)); }
      catch (_) { setError("Entrada guardada, pero no se pudo actualizar la lista. Pulsa Reintentar."); }
    } catch (err) { cambiar(fila.solicitudId, { error: err.response?.data?.error || "No se pudo guardar. Reintenta la misma fila para evitar duplicados." }); }
    finally { setOcupado(false); }
  };
  return <Layout>
    <div className="page-header"><Link className="back-link" to="/material/almacen" onClick={event => { if (filas.length && !window.confirm("Hay filas sin guardar. ¿Quieres salir y descartarlas?")) event.preventDefault(); }}>← Almacén</Link><h1>Añadir Material al Almacén</h1><p className="page-subtitle">Diario de productos · CENTRAL 3 · SG-ALMACEN</p></div>
    <div className="page-content warehouse-page">
      <p className="journal-notice">Las entradas se guardan pendientes de envío a Business Central. Todavía no actualizan el stock. El nº de documento y la fecha definitiva se asignan al guardar.</p>
      {error && <div role="alert" className="journal-error">{error} <button disabled={ocupado} onClick={() => setIntento(valor => valor + 1)}>Reintentar</button></div>}
      {mensaje && <p role="status">{mensaje}</p>}
      <div className="journal-toolbar"><button onClick={nueva} disabled={cargando || ocupado || !configuracion || !productos.length}>+ Nueva línea</button><span>{filas.length} filas sin guardar</span></div>
      {cargando ? <p role="status">Cargando productos…</p> : !productos.length && !error ? <p>No hay productos disponibles en Business Central.</p> : null}
      {filas.length > 0 && <DiarioAlmacen {...{ filas, productos, configuracion, cambiar, guardar, ocupado }} quitar={id => setFilas(actuales => actuales.filter(fila => fila.solicitudId !== id))} />}
      <h2>Entradas guardadas</h2>
      <div className="journal-scroll" tabIndex="0" role="region" aria-label="Entradas guardadas"><table className="journal-table"><thead><tr>{columnasDiario.map(([campo, titulo]) => <th key={campo} scope="col">{titulo}</th>)}<th scope="col">Estado</th></tr></thead><tbody>{historico.entradas.map(entrada => <tr key={entrada._id}>{columnasDiario.map(([campo]) => <td key={campo}>{campo === "tipoMovimiento" ? "Ajuste Positivo" : entrada[campo]}</td>)}<td>{({ pendienteBC: "Pendiente de envío a BC", enviadoBC: "Enviado a BC", registradoBC: "Registrado en BC", errorBC: "Error de sincronización" })[entrada.estado]}</td></tr>)}</tbody></table></div>
      {!historico.total && <p>No hay entradas guardadas.</p>}
      <div className="journal-toolbar"><button disabled={pagina === 1 || ocupado} onClick={() => setPagina(valor => valor - 1)}>Anterior</button><span>Página {pagina} · {historico.total} entradas</span><button disabled={pagina * 50 >= historico.total || ocupado} onClick={() => setPagina(valor => valor + 1)}>Siguiente</button></div>
    </div>
  </Layout>;
}
