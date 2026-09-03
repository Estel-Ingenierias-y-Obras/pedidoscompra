import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen } from "@fortawesome/free-solid-svg-icons";
import Layout from "../components/Layout";
import ModalShell from "../components/ModalShell";
import DeleteIconButton from "../components/DeleteIconButton";
import { AuthContext } from "../context/AuthContext";
import { MaterialesContext } from "../context/MaterialesContext";
import api from "../api";

const formularioVacio = { nombre: "" };

function Materiales() {
  const { user } = useContext(AuthContext);
  const { recargarMateriales } = useContext(MaterialesContext);
  const [materiales, setMateriales] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(formularioVacio);
  const [materialEditando, setMaterialEditando] = useState(null);
  const [materialAEliminar, setMaterialAEliminar] = useState(null);
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

  const confirmarEliminacion = async () => {
    if (!materialAEliminar) return;

    try {
      await api.delete(`/api/materiales/${materialAEliminar._id}`);
      setMateriales(actuales =>
        actuales.filter(item => item._id !== materialAEliminar._id)
      );
      setMaterialAEliminar(null);
      await recargarMateriales();
      setMensaje({ tipo: "exito", texto: "Material eliminado correctamente" });
    } catch (error) {
      setMensaje({
        tipo: "error",
        texto: error.response?.data?.error || "No se pudo eliminar el material"
      });
    }
  };

  const termino = busqueda.trim().toLocaleLowerCase("es");
  const filtrados = materiales.filter(material =>
    !termino || material.nombre.toLocaleLowerCase("es").includes(termino)
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
          <button type="submit">Crear material</button>
        </form>
        <div className="materials-toolbar">
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar materiales..." />
          <span>{filtrados.length} materiales</span>
        </div>
        <table className="materials-table">
          <thead><tr><th>Nombre</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>{filtrados.map(material => (
            <tr key={material._id}>
              <td><strong>{material.nombre}</strong></td>
              <td><span className={`estado ${material.activo ? "estado-completado" : "estado-rechazado"}`}>{material.activo ? "Activo" : "Inactivo"}</span></td>
              <td>
                <div className="materials-actions">
                  <button
                    type="button"
                    className="material-edit-icon-button"
                    onClick={() => setMaterialEditando({ ...material })}
                    title="Editar"
                    aria-label="Editar"
                  >
                    <FontAwesomeIcon icon={faPen} aria-hidden="true" />
                  </button>
                  <DeleteIconButton
                    label={`Eliminar ${material.nombre}`}
                    onClick={() => setMaterialAEliminar(material)}
                  />
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {materialEditando && (
        <ModalShell onClose={() => setMaterialEditando(null)} ariaLabel="Editar material">
          <h2>Editar material</h2>
          <form className="material-edit-form" onSubmit={guardarEdicion}>
            <label>Nombre<input value={materialEditando.nombre} onChange={e => setMaterialEditando(actual => ({ ...actual, nombre: e.target.value }))} required /></label>
            <label className="material-active-field"><input type="checkbox" checked={materialEditando.activo} onChange={e => setMaterialEditando(actual => ({ ...actual, activo: e.target.checked }))} /> Material activo</label>
            <div className="modal-buttons"><button type="submit">Guardar cambios</button></div>
          </form>
        </ModalShell>
      )}
      {materialAEliminar && (
        <ModalShell onClose={() => setMaterialAEliminar(null)} ariaLabel="Eliminar material">
          <h2>Eliminar material</h2>
          <p>
            ¿Estás seguro de que deseas eliminar este material? Esta acción no se puede deshacer.
          </p>
          <p><strong>Material:</strong> {materialAEliminar.nombre}</p>
          <div className="modal-buttons">
            <button type="button" onClick={() => setMaterialAEliminar(null)}>Cancelar</button>
            <button type="button" className="button-danger" onClick={confirmarEliminacion}>Eliminar</button>
          </div>
        </ModalShell>
      )}
    </Layout>
  );
}

export default Materiales;
