import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import ModalShell from "../components/ModalShell";
import { AuthContext } from "../context/AuthContext";
import { MaterialesContext } from "../context/MaterialesContext";
import api from "../api";

const formularioVacio = { nombre: "", categoria: "", activo: true };

function Materiales() {
  const { user } = useContext(AuthContext);
  const { recargarMateriales } = useContext(MaterialesContext);
  const [materiales, setMateriales] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(formularioVacio);
  const [materialEditando, setMaterialEditando] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const puedeGestionar = ["Admin", "Comprador"].includes(user?.rol);

  const cargar = async () => {
    const response = await api.get("/api/materiales", { params: { incluirInactivos: 1 } });
    setMateriales(response.data);
  };

  useEffect(() => {
    if (puedeGestionar) cargar().catch(() => setMensaje({ tipo: "error", texto: "No se pudo cargar el catálogo" }));
  }, [puedeGestionar]);

  if (!puedeGestionar) return <Navigate to="/nuevasolicitud" replace />;

  const guardarNuevo = async event => {
    event.preventDefault();
    if (!formulario.nombre.trim()) return;
    try {
      const response = await api.post("/api/materiales", formulario);
      setMateriales(actuales => [...actuales, response.data].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      setFormulario(formularioVacio);
      await recargarMateriales();
      setMensaje({ tipo: "exito", texto: "Material creado correctamente" });
    } catch (error) {
      setMensaje({ tipo: "error", texto: error.response?.data?.error || "No se pudo crear el material" });
    }
  };

  const guardarEdicion = async event => {
    event.preventDefault();
    try {
      const response = await api.put(`/api/materiales/${materialEditando._id}`, materialEditando);
      setMateriales(actuales => actuales.map(item => item._id === response.data._id ? response.data : item));
      setMaterialEditando(null);
      await recargarMateriales();
      setMensaje({ tipo: "exito", texto: "Material actualizado correctamente" });
    } catch (error) {
      setMensaje({ tipo: "error", texto: error.response?.data?.error || "No se pudo actualizar el material" });
    }
  };

  const desactivar = async material => {
    try {
      const response = await api.patch(`/api/materiales/${material._id}/desactivar`);
      setMateriales(actuales => actuales.map(item => item._id === response.data._id ? response.data : item));
      await recargarMateriales();
      setMensaje({ tipo: "exito", texto: "Material desactivado" });
    } catch (error) {
      setMensaje({ tipo: "error", texto: "No se pudo desactivar el material" });
    }
  };

  const termino = busqueda.trim().toLocaleLowerCase("es");
  const filtrados = materiales.filter(material =>
    !termino || material.nombre.toLocaleLowerCase("es").includes(termino) ||
    material.categoria.toLocaleLowerCase("es").includes(termino)
  );

  return (
    <Layout>
      <div className="page-header">
        <h1>Material</h1>
        <p className="page-subtitle">Catálogo de materiales frecuentes para agilizar las solicitudes.</p>
      </div>
      <div className="page-content materials-page">
        {mensaje && <div className={`settings-feedback settings-feedback-${mensaje.tipo}`}>{mensaje.texto}</div>}
        <form className="materials-create-form" onSubmit={guardarNuevo}>
          <label>Nombre<input value={formulario.nombre} onChange={e => setFormulario(actual => ({ ...actual, nombre: e.target.value }))} placeholder="Ej. Monitor" required /></label>
          <label>Categoría <span>(opcional)</span><input value={formulario.categoria} onChange={e => setFormulario(actual => ({ ...actual, categoria: e.target.value }))} placeholder="Ej. Informática" /></label>
          <button type="submit">Crear material</button>
        </form>
        <div className="materials-toolbar">
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar materiales..." />
          <span>{filtrados.length} materiales</span>
        </div>
        <table className="materials-table">
          <thead><tr><th>Nombre</th><th>Categoría</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{filtrados.map(material => (
            <tr key={material._id}>
              <td><strong>{material.nombre}</strong></td>
              <td>{material.categoria || "—"}</td>
              <td><span className={`estado ${material.activo ? "estado-completado" : "estado-rechazado"}`}>{material.activo ? "Activo" : "Inactivo"}</span></td>
              <td><div className="materials-actions"><button type="button" onClick={() => setMaterialEditando({ ...material })}>Editar</button>{material.activo && <button type="button" className="secondary-button" onClick={() => desactivar(material)}>Desactivar</button>}</div></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {materialEditando && (
        <ModalShell onClose={() => setMaterialEditando(null)} ariaLabel="Editar material">
          <h2>Editar material</h2>
          <form className="material-edit-form" onSubmit={guardarEdicion}>
            <label>Nombre<input value={materialEditando.nombre} onChange={e => setMaterialEditando(actual => ({ ...actual, nombre: e.target.value }))} required /></label>
            <label>Categoría <span>(opcional)</span><input value={materialEditando.categoria} onChange={e => setMaterialEditando(actual => ({ ...actual, categoria: e.target.value }))} /></label>
            <label className="material-active-field"><input type="checkbox" checked={materialEditando.activo} onChange={e => setMaterialEditando(actual => ({ ...actual, activo: e.target.checked }))} /> Material activo</label>
            <div className="modal-buttons"><button type="submit">Guardar cambios</button></div>
          </form>
        </ModalShell>
      )}
    </Layout>
  );
}

export default Materiales;
