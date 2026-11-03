import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import BuscadorMovimiento from "../components/BuscadorMovimiento";
import LineasMovimiento from "../components/LineasMovimiento";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import "./Almacen.css";
import "./CrearPedidoCompra.css";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const nuevo = () => ({ solicitudId: crypto.randomUUID(), proveedorNombre: "", cuerpo: { proveedor: "", proyecto: "", tarea: "", usuarioAsignado: "", fechaRecepcion: hoy(), entrega: { nombre: "", direccion: "", direccion2: "", ciudad: "", provincia: "", codigoPostal: "", pais: "ES", contacto: "" }, lineas: [{ articulo: "", cantidad: 1 }] }, enviado: false, resultado: null });
const estados = { Open: "Abierto", Released: "Lanzado", "Pending Approval": "Pendiente de aprobación", "Pending Prepayment": "Pendiente de anticipo" };

function CampoSeleccion({ label, ...props }) {
  return <label className="purchase-create-field"><span>{label}</span><span className="purchase-create-lookup"><BuscadorMovimiento label={label} {...props} /><FontAwesomeIcon icon={faChevronDown} aria-hidden="true" /></span></label>;
}

function SelectorBC({ value, onChange, disabled, label, nombreSeleccionado = "" }) {
  const [busqueda, setBusqueda] = useState("");
  const [opciones, setOpciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let activo = true;
    if (disabled) return;
    const timer = setTimeout(() => {
      setCargando(true); setError("");
      api.get("/api/pedidos-compra/proveedores", { params: { buscar: busqueda } }).then(res => {
        if (!activo) return;
        if (!Array.isArray(res.data)) throw Error("Catálogo de proveedores no válido.");
        setOpciones(res.data.map(p => ({ codigo: p.number, referencia: p.number, nombre: p.displayName, nombreProveedor: p.displayName })));
      }).catch(e => { if (activo) setError(e.response?.data?.error || "No se pudieron cargar las opciones."); })
        .finally(() => { if (activo) setCargando(false); });
    }, 300);
    return () => { activo = false; clearTimeout(timer); };
  }, [busqueda, disabled]);
  const lista = value && !opciones.some(o => o.codigo === value) ? [...opciones, { codigo: value, referencia: value, nombre: nombreSeleccionado, nombreProveedor: nombreSeleccionado }] : opciones;
  return <CampoSeleccion label={label} remoto opciones={lista} value={value} onChange={codigo => onChange(codigo, lista.find(o => o.codigo === codigo)?.nombreProveedor || "")} onBuscar={setBusqueda} disabled={disabled} cargando={cargando} error={error} estado={!busqueda && !value ? "Selecciona un proveedor o busca por número o nombre." : ""} />;
}

export default function CrearPedidoCompra() {
  const { user } = useContext(AuthContext);
  const [configuracion, setConfiguracion] = useState(null);
  const clave = configuracion ? `pedido-compra-v2:${configuracion.entorno}:${configuracion.empresaId}:${user.email.toLowerCase()}` : null;
  const [catalogos, setCatalogos] = useState({ proyectos: [], usuarios: [] });
  const [tareas, setTareas] = useState([]);
  const [cargandoTareas, setCargandoTareas] = useState(false);
  const [errorTareas, setErrorTareas] = useState("");
  const [intentoCatalogos, setIntentoCatalogos] = useState(0);
  const [errorCatalogos, setErrorCatalogos] = useState("");
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [productos, setProductos] = useState([]);
  const actualizarProducto = useCallback(item => setProductos(prev => [...prev.filter(p => p.number !== item.number), item]), []);
  const [documento, setDocumento] = useState(nuevo);
  const [cargado, setCargado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const [errorGuardado, setErrorGuardado] = useState("");
  const enVuelo = useRef(false);
  const guardar = valor => {
    try { localStorage.setItem(clave, JSON.stringify(valor)); setDocumento(valor); return true; }
    catch (_) { setDocumento(valor); setErrorGuardado("No se pudo guardar la solicitud en este navegador. No cierres esta página."); return false; }
  };
  useEffect(() => {
    let activo = true;
    setErrorCatalogos(""); setCargandoCatalogos(true);
    api.get("/api/pedidos-compra/configuracion").then(res => { if (activo) setConfiguracion(res.data); }).catch(() => { if (activo) setErrorGuardado("No se pudo comprobar el entorno de BC."); });
    Promise.all([api.get("/api/proyectos", { params: { soloAbiertos: true } }), api.get("/api/pedidos-compra/usuarios-asignados")]).then(([p, u]) => {
      const proyectos = Array.isArray(p.data) ? p.data : p.data.value;
      if (!Array.isArray(proyectos) || !Array.isArray(u.data)) throw Error("Catálogos de compras no válidos.");
      if (activo) setCatalogos({ proyectos, usuarios: u.data });
    }).catch(e => { if (activo) setErrorCatalogos(e.response?.data?.error || "No se pudieron cargar los proyectos y usuarios de BC."); }).finally(() => { if (activo) setCargandoCatalogos(false); });
    return () => { activo = false; };
  }, [intentoCatalogos]);
  useEffect(() => {
    if (!clave) return;
    setCargado(false);
    try {
      const texto = localStorage.getItem(clave);
      if (texto) {
        const valor = JSON.parse(texto);
        if (!valor.solicitudId || !Array.isArray(valor.cuerpo?.lineas)) throw Error();
        setDocumento(valor);
      } else setDocumento(nuevo());
    } catch (_) { setErrorGuardado("No se pudo recuperar el pedido guardado. Conserva los datos del navegador."); }
    setCargado(true);
  }, [clave]);
  const proyecto = documento.cuerpo.proyecto;
  useEffect(() => {
    let activo = true;
    setTareas([]);
    setErrorTareas(""); setCargandoTareas(false);
    if (!proyecto) return;
    setCargandoTareas(true);
    api.get("/api/pedidos-compra/tareas", { params: { proyecto } }).then(res => {
      if (!Array.isArray(res.data)) throw Error("Catálogo de tareas no válido.");
      if (activo) setTareas(res.data);
    }).catch(e => { if (activo) setErrorTareas(e.response?.data?.error || "No se pudieron cargar las tareas del proyecto."); }).finally(() => { if (activo) setCargandoTareas(false); });
    return () => { activo = false; };
  }, [proyecto, intentoCatalogos]);
  const cambiar = cambio => {
    if (documento.enviado || ocupado || !cargado) return;
    guardar({ ...documento, cuerpo: { ...documento.cuerpo, ...cambio } });
  };
  const cambiarLinea = (indice, cambio) => cambiar({ lineas: documento.cuerpo.lineas.map((l, i) => i === indice ? { ...l, ...cambio } : l) });
  const ejecutar = async accion => {
    if (enVuelo.current || errorGuardado || !cargado) return;
    enVuelo.current = true; setOcupado(true); setError("");
    try {
      if (accion === "crear" && !documento.enviado && !guardar({ ...documento, enviado: true })) return;
      const url = `/api/pedidos-compra/solicitudes/${documento.solicitudId}`;
      const res = accion === "consultar" ? await api.get(url) : await api.post(accion === "lanzar" ? `${url}/lanzar` : url, accion === "crear" ? documento.cuerpo : {});
      const resultado = accion === "consultar" ? res.data.resultado : res.data;
      if (resultado && (resultado.solicitudId !== documento.solicitudId || !resultado.numero || !resultado.id || !estados[resultado.estado])) throw Error("BC no ha confirmado el pedido original.");
      guardar({ ...documento, enviado: true, resultado: resultado || null });
      if (!resultado) setError("BC no confirma todavía la creación. Pulsa Reintentar creación para recuperar o crear la misma solicitud.");
    } catch (e) {
      if (accion === "crear" && e.response?.data?.definitivo === true) guardar({ ...documento, solicitudId: crypto.randomUUID(), enviado: false, resultado: null });
      setError(e.response?.data?.error || e.message || "No se pudo confirmar la operación. Conserva esta solicitud y consulta su estado antes de reintentar.");
    } finally { enVuelo.current = false; setOcupado(false); }
  };
  const cuerpo = documento.cuerpo;
  const resultado = documento.resultado;
  const bloqueado = !cargado || ocupado || !!errorGuardado || documento.enviado;
  const seleccionValida = catalogos.proyectos.some(p => p.nomProyecto === cuerpo.proyecto) && tareas.some(t => t.number === cuerpo.tarea) && catalogos.usuarios.some(u => u.userId === cuerpo.usuarioAsignado);
  const valido = documento.enviado || (seleccionValida && cuerpo.proveedor && cuerpo.fechaRecepcion && cuerpo.entrega.nombre && cuerpo.entrega.direccion && cuerpo.entrega.ciudad && cuerpo.entrega.codigoPostal && cuerpo.entrega.pais && cuerpo.lineas.length > 0 && cuerpo.lineas.every(l => l.articulo && Number.isFinite(l.cantidad) && l.cantidad > 0 && l.unidad));
  const seleccionarProveedor = (proveedor, proveedorNombre) => {
    if (!bloqueado) guardar({ ...documento, proveedorNombre, cuerpo: { ...cuerpo, proveedor } });
  };
  return <Layout><div className="page-header"><Link className="back-link" to="/pedidos-compra">← Pedidos Compra</Link><h1>Crear en BC</h1><p className="page-subtitle">Nuevo pedido de compra</p></div>
    <div className="page-content purchase-create">
      <div className="purchase-create-toolbar">{configuracion && <p role="status" className="purchase-create-context"><strong>{configuracion.entorno}</strong><span>{configuracion.empresa}</span></p>}<button type="button" className="secondary-button" disabled={ocupado || cargandoCatalogos} onClick={() => setIntentoCatalogos(i => i + 1)}>Actualizar catálogos</button></div>
      {errorCatalogos && <p role="alert" className="journal-error">{errorCatalogos}</p>}
      {errorGuardado && <p role="alert">{errorGuardado}</p>}{error && <p role="alert">{error}</p>}
      {resultado && <p role="status">Pedido <strong>{resultado.numero}</strong> · Estado: <strong>{estados[resultado.estado]}</strong></p>}
      {ocupado && <p role="status">Consultando Business Central…</p>}
      <fieldset disabled={bloqueado} className="purchase-create-fields"><legend>Datos del pedido</legend><div className="purchase-create-header">
        <SelectorBC value={cuerpo.proveedor} nombreSeleccionado={documento.proveedorNombre} label="Nº de proveedor" disabled={bloqueado} onChange={seleccionarProveedor} />
        <CampoSeleccion label="Proyecto" opciones={catalogos.proyectos.map(p => ({ codigo: p.nomProyecto, nombre: p.descProyecto }))} value={cuerpo.proyecto} disabled={bloqueado || cargandoCatalogos || !!errorCatalogos} onChange={proyecto => cambiar({ proyecto, tarea: "" })} />
        <CampoSeleccion label="Tarea" opciones={tareas.map(t => ({ codigo: t.number, nombre: t.description }))} value={cuerpo.tarea} disabled={bloqueado || !cuerpo.proyecto || cargandoTareas || !!errorTareas} onChange={tarea => cambiar({ tarea })} estado={!cuerpo.proyecto ? "Selecciona primero un proyecto." : ""} />
        <CampoSeleccion label="Id. usuario asignado" opciones={catalogos.usuarios.map(u => ({ codigo: u.userId }))} value={cuerpo.usuarioAsignado} disabled={bloqueado || cargandoCatalogos || !!errorCatalogos} onChange={usuarioAsignado => cambiar({ usuarioAsignado })} />
        <label>Fecha recepción esperada<input type="date" min="2000-01-01" value={cuerpo.fechaRecepcion} onChange={e => cambiar({ fechaRecepcion: e.target.value })} /></label>
      </div></fieldset>
      {cargandoTareas && <p role="status">Cargando tareas del proyecto…</p>}{errorTareas && <p role="alert" className="journal-error">{errorTareas}</p>}
      <fieldset disabled={bloqueado} className="purchase-create-fields"><legend>Materiales</legend>
        <LineasMovimiento buscarProductos lineas={cuerpo.lineas.map((l, i) => ({ id: String(i), numprod: l.articulo, cantidad: l.cantidad }))} articulos={productos} onProducto={actualizarProducto}
          cambiar={(id, cambio) => { const indice = Number(id); const articulo = cambio.numprod ?? cuerpo.lineas[indice].articulo; const item = productos.find(p => p.number === articulo); cambiarLinea(indice, { articulo, cantidad: cambio.cantidad === "" ? "" : Number(cambio.cantidad ?? cuerpo.lineas[indice].cantidad), unidad: item?.baseUnitOfMeasureCode || "" }); }}
          quitar={id => cambiar({ lineas: cuerpo.lineas.filter((_, i) => i !== Number(id)) })} />
        <button disabled={bloqueado || cuerpo.lineas.length >= 100} onClick={() => cambiar({ lineas: [...cuerpo.lineas, { articulo: "", cantidad: 1 }] })}>Añadir material</button>
      </fieldset>
      <fieldset disabled={bloqueado} className="purchase-create-fields"><legend>Dirección de entrega</legend><div className="purchase-create-header">
        {[["nombre", "Nombre de entrega", 100], ["direccion", "Dirección", 100], ["direccion2", "Dirección 2", 50], ["ciudad", "Ciudad", 30], ["provincia", "Provincia", 30], ["codigoPostal", "Código postal", 20], ["pais", "Código país", 10], ["contacto", "Contacto", 100]].map(([campo, titulo, max]) => <label key={campo}>{titulo}<input maxLength={max} value={cuerpo.entrega[campo]} onChange={e => cambiar({ entrega: { ...cuerpo.entrega, [campo]: e.target.value } })} /></label>)}
      </div></fieldset>
      <div className="purchase-create-actions">
        {!resultado && <button disabled={!valido || ocupado || !cargado || !!errorGuardado || !!errorCatalogos || cargandoCatalogos} onClick={() => ejecutar("crear")}>{documento.enviado ? "Reintentar creación" : "Crear pedido en BC"}</button>}
        {documento.enviado && <button disabled={ocupado || !!errorGuardado} onClick={() => ejecutar("consultar")}>Actualizar estado</button>}
        {resultado?.estado === "Open" && <button disabled={ocupado || !!errorGuardado} onClick={() => ejecutar("lanzar")}>Lanzar</button>}
        {resultado && <button disabled={ocupado || !!errorGuardado} onClick={() => { guardar(nuevo()); setError(""); }}>Nuevo pedido</button>}
      </div>
    </div></Layout>;
}
