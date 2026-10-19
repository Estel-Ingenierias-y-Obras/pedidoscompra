import { useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import ActualizarDatosButton from "../components/ActualizarDatosButton";
import CabeceraMovimiento from "../components/CabeceraMovimiento";
import LineasMovimiento from "../components/LineasMovimiento";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import { construirMovimiento, enviarMovimiento, recuperarBorradorMovimiento, validarMovimiento } from "../services/movimientosAlmacen";
import "./Almacen.css";
export { validarMovimiento } from "../services/movimientosAlmacen";

const nuevo = () => ({ solicitudId: crypto.randomUUID(), estado: "borrador", serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "", tipodestino: "Job", destino: "", solicitante: "", tipoproyectocodigo: "", departamento: "", zona: "" }, lineas: [] });
export default function MovimientosAlmacen() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const clave = `almacen-movimientos-v1:${user.email.toLowerCase()}`;
  const [documento, setDocumento] = useState(nuevo);
  const [catalogos, setCatalogos] = useState({});
  const [proyectos, setProyectos] = useState([]);
  const [errores, setErrores] = useState([]);
  const [storageError, setStorageError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const enVuelo = useRef(false);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(clave);
      if (guardado) {
        const valor = JSON.parse(guardado);
        if (!valor.cabecera || !Array.isArray(valor.lineas)) throw Error();
        const limpio = { ...valor, estado: valor.estado === "error" ? "error" : "borrador", solicitudId: valor.solicitudId || crypto.randomUUID(), serie: "ACO-ALM", lineas: valor.lineas.map(({ id, numprod, cantidad }) => ({ id, numprod, cantidad })) };
        localStorage.setItem(clave, JSON.stringify(limpio));
        setDocumento(limpio);
      } else setDocumento(nuevo());
      setStorageError("");
    } catch (_) { setStorageError("No se pudo recuperar el borrador. No se sobrescribirá el contenido guardado."); }
  }, [clave]);
  useEffect(() => {
    let activo = true;
    setCargando(true);
    Promise.allSettled([api.get("/api/almacen/movimientos/catalogos"), api.get("/api/proyectos", { params: { soloAbiertos: true } })]).then(([datos, obras]) => {
      if (!activo) return;
      const fallos = [];
      if (datos.status === "fulfilled") {
        setCatalogos(datos.value.data);
        Object.entries(datos.value.data.errores || {}).forEach(([nombre, mensaje]) => fallos.push(`${nombre}: ${mensaje}`));
      } else { setCatalogos({}); fallos.push("No se pudieron cargar los catálogos de BC."); }
      if (obras.status === "fulfilled") {
        const lista = Array.isArray(obras.value.data) ? obras.value.data : obras.value.data.value;
        if (Array.isArray(lista)) setProyectos(lista
          .filter(item => item.status === "Open" && typeof item.blocked === "string" && !item.blocked.trim() && item.complete === false)
          .map(item => ({ codigo: item.nomProyecto, nombre: item.descProyecto }))
          .filter(item => item.codigo));
        else fallos.push("El catálogo de proyectos no tiene un formato válido.");
      } else { setProyectos([]); fallos.push("No se pudieron cargar los proyectos de BC. Pulsa Actualizar datos para reintentar."); }
      setErrores(fallos); setCargando(false);
    });
    return () => { activo = false; };
  }, [intento]);
  const persistir = valor => {
    if (storageError || enVuelo.current) return;
    const envioAnterior = documento.envioAnterior || (documento.resultadoIncierto
      ? { solicitudId: documento.solicitudId, cuerpoEnviado: documento.cuerpoEnviado } : undefined);
    const borrador = { ...valor, estado: "borrador", error: "", resultadoIncierto: false, cuerpoEnviado: undefined, envioAnterior };
    try { localStorage.setItem(clave, JSON.stringify(borrador)); setDocumento(borrador); }
    catch (_) { setStorageError("No se pudo guardar el borrador en este navegador."); }
  };
  const cambiarCabecera = cambio => persistir({ ...documento, cabecera: { ...documento.cabecera, ...cambio } });
  useEffect(() => {
    if (cargando || errores.length || storageError || documento.resultadoIncierto || !Array.isArray(catalogos.recursos)) return;
    const cabecera = { ...documento.cabecera };
    for (const lado of ["origen", "destino"]) {
      if (cabecera[`tipo${lado}`] === "Job" && cabecera[lado] && !proyectos.some(p => p.codigo === cabecera[lado])) cabecera[lado] = "";
    }
    if (cabecera.solicitante && !catalogos.recursos.some(r => r.codigo === cabecera.solicitante)) cabecera.solicitante = "";
    if (JSON.stringify(cabecera) === JSON.stringify(documento.cabecera)) return;
    const valor = { ...documento, cabecera };
    try { localStorage.setItem(clave, JSON.stringify(valor)); setDocumento(valor); }
    catch (_) { setStorageError("No se pudo guardar el borrador en este navegador."); }
  }, [cargando, errores, storageError, catalogos, proyectos, documento, clave]);
  const errorValidacion = validarMovimiento(documento);
  const enviar = async () => {
    if (enVuelo.current || storageError || errorValidacion || cargando || errores.length) return;
    enVuelo.current = true; setEnviando(true);
    let pendiente;
    let solicitudEnviada = false;
    try {
      let actual = documento;
      if (documento.envioAnterior) {
        const anterior = documento.envioAnterior;
        const comprobacion = await recuperarBorradorMovimiento(anterior.solicitudId);
        if (comprobacion.editable !== true || comprobacion.solicitudId !== anterior.solicitudId) throw new Error("No se ha podido comprobar el envío anterior en BC.");
        localStorage.setItem(`${clave}:incidencia:${anterior.solicitudId}`, JSON.stringify(anterior));
        actual = { ...documento, solicitudId: crypto.randomUUID(), envioAnterior: undefined, cuerpoEnviado: undefined };
      }
      pendiente = { ...actual, cuerpoEnviado: actual.cuerpoEnviado || construirMovimiento(actual), resultadoIncierto: true, error: "" };
      localStorage.setItem(clave, JSON.stringify(pendiente)); setDocumento(pendiente);
      solicitudEnviada = true;
      const resultado = await enviarMovimiento(pendiente);
      if (resultado.estado !== "enviadoBC" || resultado.confirmadoBC !== true || resultado.solicitudId !== pendiente.solicitudId || !/^[0-9a-f-]{36}$/i.test(resultado.bcId || "") || !resultado.numero || resultado.registrado !== false) throw new Error("BC no ha confirmado la creación del movimiento. Reintenta la misma solicitud.");
      const limpio = nuevo(); localStorage.setItem(clave, JSON.stringify(limpio)); setDocumento(limpio);
      navigate("/material/almacen/movimientos/enviados");
    } catch (error) {
      const status = error.response?.status;
      const incierto = solicitudEnviada && !(status === 501 || (status >= 400 && status < 500 && ![408, 409, 429].includes(status)));
      const fallido = { ...(pendiente || documento), estado: "error", resultadoIncierto: !!incierto, cuerpoEnviado: incierto ? pendiente.cuerpoEnviado : undefined, error: error.response?.data?.error || error.message || "No se pudo confirmar el envío a BC." };
      setDocumento(fallido);
      try { localStorage.setItem(clave, JSON.stringify(fallido)); } catch (_) { setStorageError("No se pudo conservar el resultado del envío. No vuelvas a crear el movimiento; revisa el resultado en BC."); }
    } finally { enVuelo.current = false; setEnviando(false); }
  };
  const indirecto = (catalogos.tiposProyecto || []).find(item => String(item.codigo).toUpperCase() === "INDIRECTO");
  useEffect(() => {
    if (indirecto && !documento.cabecera.tipoproyectocodigo && !storageError && !documento.resultadoIncierto) {
      const valor = { ...documento, cabecera: { ...documento.cabecera, tipoproyectocodigo: indirecto.codigo } };
      try { localStorage.setItem(clave, JSON.stringify(valor)); setDocumento(valor); }
      catch (_) { setStorageError("No se pudo guardar el borrador en este navegador."); }
    }
  }, [indirecto, documento, clave, storageError]);
  return <Layout><section className="bc-journal-page"><header className="page-header"><Link className="back-link" to="/material/almacen">← Almacén</Link><h1>Movimientos de Almacén</h1><p className="page-subtitle">Acopio de materiales entre almacenes y proyectos</p></header>
    <div className="page-content bc-journal-card"><div className="bc-command-bar">
      <button className="movement-send" disabled={cargando || enviando || !!storageError || !!errorValidacion || !!errores.length} onClick={enviar}><FontAwesomeIcon icon={faPaperPlane} /> {enviando ? "Enviando…" : "Enviar a BC"}</button>
      <button disabled={cargando || enviando || !!storageError} onClick={() => persistir({ ...documento, lineas: [...documento.lineas, { id: crypto.randomUUID(), numprod: "", cantidad: "" }] })}>+ Nueva línea</button>
      <ActualizarDatosButton disabled={cargando || enviando} onClick={() => setIntento(valor => valor + 1)} />
      <Link className="bc-command-link" to="/material/almacen/movimientos/enviados"><FontAwesomeIcon icon={faClockRotateLeft} /> Enviados a BC</Link>
      <span className="bc-save-state">{storageError ? "Borrador sin guardar" : documento.estado === "error" ? "Error" : "Borrador"}</span>
    </div><div className="bc-journal-content warehouse-page">
      {cargando && <p role="status">Cargando catálogos de Business Central…</p>}
      {errores.map(error => <p className="journal-error" role="alert" key={error}>{error}</p>)}
      {storageError && <p className="journal-error" role="alert">{storageError}</p>}
      {documento.error && <p className="journal-error" role="alert">{documento.error}</p>}
      <fieldset className="movement-editor" disabled={cargando || enviando || !!storageError}>
        <CabeceraMovimiento cabecera={documento.cabecera} cambiar={cambiarCabecera} catalogos={catalogos} proyectos={proyectos} />
        <h2>Líneas de movimiento</h2>
        <LineasMovimiento lineas={documento.lineas} articulos={catalogos.articulos || []} cambiar={(id, cambio) => persistir({ ...documento, lineas: documento.lineas.map(linea => linea.id === id ? { ...linea, ...cambio } : linea) })} quitar={id => persistir({ ...documento, lineas: documento.lineas.filter(linea => linea.id !== id) })} />
      </fieldset>
      <p className="bc-journal-footer">{documento.lineas.length} líneas · {errorValidacion || "Campos básicos completos; pendiente de validar disponibilidad y dimensiones en BC."}</p>
    </div></div></section></Layout>;
}
