import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faRotate } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import { obtenerStock } from "../services/almacen";
import "./Almacen.css";

const cantidades = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 20 });
const normalizar = texto => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES");

export default function StockAlmacen() {
  const [productos, setProductos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [cargado, setCargado] = useState(false);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    let activo = true;
    setCargando(true);
    setError("");
    obtenerStock().then(datos => {
      const ids = new Set();
      if (!Array.isArray(datos) || datos.some(producto => {
        if (!producto || typeof producto.id !== "string" || !producto.id || ids.has(producto.id)
          || ["numprod", "descripcion", "codudmedida"].some(campo => typeof producto[campo] !== "string")
          || typeof producto.inventario !== "number" || !Number.isFinite(producto.inventario)) return true;
        ids.add(producto.id);
        return false;
      })) throw new Error("Business Central devolvió una respuesta de stock no válida.");
      if (activo) { setProductos(datos); setCargado(true); }
    }).catch(err => {
      if (activo) setError(err.response?.data?.error || (err.isAxiosError
        ? "No se pudo conectar para consultar el stock de Business Central. Pulsa Actualizar datos para reintentar."
        : err.message || "No se pudo cargar el stock de Business Central."));
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [intento]);
  const filtrados = useMemo(() => {
    const texto = normalizar(busqueda.trim());
    return productos.filter(producto => normalizar(producto.numprod).includes(texto) || normalizar(producto.descripcion).includes(texto));
  }, [productos, busqueda]);

  return <Layout>
    <section className="bc-journal-page">
      <header className="page-header"><Link className="back-link" to="/material/almacen">← Almacén</Link><h1>Stock actual</h1><p className="page-subtitle">Almacén CENTRAL 3 · Existencias en unidad de medida base</p></header>
      <div className="page-content bc-journal-card">
        <div className="bc-command-bar">
          <button disabled={cargando} onClick={() => setIntento(valor => valor + 1)}><FontAwesomeIcon icon={faRotate} /> Actualizar datos</button>
        </div>
        <div className="bc-journal-content warehouse-page" aria-busy={cargando}>
          <div className="stock-search">
            <label htmlFor="stock-busqueda">Buscar por código o descripción</label>
            <input id="stock-busqueda" type="search" value={busqueda} onChange={event => setBusqueda(event.target.value)} placeholder="Código o descripción…" />
          </div>
          {cargando && <p role="status">Cargando existencias de CENTRAL 3…</p>}
          {error && <p role="alert" className="journal-error">{error}{cargado && " Se muestran los datos de la última carga correcta; pueden no estar actualizados."}</p>}
          {cargado && <>
            <div className="warehouse-table-container" tabIndex="0" role="region" aria-label="Existencias de CENTRAL 3">
              <table className="gestion-pedidos-table warehouse-entries-table stock-table">
                <caption>Stock actual del almacén CENTRAL 3</caption>
                <thead><tr><th scope="col">Código</th><th scope="col">Descripción</th><th scope="col">Unidad de medida</th><th scope="col">Existencias</th></tr></thead>
                <tbody>{filtrados.map(producto => <tr key={producto.id}>
                  <td data-label="Código">{producto.numprod}</td>
                  <td data-label="Descripción">{producto.descripcion}</td>
                  <td data-label="Unidad de medida">{producto.codudmedida}</td>
                  <td data-label="Existencias" className="stock-quantity">{cantidades.format(producto.inventario)}</td>
                </tr>)}</tbody>
              </table>
            </div>
            {!filtrados.length && <p role="status">{productos.length ? "No hay productos que coincidan con la búsqueda." : "No hay productos con existencias distintas de cero en CENTRAL 3."}</p>}
            <div className="bc-journal-footer">{filtrados.length} de {productos.length} productos</div>
          </>}
        </div>
      </div>
    </section>
  </Layout>;
}
