import { fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import MisSolicitudes from "./MisSolicitudes";
import HistoricoPedidos from "./HistoricoPedidos";
import ValidarSolicitudes from "./ValidarSolicitudes";
import { AuthContext } from "../context/AuthContext";
import { SolicitudesContext } from "../context/SolicitudesContext";
import { UsuariosContext } from "../context/UsuariosContext";
import api from "../api";

jest.mock("../api", () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock("../components/ProjectSelector", () => () => <div>Selector proyecto</div>);

const pedidos = [
  { _id: "activo", proyecto: "Proyecto mixto", estado: "Pendiente", solicitante: "Activo" },
  { _id: "otro", proyecto: "Proyecto activo", estado: "Pedido", solicitante: "Otro" },
  { _id: "archivado", proyecto: "Proyecto mixto", estado: "Archivar", solicitante: "Archivado", urgente: true, motivoUrgencia: "Material urgente", descripcion: "Material planificable", comentarioCompras: "Compra histórica", archivosUrgente: [{ fileId: "f1", nombre: "urgente.pdf" }], adjuntosCompras: [{ fileId: "f2", nombre: "factura.pdf" }] },
  { _id: "antiguo", proyecto: "Proyecto antiguo", estado: "Archivar", solicitante: "Antiguo" }
];

function mostrar(page, setSolicitudes = jest.fn()) {
  return render(<MemoryRouter>
    <AuthContext.Provider value={{ user: { rol: "Admin", email: "admin@example.com" } }}>
      <UsuariosContext.Provider value={{ usuarios: [] }}>
        <SolicitudesContext.Provider value={{ solicitudes: pedidos, setSolicitudes }}>
          {page}
        </SolicitudesContext.Provider>
      </UsuariosContext.Provider>
    </AuthContext.Provider>
  </MemoryRouter>);
}

beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue({ data: [] }); });

test("Pedidos excluye archivados de proyectos, contadores y detalles", () => {
  mostrar(<MisSolicitudes />);
  expect(screen.getByText("2 proyectos")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Abrir Proyecto antiguo/ })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir Proyecto mixto, 1 pedidos" }));
  expect(screen.getByText("Activo")).toBeInTheDocument();
  expect(screen.queryByText("Archivado")).not.toBeInTheDocument();
});

test("Gestión excluye archivados incluso con datos mezclados y al buscar", async () => {
  mostrar(<ValidarSolicitudes />);
  await waitFor(() => expect(api.get).toHaveBeenCalledWith("/api/proyectos"));
  expect(screen.queryByText("Archivado")).not.toBeInTheDocument();
  expect(screen.queryByText("Antiguo")).not.toBeInTheDocument();
  expect(within(screen.getAllByRole("combobox")[0]).queryByRole("option", { name: "Archivar" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Proyecto mixto" } });
  expect(screen.getByText("Activo")).toBeInTheDocument();
  expect(screen.queryByText("Archivado")).not.toBeInTheDocument();
  expect(screen.queryByText("Otro")).not.toBeInTheDocument();
});

test("Histórico consulta archivados, agrupa, busca, abre detalles y recupera", async () => {
  api.get.mockResolvedValue({ data: pedidos });
  api.put.mockResolvedValue({ data: { ...pedidos[2], estado: "Pendiente" } });
  const setSolicitudes = jest.fn();
  mostrar(<HistoricoPedidos />, setSolicitudes);
  const proyecto = await screen.findByRole("button", { name: "Abrir Proyecto mixto, 1 pedidos" });
  expect(api.get).toHaveBeenCalledWith("/api/pedidos", { params: { estado: "Archivar" } });
  expect(screen.getByText("2 proyectos")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Abrir Proyecto activo/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "mixto" } });
  expect(screen.queryByRole("button", { name: /Abrir Proyecto antiguo/ })).not.toBeInTheDocument();
  fireEvent.click(proyecto);
  fireEvent.click(screen.getByRole("listitem", { name: "Ver solicitud original de Archivado" }));
  expect(screen.getByText("Material urgente")).toBeInTheDocument();
  expect(screen.getByText("Material planificable")).toBeInTheDocument();
  expect(screen.getByText("urgente.pdf")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
  fireEvent.click(screen.getByRole("button", { name: "Ver comentarios" }));
  expect(screen.getByText("Compra histórica")).toBeInTheDocument();
  expect(screen.getByText("factura.pdf")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Cerrar modal" }));
  expect(screen.queryByRole("button", { name: "Eliminar pedido" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Recuperar" }));
  fireEvent.click(screen.getByRole("button", { name: "Recuperar pedido" }));
  await waitFor(() => expect(screen.queryByText("Archivado")).not.toBeInTheDocument());
  expect(api.put).toHaveBeenCalledWith("/api/pedidos/archivado", { estado: "Pendiente" });
  const actualizados = setSolicitudes.mock.calls[0][0]([pedidos[0]]);
  expect(actualizados.map(pedido => pedido.estado)).toEqual(["Pendiente", "Pendiente"]);
  fireEvent.click(screen.getByRole("button", { name: "Todos los proyectos" }));
  expect(screen.getByText("1 proyectos")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "" } });
  expect(screen.getByRole("button", { name: "Abrir Proyecto antiguo, 1 pedidos" })).toBeInTheDocument();
});
