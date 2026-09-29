import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Layout from "../components/Layout";
import DiarioAlmacen from "../components/DiarioAlmacen";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faRotate, faCheck, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
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
  const [tiposProyecto, setTiposProyecto] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const enVuelo = useRef(false);
  const [error, setError] = useState("");
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
    Promise.allSettled([servicio.obtenerProductos(), servicio.obtenerTiposProyecto(), servicio.obtenerOperaciones(), servicio.obtenerEnviados()])
      .then(resultados => {
        if (!activo) return;
        const [items, tipos, operaciones, enviados] = resultados;
        if (items.status === "fulfilled") setProductos(items.value);
        if (tipos.status === "fulfilled") setTiposProyecto(tipos.value);
        const fallos = resultados.filter(item => item.status === "rejected");
        if (fallos.length) setError(fallos.map(item => item.reason.response?.data?.error || "No se pudieron cargar todos los datos del diario.").join(" "));
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
    if (persistir([...filasRef.current, { solicitudId, estado: "borrador", numprod: "", cantidad: "", codudmedida: "", liqpornumorden: "", tipoproyectocodigo: "INDIRECTO", modoMonetario: "bc", valorMonetario: "" }])) setSeleccion(solicitudId);
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
    try { cuerpo = fila.cuerpoEnviado || prepararEntrada({ ...fila, modoMonetario: "bc", valorMonetario: "" }); }
    catch (err) { cambiar(fila.solicitudId, { error: err.message }); return; }
    if (!cambiar(fila.solicitudId, { estado: "procesando", cuerpoEnviado: cuerpo })) return;
    enVuelo.current = true; setOcupado(true);
    try {
      const resultado = await servicio.guardarEntrada(cuerpo);
      if (resultado.estado === "creada") {
        persistir(filasRef.current.filter(item => item.solicitudId !== fila.solicitudId));
        setSeleccion(null);
      } else cambiar(fila.solicitudId, { estado: resultado.estado, error: resultado.error, proximoIntento: resultado.proximoIntento });
    } catch (err) {
      const data = err.response?.data;
      const estado = data?.estado || (data?.codigoError === "GM_KEY_CONFLICT" || data?.codigoError === "GM_ENTRY_GONE" ? "bloqueada" : data?.definitivo ? "rechazada" : "incierta");
      cambiar(fila.solicitudId, { estado, codigoError: data?.codigoError, error: data?.error || "Resultado pendiente de confirmar. Reintenta esta misma operación.", proximoIntento: data?.proximoIntento });
    } finally { enVuelo.current = false; setOcupado(false); }
  };
  return <Layout>
    <section className="bc-journal-page">
    <header className="page-header"><Link className="back-link" to="/material/almacen">← Almacén</Link><h1>Añadir Material al Almacén</h1><p className="page-subtitle">Diario de productos · CENTRAL 3 · SG-ALMACEN</p></header>
    <div className="page-content bc-journal-card">
    <div className="bc-command-bar">
      <button onClick={nueva} disabled={cargando || ocupado || !!error || !!errorStorage || !productos.length || !tiposProyecto.length}><FontAwesomeIcon icon={faPlus} /> Nueva línea</button>
      <button disabled={ocupado || cargando} onClick={() => setIntento(valor => valor + 1)}><FontAwesomeIcon icon={faRotate} /> Actualizar datos</button>
      <Link className="bc-command-link" to="/material/almacen/enviados"><FontAwesomeIcon icon={faClockRotateLeft} /> Enviados a BC</Link>
      <span className="bc-save-state"><FontAwesomeIcon icon={faCheck} /> {ocupado ? "Procesando…" : filas.length ? "Borradores conservados" : "Actualizado"}</span>
    </div>
    <div className="bc-journal-content warehouse-page">
      {errorStorage && <p role="alert" className="journal-error">{errorStorage}</p>}
      {error && <p role="alert" className="journal-error">{error}</p>}
      {cargando && <p role="status">Cargando diario y catálogos…</p>}
      <DiarioAlmacen {...{ filas, productos, tiposProyecto, cambiar, guardar, corregir, seleccion }} seleccionar={setSeleccion} ocupado={ocupado || cargando || !!errorStorage} quitar={quitar} />
    </div>
    </div>
    </section>
  </Layout>;
}
