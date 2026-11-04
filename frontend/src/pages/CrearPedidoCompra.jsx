import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronDown, faEllipsis, faClockRotateLeft } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import BuscadorMovimiento from "../components/BuscadorMovimiento";
import LineasMovimiento from "../components/LineasMovimiento";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import "./Almacen.css";
import "./CrearPedidoCompra.css";

const hoy = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
const nuevo = () => ({ solicitudId: crypto.randomUUID(), proveedorNombre: "", cuerpo: { proveedor: "", proyecto: "", tarea: "", usuarioAsignado: "", fechaRecepcion: hoy(), entrega: { tipo: "empresa", cliente: "", codigoDireccion: "", almacen: "" }, pago: { tipo: "proveedor", proveedor: "", codigoContacto: "", contacto: "" }, lineas: [{ articulo: "", cantidad: 1 }] }, enviado: false, resultado: null });
const estados = { Open: "Abierto", Released: "Lanzado", "Pending Approval": "Pendiente de aprobación", "Pending Prepayment": "Pendiente de anticipo" };

function CampoSeleccion({ label, icono = faChevronDown, ...props }) {
  return <label className="purchase-create-field"><span>{label}</span><span className="purchase-create-lookup"><BuscadorMovimiento label={label} {...props} /><FontAwesomeIcon icon={icono} aria-hidden="true" /></span></label>;
}

function SelectorBC({ value, onChange, disabled, label, nombreSeleccionado = "", recurso = "proveedores", mostrarNombre = false }) {
  const [busqueda, setBusqueda] = useState("");
  const [opciones, setOpciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let activo = true;
    if (disabled) return;
    const timer = setTimeout(() => {
      setCargando(true); setError("");
      api.get(`/api/pedidos-compra/${recurso}`, { params: { buscar: busqueda } }).then(res => {
        if (!activo) return;
        if (!Array.isArray(res.data)) throw Error("Catálogo de proveedores no válido.");
        setOpciones(res.data.map(p => ({ codigo: p.number, referencia: mostrarNombre ? p.displayName : p.number, nombre: mostrarNombre ? "" : p.displayName, nombreProveedor: p.displayName })));
      }).catch(e => { if (activo) setError(e.response?.data?.error || "No se pudieron cargar las opciones."); })
        .finally(() => { if (activo) setCargando(false); });
    }, 300);
    return () => { activo = false; clearTimeout(timer); };
  }, [busqueda, disabled, recurso, mostrarNombre]);
  const lista = value && !opciones.some(o => o.codigo === value) ? [...opciones, { codigo: value, referencia: mostrarNombre ? nombreSeleccionado || value : value, nombre: mostrarNombre ? "" : nombreSeleccionado, nombreProveedor: nombreSeleccionado }] : opciones;
  return <CampoSeleccion label={label} remoto opciones={lista} value={value} onChange={codigo => onChange(codigo, lista.find(o => o.codigo === codigo)?.nombreProveedor || "")} onBuscar={setBusqueda} disabled={disabled} cargando={cargando} error={error} estado={!busqueda && !value ? (recurso === "clientes" ? "Selecciona un cliente o busca por número o nombre." : "Selecciona un proveedor o busca por número o nombre.") : ""} />;
}

function DatosPago({ pago, cambiar, proveedor, nombreProveedor, disabled, paises }) {
  const [datos, setDatos] = useState({});
  const [contactos, setContactos] = useState([]);
  const [error, setError] = useState("");
  const destino = pago.tipo === "otro" ? pago.proveedor : proveedor;
  useEffect(() => {
    let activo = true;
    setDatos({}); setContactos([]); setError("");
    if (pago.tipo === "proveedor" || !destino) return;
    api.get("/api/pedidos-compra/proveedor-pago", { params: { proveedor: destino } }).then(r => { if (activo) setDatos(r.data); }).catch(e => { if (activo) setError(e.response?.data?.error || "No se pudieron cargar los datos del proveedor de pago."); });
    api.get("/api/pedidos-compra/contactos-pago", { params: { proveedor: destino } }).then(r => { if (!Array.isArray(r.data)) throw Error(); if (activo) setContactos(r.data); }).catch(e => { if (activo) setError(e.response?.data?.error || "No se pudieron cargar los contactos del proveedor."); });
    return () => { activo = false; };
  }, [destino, pago.tipo]);
  const campos = [["direccion", "Dirección", 100], ["direccion2", "Dirección 2", 50], ["ciudad", "Ciudad", 30], ["provincia", "Provincia", 30], ["codigoPostal", "Código postal", 20], ["pais", "País/Región", 10]];
  const postal = pago.personalizada || Object.fromEntries(campos.map(([k]) => [k, datos[k] || ""]));
  return <>
    <label><span>Dirección pago</span><select disabled={disabled} value={pago.tipo} onChange={e => cambiar({ tipo: e.target.value, proveedor: "", codigoContacto: "", contacto: "" })}>
      <option value="proveedor">Predeterminado (proveedor)</option><option value="otro">Otro proveedor</option><option value="personalizada">Dirección personalizada</option>
    </select></label>
    {pago.tipo === "otro" && <SelectorBC mostrarNombre label="Nombre" value={pago.proveedor || ""} disabled={disabled} nombreSeleccionado={datos.name || ""} onChange={proveedor => cambiar({ tipo: "otro", proveedor, codigoContacto: "", contacto: "" })} />}
    {pago.tipo === "personalizada" && <label><span>Nombre</span><input readOnly value={datos.name || nombreProveedor || ""} /></label>}
    {pago.tipo !== "proveedor" && <CampoSeleccion label="Contacto" icono={faEllipsis} opciones={contactos.map(c => ({ codigo: c.number, referencia: c.name }))} value={pago.codigoContacto || ""} disabled={disabled || !destino} onChange={codigoContacto => cambiar({ ...pago, codigoContacto, contacto: contactos.find(c => c.number === codigoContacto)?.name || "" })} />}
    {error && <p role="alert" className="journal-error">{error}</p>}
    {pago.tipo === "personalizada" && <details className="purchase-address-details"><summary>Detalles de dirección de pago</summary><div className="purchase-create-header">{campos.map(([k, titulo, max]) => <label key={k}>{titulo}{k === "pais" ? <select disabled={disabled} value={postal[k]} onChange={e => cambiar({ ...pago, personalizada: { ...postal, [k]: e.target.value } })}><option value="">Seleccionar…</option>{paises.map(p => <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}</select> : <input disabled={disabled} maxLength={max} value={postal[k]} onChange={e => cambiar({ ...pago, personalizada: { ...postal, [k]: e.target.value } })} />}</label>)}</div></details>}
  </>;
}

export default function CrearPedidoCompra() {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [configuracion, setConfiguracion] = useState(null);
  const clave = configuracion ? `pedido-compra-v2:${configuracion.entorno}:${configuracion.empresaId}:${user.email.toLowerCase()}` : null;
  const [catalogos, setCatalogos] = useState({ proyectos: [], usuarios: [] });
  const [tareas, setTareas] = useState([]);
  const [cargandoTareas, setCargandoTareas] = useState(false);
  const [errorTareas, setErrorTareas] = useState("");
  const [errorCatalogos, setErrorCatalogos] = useState("");
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [productos, setProductos] = useState([]);
  const [almacenesEntrega, setAlmacenesEntrega] = useState([]);
  const [direccionesCliente, setDireccionesCliente] = useState([]);
  const [cargandoDirecciones, setCargandoDirecciones] = useState(false);
  const [errorEntrega, setErrorEntrega] = useState("");
  const [direccionVista, setDireccionVista] = useState({});
  const [cargandoDireccionVista, setCargandoDireccionVista] = useState(false);
  const [errorDireccionVista, setErrorDireccionVista] = useState("");
  const [paisesEntrega, setPaisesEntrega] = useState([]);
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
    api.get("/api/pedidos-compra/paises-entrega").then(res => {
      if (activo && Array.isArray(res.data)) setPaisesEntrega(res.data);
    }).catch(() => { if (activo) setPaisesEntrega([]); });
    api.get("/api/pedidos-compra/almacenes-entrega").then(res => {
      if (activo && Array.isArray(res.data)) setAlmacenesEntrega(res.data);
    }).catch(() => { if (activo) setErrorEntrega("No se pudieron cargar los almacenes de entrega."); });
    api.get("/api/pedidos-compra/configuracion").then(res => { if (activo) setConfiguracion(res.data); }).catch(() => { if (activo) setErrorGuardado("No se pudo comprobar el entorno de BC."); });
    Promise.all([api.get("/api/proyectos", { params: { soloAbiertos: true } }), api.get("/api/pedidos-compra/usuarios-asignados")]).then(([p, u]) => {
      const proyectos = Array.isArray(p.data) ? p.data : p.data.value;
      if (!Array.isArray(proyectos) || !Array.isArray(u.data)) throw Error("Catálogos de compras no válidos.");
      if (activo) setCatalogos({ proyectos, usuarios: u.data });
    }).catch(e => { if (activo) setErrorCatalogos(e.response?.data?.error || "No se pudieron cargar los proyectos y usuarios de BC."); }).finally(() => { if (activo) setCargandoCatalogos(false); });
    return () => { activo = false; };
  }, []);
  useEffect(() => {
    if (!clave) return;
    setCargado(false);
    try {
      const texto = localStorage.getItem(clave);
      if (texto) {
        const valor = JSON.parse(texto);
        if (!valor.solicitudId || !Array.isArray(valor.cuerpo?.lineas)) throw Error();
        if (!valor.enviado && !valor.cuerpo.entrega?.tipo) valor.cuerpo.entrega = { tipo: "empresa", cliente: "", codigoDireccion: "", almacen: "" };
        if (valor.resultado?.solicitudId) {
          localStorage.setItem(clave, JSON.stringify(nuevo()));
          navigate(`/pedidos-compra/enviados?pedido=${valor.resultado.solicitudId}`, { replace: true });
          return;
        }
        setDocumento(valor);
      } else setDocumento(nuevo());
    } catch (_) { setErrorGuardado("No se pudo recuperar el pedido guardado. Conserva los datos del navegador."); }
    setCargado(true);
  }, [clave, navigate]);
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
  }, [proyecto]);
  const clienteEntrega = documento.cuerpo.entrega.cliente || "";
  useEffect(() => {
    let activo = true;
    setDireccionesCliente([]); setCargandoDirecciones(false); setErrorEntrega("");
    if (!clienteEntrega) return;
    setCargandoDirecciones(true);
    api.get("/api/pedidos-compra/direcciones-cliente", { params: { cliente: clienteEntrega } }).then(res => {
      if (!Array.isArray(res.data)) throw Error();
      if (activo) setDireccionesCliente(res.data);
    }).catch(e => { if (activo) setErrorEntrega(e.response?.data?.error || "No se pudieron cargar las direcciones del cliente."); }).finally(() => { if (activo) setCargandoDirecciones(false); });
    return () => { activo = false; };
  }, [clienteEntrega]);
  const tipoEntrega = documento.cuerpo.entrega.tipo;
  const almacenEntrega = documento.cuerpo.entrega.almacen || "";
  const codigoEntrega = documento.cuerpo.entrega.codigoDireccion || "";
  useEffect(() => {
    let activo = true;
    setDireccionVista({}); setErrorDireccionVista(""); setCargandoDireccionVista(false);
    if (tipoEntrega === "personalizada" || (tipoEntrega === "empresa" && !proyecto) || (tipoEntrega === "almacen" && !almacenEntrega) || (tipoEntrega === "cliente" && !clienteEntrega)) return;
    setCargandoDireccionVista(true);
    api.get("/api/pedidos-compra/direccion-entrega", { params: { tipo: tipoEntrega, almacen: almacenEntrega, cliente: clienteEntrega, codigoDireccion: codigoEntrega, ...(tipoEntrega === "empresa" ? { proyecto } : {}) } }).then(res => {
      if (!res.data || typeof res.data.nombre !== "string") throw Error();
      if (activo) setDireccionVista(res.data);
    }).catch(e => { if (activo) setErrorDireccionVista(e.response?.data?.error || "No se pudo consultar la dirección de BC. Comprueba que la extensión esté actualizada."); }).finally(() => { if (activo) setCargandoDireccionVista(false); });
    return () => { activo = false; };
  }, [tipoEntrega, almacenEntrega, clienteEntrega, codigoEntrega, proyecto]);
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
      if (resultado && accion !== "lanzar") {
        if (guardar(nuevo())) navigate(`/pedidos-compra/enviados?pedido=${resultado.solicitudId}`);
        return;
      }
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
  const entregaValida = (cuerpo.entrega.tipo === "empresa" && proyecto && !cargandoDireccionVista && !errorDireccionVista && direccionVista.direccion?.trim()) || (cuerpo.entrega.tipo === "almacen" && almacenesEntrega.some(a => a.code === cuerpo.entrega.almacen)) || (cuerpo.entrega.tipo === "cliente" && cuerpo.entrega.cliente && !cargandoDirecciones && !errorEntrega && (!cuerpo.entrega.codigoDireccion || direccionesCliente.some(d => d.code === cuerpo.entrega.codigoDireccion))) || (cuerpo.entrega.tipo === "personalizada" && cuerpo.entrega.personalizada?.nombre?.trim() && cuerpo.entrega.personalizada?.direccion?.trim());
  const datosDireccion = cuerpo.entrega.tipo === "personalizada" ? cuerpo.entrega.personalizada || {} : direccionVista;
  const pago = cuerpo.pago || { tipo: "proveedor", proveedor: "", codigoContacto: "", contacto: "" };
  const pagoValido = pago.tipo !== "otro" || Boolean(pago.proveedor);
  const valido = documento.enviado || (pagoValido && seleccionValida && cuerpo.proveedor && cuerpo.fechaRecepcion && entregaValida && cuerpo.lineas.length > 0 && cuerpo.lineas.every(l => l.articulo && Number.isFinite(l.cantidad) && l.cantidad > 0 && l.unidad));
  const seleccionarProveedor = (proveedor, proveedorNombre) => {
    if (!bloqueado) guardar({ ...documento, proveedorNombre, cuerpo: { ...cuerpo, proveedor, pago: { tipo: "proveedor", proveedor: "", codigoContacto: "", contacto: "" } } });
  };
  return <Layout><div className="page-header"><Link className="back-link" to="/pedidos-compra">← Pedidos Compra</Link><h1>Crear en BC</h1><p className="page-subtitle">Nuevo pedido de compra</p></div>
    <div className="page-content purchase-create">
      <div className="bc-command-bar purchase-create-toolbar"><Link className="bc-command-link" to="/pedidos-compra/enviados"><FontAwesomeIcon icon={faClockRotateLeft} /> Enviados a BC</Link></div>
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
      <fieldset disabled={bloqueado} className="purchase-create-fields purchase-shipping-fields"><legend>Envío y pago</legend><div className="purchase-shipping-rows">
        <label><span>Dirección de envío</span><select value={cuerpo.entrega.tipo} onChange={e => cambiar({ entrega: { tipo: e.target.value, almacen: "", cliente: "", codigoDireccion: "", ...(e.target.value === "personalizada" ? { personalizada: { ...direccionVista } } : {}) } })}>
          <option value="empresa">Predeterminado</option>
          <option value="almacen">Almacén</option>
          <option value="cliente">Dirección del cliente</option>
          <option value="personalizada">Dirección personalizada</option>
        </select></label>
        {cuerpo.entrega.tipo === "almacen" && <CampoSeleccion label="Cód. almacén" opciones={almacenesEntrega.map(a => ({ codigo: a.code, nombre: a.displayName }))} value={cuerpo.entrega.almacen || ""} disabled={bloqueado} onChange={almacen => cambiar({ entrega: { ...cuerpo.entrega, almacen } })} />}
        {cuerpo.entrega.tipo === "cliente" && <>
          <SelectorBC recurso="clientes" label="Cliente" value={cuerpo.entrega.cliente || ""} disabled={bloqueado} onChange={cliente => cambiar({ entrega: { ...cuerpo.entrega, cliente, codigoDireccion: "" } })} />
          {cuerpo.entrega.cliente && <CampoSeleccion label="Cód. dirección envío cliente" opciones={cuerpo.entrega.cliente ? [{ codigo: "", referencia: "Dirección principal del cliente" }, ...direccionesCliente.map(d => ({ codigo: d.code, nombre: [d.name, d.address, d.city].filter(Boolean).join(" · ") }))] : []} value={cuerpo.entrega.codigoDireccion || ""} disabled={bloqueado || !cuerpo.entrega.cliente || cargandoDirecciones} onChange={codigoDireccion => cambiar({ entrega: { ...cuerpo.entrega, codigoDireccion } })} />}
        </>}
        {cuerpo.entrega.tipo !== "personalizada" && (cuerpo.entrega.tipo !== "empresa" || proyecto) && <div className="purchase-address-preview" aria-label="Dirección de envío seleccionada" role="status">
          {cargandoDireccionVista ? "Cargando dirección…" : errorDireccionVista ? errorDireccionVista : direccionVista.direccion ? <><strong>{direccionVista.nombre}</strong><span>{[direccionVista.direccion, direccionVista.direccion2].filter(Boolean).join(" · ")}</span><span>{[direccionVista.codigoPostal, direccionVista.ciudad, direccionVista.provincia, direccionVista.pais].filter(Boolean).join(" · ")}</span></> : cuerpo.entrega.tipo === "empresa" ? "El proyecto no tiene una dirección de envío informada en BC." : cuerpo.entrega.tipo === "almacen" ? "Selecciona un almacén para completar su dirección." : "Selecciona un cliente y su dirección de envío."}
        </div>}
        {cuerpo.entrega.tipo === "personalizada" && <div className="purchase-address-details">
        <div className="purchase-create-header">{[["nombre", "Nombre", 100], ["direccion", "Dirección", 100], ["direccion2", "Dirección 2", 50], ["ciudad", "Ciudad", 30], ["provincia", "Provincia", 30], ["codigoPostal", "Código postal", 20], ["pais", "País/Región", 10], ["telefono", "Nº teléfono", 30], ["contacto", "Contacto", 100]].map(([campo, titulo, max]) => <label key={campo}>{titulo}{campo === "pais" && cuerpo.entrega.tipo === "personalizada" ? <select value={datosDireccion.pais || ""} onChange={e => cambiar({ entrega: { ...cuerpo.entrega, personalizada: { ...datosDireccion, pais: e.target.value } } })}><option value="">Seleccionar...</option>{paisesEntrega.map(p => <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}</select> : <input maxLength={max} readOnly={cuerpo.entrega.tipo !== "personalizada"} value={datosDireccion[campo] || ""} onChange={e => cambiar({ entrega: { ...cuerpo.entrega, personalizada: { ...datosDireccion, [campo]: e.target.value } } })} />}</label>)}
</div>
        {cargandoDireccionVista && <p role="status">Cargando dirección de BC...</p>}
        {errorDireccionVista && <p role="alert" className="journal-error">{errorDireccionVista}</p>}
</div>}

        <DatosPago pago={pago} proveedor={cuerpo.proveedor} nombreProveedor={documento.proveedorNombre} disabled={bloqueado} paises={paisesEntrega} cambiar={pago => cambiar({ pago })} />

      </div></fieldset>
      {errorEntrega && <p role="alert" className="journal-error">{errorEntrega}</p>}
      <div className="purchase-create-actions">
        {!resultado && <button disabled={!valido || ocupado || !cargado || !!errorGuardado || !!errorCatalogos || cargandoCatalogos} onClick={() => ejecutar("crear")}>{documento.enviado ? "Reintentar creación" : "Crear pedido en BC"}</button>}
        {documento.enviado && <button disabled={ocupado || !!errorGuardado} onClick={() => ejecutar("consultar")}>Actualizar estado</button>}
        {resultado && <button disabled={ocupado || !!errorGuardado} onClick={() => { guardar(nuevo()); setError(""); }}>Nuevo pedido</button>}
      </div>
    </div></Layout>;
}
