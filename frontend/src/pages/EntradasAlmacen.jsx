import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import Layout from "../components/Layout";
import DiarioAlmacen from "../components/DiarioAlmacen";
import ModalShell from "../components/ModalShell";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPlus, faRotate, faCheck, faFileCircleCheck } from "@fortawesome/free-solid-svg-icons";
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
  const [entradas, setEntradas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [seleccion, setSeleccion] = useState(null);
  const [confirmarRegistro, setConfirmarRegistro] = useState(null);
  const claveRegistros = `${clave}:registros`;
  const [inicialRegistros] = useState(() => leerBorradores(claveRegistros));
  const [registros, setRegistros] = useState(inicialRegistros.filas);
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
    Promise.allSettled([servicio.obtenerProductos(), servicio.obtenerTiposProyecto(), servicio.obtenerEntradas(), servicio.obtenerOperaciones(), servicio.obtenerRegistrosPendientes()])
      .then(resultados => {
        if (!activo) return;
        const [items, tipos, listado, operaciones, registrosServidor] = resultados;
        if (items.status === "fulfilled") setProductos(items.value);
        if (tipos.status === "fulfilled") setTiposProyecto(tipos.value);
        if (listado.status === "fulfilled") setEntradas(listado.value);
        if (registrosServidor.status === "fulfilled") setRegistros(actuales => {
          const mapa = new Map(actuales.map(item => [item.id, item]));
          registrosServidor.value.forEach(op => mapa.set(op.cuerpo.idlinea, { ...mapa.get(op.cuerpo.idlinea), id: op.cuerpo.idlinea, claveintegracion: op.cuerpo.claveintegracion, estadoRegistro: op.estado, errorRegistro: op.error }));
          const recuperados = [...mapa.values()];
          try { localStorage.setItem(claveRegistros, JSON.stringify(recuperados)); } catch (_) { setErrorStorage("No se puede conservar el registro pendiente en el navegador."); }
          return recuperados;
        });
        const fallos = resultados.filter(item => item.status === "rejected");
        if (fallos.length) setError(fallos.map(item => item.reason.response?.data?.error || "No se pudieron cargar todos los datos del diario.").join(" "));
        const recuperadas = new Map(filasRef.current.map(fila => [fila.solicitudId, fila]));
        if (operaciones.status === "fulfilled") operaciones.value.forEach(op => recuperadas.set(op.solicitudId, filaDesdeOperacion(op)));
        const nuevas = [...recuperadas.values()];
        try { localStorage.setItem(clave, JSON.stringify(nuevas)); filasRef.current = nuevas; setFilas(nuevas); }
        catch (_) { setErrorStorage("No se pueden conservar las operaciones en el navegador. Comprueba el almacenamiento."); }
      }).catch(err => { if (activo) setError(err.response?.data?.error || "No se pudieron cargar los datos del diario de Business Central."); })
      .finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intento, clave, claveRegistros]);
  const nueva = () => {
    const solicitudId = crypto.randomUUID();
    if (persistir([...filasRef.current, { solicitudId, estado: "borrador", numprod: "", cantidad: "", codudmedida: "", liqpornumorden: "", tipoproyectocodigo: "INDIRECTO", modoMonetario: "bc", valorMonetario: "" }])) setSeleccion(solicitudId);
  };
  const corregir = fila => persistir(filasRef.current.map(item => item.solicitudId === fila.solicitudId ? { ...item, solicitudId: crypto.randomUUID(), estado: "borrador", cuerpoEnviado: undefined, error: "", codigoError: undefined, proximoIntento: null } : item));
  const guardar = async fila => {
    if (enVuelo.current || errorStorage) return;
    let cuerpo;
    try { cuerpo = fila.cuerpoEnviado || prepararEntrada(fila); }
    catch (err) { cambiar(fila.solicitudId, { error: err.message }); return; }
    if (!cambiar(fila.solicitudId, { estado: "procesando", cuerpoEnviado: cuerpo })) return;
    enVuelo.current = true; setOcupado(true); setMensaje("");
    try {
      const resultado = await servicio.guardarEntrada(cuerpo);
      if (resultado.estado === "creada") {
        persistir(filasRef.current.filter(item => item.solicitudId !== fila.solicitudId));
        setMensaje(`Entrada creada en el diario, pendiente de registrar. Documento ${resultado.respuesta.numdoc}.`);
        setEntradas(actuales => [resultado.respuesta, ...actuales.filter(item => item.id !== resultado.respuesta.id)]);
        setPagina(1);
        setSeleccion(resultado.respuesta.id);
      } else cambiar(fila.solicitudId, { estado: resultado.estado, error: resultado.error, proximoIntento: resultado.proximoIntento });
    } catch (err) {
      const data = err.response?.data;
      const estado = data?.estado || (data?.codigoError === "GM_KEY_CONFLICT" || data?.codigoError === "GM_ENTRY_GONE" ? "bloqueada" : data?.definitivo ? "rechazada" : "incierta");
      cambiar(fila.solicitudId, { estado, codigoError: data?.codigoError, error: data?.error || "Resultado pendiente de confirmar. Reintenta esta misma operación.", proximoIntento: data?.proximoIntento });
    } finally { enVuelo.current = false; setOcupado(false); }
  };
  const persistirRegistros = nuevos => {
    try { localStorage.setItem(claveRegistros, JSON.stringify(nuevos)); setRegistros(nuevos); return true; }
    catch (_) { setErrorStorage("No se puede conservar la solicitud de registro. No se ha iniciado el envío."); return false; }
  };
  const registrar = async entrada => {
    if (enVuelo.current || errorStorage || inicialRegistros.error) return;
    const pendiente = { ...entrada, estadoRegistro: "procesando", errorRegistro: "" };
    const pendientes = [...registros.filter(item => item.id !== entrada.id), pendiente];
    if (!persistirRegistros(pendientes)) return;
    enVuelo.current = true; setOcupado(true); setConfirmarRegistro(null); setMensaje("");
    try {
      const resultado = await servicio.registrarEntrada(entrada);
      if (resultado.estado === "creada" && resultado.respuesta?.registrado === true) {
        persistirRegistros(pendientes.filter(item => item.id !== entrada.id));
        setEntradas(actuales => actuales.filter(item => item.id !== entrada.id));
        setSeleccion(null);
        setMensaje(`Documento ${resultado.respuesta.numdoc} registrado en Business Central. BC ha contabilizado la entrada.`);
      } else persistirRegistros(pendientes.map(item => item.id === entrada.id ? { ...item, estadoRegistro: resultado.estado, errorRegistro: resultado.error || "Resultado pendiente de confirmar. Reintenta el registro de esta misma línea." } : item));
    } catch (err) {
      const data = err.response?.data;
      persistirRegistros(pendientes.map(item => item.id === entrada.id ? { ...item, estadoRegistro: data?.estado || "incierta", errorRegistro: data?.error || "Resultado pendiente de confirmar. Reintenta esta misma línea; no crees otra entrada." } : item));
    } finally { enVuelo.current = false; setOcupado(false); }
  };
  const lineasBC = new Map(entradas.map(entrada => [entrada.id, entrada]));
  registros.forEach(registro => lineasBC.set(registro.id, { ...lineasBC.get(registro.id), ...registro }));
  const visibles = [...lineasBC.values()];
  const lineaSeleccionada = lineasBC.get(seleccion);
  const borradorSeleccionado = filas.find(fila => fila.solicitudId === seleccion);
  const descripcionSeleccionada = lineaSeleccionada?.descripcion || productos.find(item => item.number === borradorSeleccionado?.numprod)?.displayName;
  return <Layout>
    <section className="bc-journal-page">
    <header className="page-header"><Link className="back-link" to="/material/almacen">← Almacén</Link><h1>Añadir Material al Almacén</h1><p className="page-subtitle">Diario de productos · CENTRAL 3 · SG-ALMACEN</p></header>
    <div className="page-content bc-journal-card">
    <div className="bc-command-bar">
      <button disabled={ocupado || cargando || !!errorStorage || !!inicialRegistros.error || !lineaSeleccionada?.claveintegracion || lineaSeleccionada?.estadoRegistro === "bloqueada"} onClick={() => setConfirmarRegistro(lineaSeleccionada)}><FontAwesomeIcon icon={faFileCircleCheck} /> {lineaSeleccionada?.estadoRegistro ? "Reintentar registro" : "Registrar"}</button>
      <button onClick={nueva} disabled={cargando || ocupado || !!error || !!errorStorage || !productos.length || !tiposProyecto.length}><FontAwesomeIcon icon={faPlus} /> Nueva línea</button>
      <button disabled={ocupado || cargando} onClick={() => setIntento(valor => valor + 1)}><FontAwesomeIcon icon={faRotate} /> Actualizar datos</button>
      <span className="bc-save-state"><FontAwesomeIcon icon={faCheck} /> {ocupado ? "Procesando…" : filas.length ? "Borradores conservados" : "Actualizado"}</span>
    </div>
    <div className="bc-journal-content warehouse-page">
      <p className="bc-journal-help">Guarda el borrador y selecciona su línea para Registrar. Registrar contabiliza únicamente la línea seleccionada y actualiza sus existencias en BC.</p>
      {errorStorage && <p role="alert" className="journal-error">{errorStorage}</p>}
      {inicialRegistros.error && <p role="alert" className="journal-error">{inicialRegistros.error}</p>}
      {error && <p role="alert" className="journal-error">{error}</p>}
      {mensaje && <p role="status">{mensaje}</p>}
      {cargando && <p role="status">Cargando diario y catálogos…</p>}
      <DiarioAlmacen {...{ filas, productos, tiposProyecto, cambiar, guardar, corregir, seleccion }} seleccionar={setSeleccion} entradas={visibles.slice((pagina - 1) * 50, pagina * 50)} ocupado={ocupado || cargando || !!errorStorage} quitar={id => persistir(filasRef.current.filter(fila => fila.solicitudId !== id))} />
      <div className="bc-journal-footer"><span>{filas.length} borradores · {visibles.length} líneas de BC</span><div><button disabled={pagina === 1} onClick={() => setPagina(valor => valor - 1)}>Anterior</button><span> Página {pagina} </span><button disabled={pagina * 50 >= visibles.length} onClick={() => setPagina(valor => valor + 1)}>Siguiente</button></div></div>
      <aside className="bc-journal-detail"><strong>Descripción producto</strong><p>{descripcionSeleccionada || "Selecciona una línea para ver su descripción"}</p>{lineaSeleccionada && <small>Cantidad base: {lineaSeleccionada.cantidadbase ?? "—"} · Factor unidad: {lineaSeleccionada.factorunidad ?? "—"} · Dimensiones: {lineaSeleccionada.conjuntodimensiones ?? "—"}</small>}</aside>
    </div>
    </div>
    </section>
    {confirmarRegistro && <ModalShell ariaLabel="Registrar entrada en Business Central" onClose={() => setConfirmarRegistro(null)}><h2>Registrar entrada</h2><p>Se registrará únicamente el documento <strong>{confirmarRegistro.numdoc || confirmarRegistro.id}</strong>, producto <strong>{confirmarRegistro.numprod || "de la solicitud original"}</strong>, cantidad <strong>{confirmarRegistro.cantidad ?? "de la solicitud original"}</strong>.</p><p>Esta acción contabiliza la entrada y modifica las existencias en BC. Si ya se registró mediante esta solicitud, se recuperará su confirmación sin duplicarla.</p><div className="modal-buttons"><button onClick={() => setConfirmarRegistro(null)}>Cancelar</button><button onClick={() => registrar(confirmarRegistro)}>Confirmar registro</button></div></ModalShell>}
  </Layout>;
}
