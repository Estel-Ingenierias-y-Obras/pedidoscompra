import { useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import ModalShell from "../components/ModalShell";
import DeleteIconButton from "../components/DeleteIconButton";
import NotificationToast from "../components/NotificationToast";
import { AuthContext } from "../context/AuthContext";
import { MaterialesContext } from "../context/MaterialesContext";
import api from "../api";

const crearFormularioVacio = () => ({
  nombre: "",
  descripcion: "",
  referencia: "",
  unidadMedida: ""
});

const prepararPayload = formulario => ({
  nombre: formulario.nombre.trim(),
  descripcion: formulario.descripcion.trim(),
  referencia: formulario.referencia.trim(),
  unidadMedida: formulario.unidadMedida.trim(),
  ...(Object.prototype.hasOwnProperty.call(formulario, "activo") ? { activo: formulario.activo } : {})
});

function Materiales() {
  const { user } = useContext(AuthContext);
  const { recargarMateriales } = useContext(MaterialesContext);
  const [materiales, setMateriales] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [formulario, setFormulario] = useState(crearFormularioVacio);
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
    try {
      await api.post("/api/materiales", prepararPayload(formulario));
      setFormulario(crearFormularioVacio());
      await Promise.all([cargar(), recargarMateriales()]);
      setMensaje({ tipo: "exito", texto: "Material creado correctamente" });
    } catch (error) {
      setMensaje({ tipo: "error", texto: error.response?.data?.error || "No se pudo crear el material" });
    }
  };

  const guardarEdicion = async event => {
    event.preventDefault();
    try {
      await api.put(`/api/materiales/${materialEditando._id}`, prepararPayload(materialEditando));
      setMaterialEditando(null);
      await Promise.all([cargar(), recargarMateriales()]);
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
    !termino || [material.nombre, material.descripcion, material.referencia, material.unidadMedida]
      .some(valor => String(valor || "").toLocaleLowerCase("es").includes(termino))
  );

  return (
    <Layout>
      <div className="page-header">
        <h1>Material</h1>
        <p className="page-subtitle">Catálogo de materiales frecuentes para agilizar las solicitudes.</p>
      </div>
      <div className="page-content materials-page">
        <NotificationToast message={mensaje} onClose={() => setMensaje(null)} />
        <form className="materials-create-form" onSubmit={guardarNuevo}>
          <label><span>Material *</span><input value={formulario.nombre} onChange={e => setFormulario(actual => ({ ...actual, nombre: e.target.value }))} placeholder="Ej. Cable UTP Cat6" required /></label>
          <label><span>Descripción</span><input value={formulario.descripcion} onChange={e => setFormulario(actual => ({ ...actual, descripcion: e.target.value }))} placeholder="Cable de red categoría 6" required /></label>
          <label><span>Referencia</span><input value={formulario.referencia} onChange={e => setFormulario(actual => ({ ...actual, referencia: e.target.value }))} placeholder="CAB-001" required /></label>
          <label><span>Unidades</span><input value={formulario.unidadMedida} onChange={e => setFormulario(actual => ({ ...actual, unidadMedida: e.target.value }))} placeholder="Ej. Metros" required /></label>
          <button type="submit">Crear material</button>
        </form>
        <div className="materials-toolbar">
          <input type="search" value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre, referencia, descripción o unidad..." />
          <span>{filtrados.length} materiales</span>
        </div>
        <table className="materials-table">
          <thead><tr><th>Nombre</th><th>Descripción</th><th>Referencia</th><th>Unidad</th><th>Acciones</th></tr></thead>
          <tbody>{filtrados.map(material => (
            <tr
              key={material._id}
              className="material-clickable-row"
              role="button"
              tabIndex="0"
              aria-label={`Editar material ${material.nombre}`}
              onClick={() => setMaterialEditando({ ...material })}
              onKeyDown={event => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setMaterialEditando({ ...material });
                }
              }}
            >
              <td><strong>{material.nombre}</strong></td>
              <td>{material.descripcion}</td>
              <td><span className="material-reference">{material.referencia}</span></td>
              <td>{material.unidadMedida}</td>
              <td>
                <div className="materials-actions">
                  <DeleteIconButton
                    label={`Eliminar ${material.nombre}`}
                    onClick={event => {
                      event.stopPropagation();
                      setMaterialAEliminar(material);
                    }}
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
            <label><span>Material *</span><input value={materialEditando.nombre} onChange={e => setMaterialEditando(actual => ({ ...actual, nombre: e.target.value }))} required /></label>
            <label><span>Descripción</span><textarea value={materialEditando.descripcion} onChange={e => setMaterialEditando(actual => ({ ...actual, descripcion: e.target.value }))} rows="3" required /></label>
            <label><span>Referencia</span><input value={materialEditando.referencia} onChange={e => setMaterialEditando(actual => ({ ...actual, referencia: e.target.value }))} required /></label>
            <label><span>Unidades</span><input value={materialEditando.unidadMedida} onChange={e => setMaterialEditando(actual => ({ ...actual, unidadMedida: e.target.value }))} required /></label>
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
