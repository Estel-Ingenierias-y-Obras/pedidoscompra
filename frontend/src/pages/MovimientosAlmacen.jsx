import { useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import CabeceraMovimiento from "../components/CabeceraMovimiento";
import LineasMovimiento from "../components/LineasMovimiento";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import { prepararMovimiento, validarMovimiento } from "../services/movimientosAlmacen";
export { validarMovimiento } from "../services/movimientosAlmacen";
import "./Almacen.css";

const nuevo = () => ({ solicitudId: crypto.randomUUID(), serie: "ACO-ALM", cabecera: { tipoorigen: "Location", origen: "", tipodestino: "Job", destino: "", solicitante: "", tipoproyectocodigo: "", departamento: "" }, lineas: [] });
export default function MovimientosAlmacen() {
  const { user } = useContext(AuthContext);
  const clave = `almacen-movimientos-v1:${user.email.toLowerCase()}`;
  const [documento, setDocumento] = useState(nuevo);
  const [catalogos, setCatalogos] = useState({});
  const [proyectos, setProyectos] = useState([]);
  const [errores, setErrores] = useState([]);
  const [storageError, setStorageError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);
  const [preparando, setPreparando] = useState(false);
  const [preparacion, setPreparacion] = useState(null);
  const [errorPreparacion, setErrorPreparacion] = useState("");
  const enVuelo = useRef(false);
  useEffect(() => {
    try {
      const guardado = localStorage.getItem(clave);
      if (guardado) {
        const valor = JSON.parse(guardado);
        if (!valor.cabecera || !Array.isArray(valor.lineas)) throw Error();
        const limpio = { ...valor, solicitudId: valor.solicitudId || crypto.randomUUID(), serie: "ACO-ALM", lineas: valor.lineas.map(({ id, numprod, cantidad }) => ({ id, numprod, cantidad })) };
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
        if (Array.isArray(lista)) setProyectos(lista.map(item => ({ codigo: item.nomProyecto, nombre: item.descProyecto })).filter(item => item.codigo));
        else fallos.push("El catálogo de proyectos no tiene un formato válido.");
      } else { setProyectos([]); fallos.push("No se pudieron cargar los proyectos de BC. Pulsa Actualizar datos para reintentar."); }
      setErrores(fallos); setCargando(false);
    });
    return () => { activo = false; };
  }, [intento]);
  const persistir = valor => {
    if (storageError || enVuelo.current) return;
    try { localStorage.setItem(clave, JSON.stringify(valor)); setDocumento(valor); setPreparacion(null); setErrorPreparacion(""); }
    catch (_) { setStorageError("No se pudo guardar el borrador en este navegador."); }
  };
  const cambiarCabecera = cambio => persistir({ ...documento, cabecera: { ...documento.cabecera, ...cambio } });
  useEffect(() => {
    if (cargando || errores.length || storageError || !Array.isArray(catalogos.recursos)) return;
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
  const preparar = async () => {
    if (enVuelo.current || storageError || errorValidacion || cargando || errores.length) return;
    enVuelo.current = true; setPreparando(true); setErrorPreparacion(""); setPreparacion(null);
    try {
      localStorage.setItem(clave, JSON.stringify(documento));
      const resultado = await prepararMovimiento(documento);
      if (resultado.estado !== "preparado" || resultado.solicitudId !== documento.solicitudId || resultado.enviadoBC !== false || resultado.registrado !== false) throw new Error("La respuesta no confirma la preparación del borrador.");
      setPreparacion(resultado);
    } catch (error) { setErrorPreparacion(error.response?.data?.error || error.message || "No se pudo preparar el movimiento."); }
    finally { enVuelo.current = false; setPreparando(false); }
  };
  const indirecto = (catalogos.tiposProyecto || []).find(item => String(item.codigo).toUpperCase() === "INDIRECTO");
  useEffect(() => {
    if (indirecto && !documento.cabecera.tipoproyectocodigo && !storageError) {
      const valor = { ...documento, cabecera: { ...documento.cabecera, tipoproyectocodigo: indirecto.codigo } };
      try { localStorage.setItem(clave, JSON.stringify(valor)); setDocumento(valor); }
      catch (_) { setStorageError("No se pudo guardar el borrador en este navegador."); }
    }
  }, [indirecto, documento, clave, storageError]);
  return <Layout><section className="bc-journal-page"><header className="page-header"><Link className="back-link" to="/material/almacen">← Almacén</Link><h1>Movimientos de Almacén</h1><p className="page-subtitle">Acopio de materiales entre almacenes y proyectos</p></header>
    <div className="page-content bc-journal-card"><div className="bc-command-bar">
      <button disabled={cargando || preparando || !!storageError} onClick={() => persistir({ ...documento, lineas: [...documento.lineas, { id: crypto.randomUUID(), numprod: "", cantidad: "" }] })}>+ Nueva línea</button>
      <button disabled={cargando || preparando} onClick={() => { setPreparacion(null); setIntento(valor => valor + 1); }}>Actualizar datos</button>
      <button disabled={cargando || preparando || !!storageError || !!errorValidacion || !!errores.length} onClick={preparar}>{preparando ? "Validando con BC…" : "Preparar movimiento"}</button>
      <button disabled title="La creación de acopios aún no está habilitada">Enviar a BC</button>
      <button disabled title="El registro de acopios aún no está habilitado">Registrar movimiento</button>
      <span className="bc-save-state">{storageError ? "Borrador sin guardar" : "Borrador local · sin enviar a BC"}</span>
    </div><div className="bc-journal-content warehouse-page">
      <p className="journal-notice">Puedes preparar el movimiento. El envío y registro en Business Central están pendientes de habilitar. La disponibilidad del origen todavía no se puede verificar.</p>
      {cargando && <p role="status">Cargando catálogos de Business Central…</p>}
      {errores.map(error => <p className="journal-error" role="alert" key={error}>{error}</p>)}
      {storageError && <p className="journal-error" role="alert">{storageError}</p>}
      {errorPreparacion && <p className="journal-error" role="alert">{errorPreparacion}</p>}
      {preparacion && <div role="status" className="journal-notice">Movimiento preparado · {preparacion.propuestaBC?.lineas.length} líneas. Datos contrastados con Business Central. Todavía no se ha enviado ni registrado.</div>}
      <fieldset className="movement-editor" disabled={cargando || preparando || !!storageError}>
        <CabeceraMovimiento cabecera={documento.cabecera} cambiar={cambiarCabecera} catalogos={catalogos} proyectos={proyectos} />
        <h2>Líneas de movimiento</h2>
        <LineasMovimiento lineas={documento.lineas} articulos={catalogos.articulos || []} cambiar={(id, cambio) => persistir({ ...documento, lineas: documento.lineas.map(linea => linea.id === id ? { ...linea, ...cambio } : linea) })} quitar={id => persistir({ ...documento, lineas: documento.lineas.filter(linea => linea.id !== id) })} />
      </fieldset>
      <p className="bc-journal-footer">{documento.lineas.length} líneas · {errorValidacion || "Campos básicos completos; pendiente de validar disponibilidad y dimensiones en BC."}</p>
    </div></div></section></Layout>;
}
