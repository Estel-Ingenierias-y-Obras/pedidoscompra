import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Layout from "../components/Layout";
import DiarioAlmacen from "../components/DiarioAlmacen";
import NotificationToast from "../components/NotificationToast";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faCheck, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import ActualizarDatosButton from "../components/ActualizarDatosButton";
import * as servicio from "../services/almacen";
import { prepararEntrada, filaDesdeOperacion } from "../services/almacenPayload";
import "./Almacen.css";

function leerBorradores(clave) {
  try {
    const filas = JSON.parse(localStorage.getItem(clave) || "[]");
    if (!Array.isArray(filas)) throw new Error();
    return { filas, error: "" };
  } catch (_) { return { filas: [], error: "No se pudieron recuperar los borradores del navegador. Revisa el almacenamiento antes de crear otra entrada." }; }
}

export default function EntradasAlmacen() {
  const { user } = useContext(AuthContext);
  const clave = `almacen-entradas-v2:${user.email.toLowerCase()}`;
  const [inicial] = useState(() => leerBorradores(clave));
  const [filas, setFilas] = useState(inicial.filas);
  const filasRef = useRef(inicial.filas);
  const [errorStorage, setErrorStorage] = useState(inicial.error);
  const [productos, setProductos] = useState([]);
  const onProducto = useCallback(item => {
    const codigos = new Set(filasRef.current.map(fila => fila.numprod));
    setProductos(prev => [...prev.filter(p => p.numprod !== item.numprod && codigos.has(p.numprod)), item]);
  }, []);
  const [tiposProyecto, setTiposProyecto] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const enVuelo = useRef(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [intento, setIntento] = useState(0);
  // Persistir sincronamente ANTES del POST, incluido el cuerpo inmutable enviado.
  const persistir = nuevas => {
    try { localStorage.setItem(clave, JSON.stringify(nuevas)); }
    catch (_) { setErrorStorage("No se puede guardar la identidad de la operación en este navegador. No se enviarán nuevas solicitudes."); return false; }
    filasRef.current = nuevas; setFilas(nuevas); return true;
  };
  const cambiar = (id, cambio) => persistir(filasRef.current.map(fila => fila.solicitudId === id ? { ...fila, error: "", ...cambio } : fila));
  useEffect(() => {
    let activo = true;
    setCargando(true); setError("");
    setProductos([]);
    Promise.allSettled([servicio.obtenerTiposProyecto(), servicio.obtenerOperaciones(), servicio.obtenerEnviados()])
      .then(resultados => {
        if (!activo) return;
        const [tipos, operaciones, enviados] = resultados;
        if (tipos.status === "fulfilled") setTiposProyecto(tipos.value);
        const fallos = resultados.filter(item => item.status === "rejected");
        if (fallos.length) setError(fallos.map(item => item.reason.response?.data?.error || item.reason.message || "No se pudieron cargar todos los datos del diario.").join(" "));
        const recuperadas = new Map(filasRef.current.map(fila => [fila.solicitudId, fila]));
        if (operaciones.status === "fulfilled") operaciones.value.forEach(op => recuperadas.set(op.solicitudId, filaDesdeOperacion(op)));
        const confirmadas = new Set(enviados.status === "fulfilled" ? enviados.value.map(op => op.solicitudId) : []);
        const nuevas = [...recuperadas.values()].filter(fila => !confirmadas.has(fila.solicitudId));
        try { localStorage.setItem(clave, JSON.stringify(nuevas)); filasRef.current = nuevas; setFilas(nuevas); }
        catch (_) { setErrorStorage("No se pueden conservar las operaciones en el navegador. Comprueba el almacenamiento."); }
      }).catch(err => { if (activo) setError(err.response?.data?.error || "No se pudieron cargar los datos del diario de Business Central."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intento, clave]);
  const nueva = () => {
    const solicitudId = crypto.randomUUID();
    if (persistir([...filasRef.current, { solicitudId, estado: "borrador", numprod: "", cantidad: "", codudmedida: "", liqpornumorden: 0, tipoproyectocodigo: "INDIRECTO", modoMonetario: "bc", valorMonetario: "" }])) setSeleccion(solicitudId);
  };
  const quitar = id => {
    const fila = filasRef.current.find(item => item.solicitudId === id);
    if (enVuelo.current || !fila || fila.estado !== "borrador" || fila.cuerpoEnviado) return;
    if (persistir(filasRef.current.filter(item => item.solicitudId !== id)) && seleccion === id) setSeleccion(null);
  };
  const corregir = fila => persistir(filasRef.current.map(item => item.solicitudId === fila.solicitudId ? { ...item, solicitudId: crypto.randomUUID(), estado: "borrador", cuerpoEnviado: undefined, error: "", codigoError: undefined, proximoIntento: null } : item));
  const guardar = async fila => {
    if (enVuelo.current || errorStorage) return;
    let cuerpo;
    // Los nuevos envíos usan los valores de BC; los reintentos conservan su cuerpo original.
    try { cuerpo = fila.cuerpoEnviado || prepararEntrada({ ...fila, codudmedida: "", modoMonetario: "bc", valorMonetario: "", tipoproyectocodigo: fila.tipoproyectocodigo || "INDIRECTO" }); }
    catch (err) { cambiar(fila.solicitudId, { error: err.message }); return; }
    if (!cambiar(fila.solicitudId, { estado: "procesando", cuerpoEnviado: cuerpo })) return;
    enVuelo.current = true; setOcupado(true); setMensaje("");
    try {
      const resultado = await servicio.guardarEntrada(cuerpo);
      if (resultado.estado === "creada") {
        persistir(filasRef.current.filter(item => item.solicitudId !== fila.solicitudId));
        setSeleccion(null);
        setMensaje("Línea enviada a Business Central correctamente");
      } else cambiar(fila.solicitudId, { estado: resultado.estado, error: resultado.error, proximoIntento: resultado.proximoIntento });
    } catch (err) {
      const data = err.response?.data;
      const estado = data?.estado || (data?.codigoError === "GM_KEY_CONFLICT" || data?.codigoError === "GM_ENTRY_GONE" ? "bloqueada" : data?.definitivo ? "rechazada" : "incierta");
      cambiar(fila.solicitudId, { estado, codigoError: data?.codigoError, error: data?.error || "Resultado pendiente de confirmar. Reintenta esta misma operación.", proximoIntento: data?.proximoIntento });
    } finally { enVuelo.current = false; setOcupado(false); }
  };
  return <Layout>
    <NotificationToast message={mensaje} onClose={() => setMensaje("")} />
    <section className="bc-journal-page">
    <header className="page-header"><Link className="back-link" to="/material/almacen">← Almacén</Link><h1>Diario de productos</h1><p className="page-subtitle">Diario de productos · CENTRAL 3 · SG-ALMACEN</p></header>
    <div className="page-content bc-journal-card">
    <div className="bc-command-bar">
      <button onClick={nueva} disabled={cargando || ocupado || !!error || !!errorStorage || !tiposProyecto.length}><FontAwesomeIcon icon={faPlus} /> Nueva línea</button>
      <ActualizarDatosButton disabled={ocupado || cargando} onClick={() => setIntento(valor => valor + 1)} />
      <Link className="bc-command-link" to="/material/almacen/enviados"><FontAwesomeIcon icon={faClockRotateLeft} /> Enviados a BC</Link>
      <span className="bc-save-state"><FontAwesomeIcon icon={faCheck} /> {ocupado ? "Procesando…" : filas.length ? "Borradores conservados" : "Actualizado"}</span>
    </div>
    <div className="bc-journal-content warehouse-page">
      {errorStorage && <p role="alert" className="journal-error">{errorStorage}</p>}
      {error && <p role="alert" className="journal-error">{error}</p>}
      {cargando && <p role="status">Cargando diario y catálogos…</p>}
      <DiarioAlmacen {...{ filas, productos, tiposProyecto, cambiar, guardar, corregir, seleccion, onProducto }} buscarProductos seleccionar={setSeleccion} ocupado={ocupado || cargando || !!errorStorage} quitar={quitar} />
    </div>
    </div>
    </section>
  </Layout>;
}
