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
jest.mock("../hooks/useProjectCatalog", () => () => [
  { nomProyecto: "P12345", descProyecto: "ENERGÍA MALLORCA" },
  { nomProyecto: "P23456", descProyecto: "ENERGÍA IBIZA" },
  { nomProyecto: "SIN-PEDIDOS", descProyecto: "ENERGÍA MENORCA" }
]);

const pedidos = [
  { _id: "activo", proyecto: "Proyecto mixto", estado: "Pendiente", solicitante: "Activo" },
  { _id: "otro", proyecto: "Proyecto activo", estado: "Pedido", solicitante: "Otro" },
  { _id: "archivado", proyecto: "Proyecto mixto", estado: "Archivar", solicitante: "Archivado", urgente: true, motivoUrgencia: "Material urgente", descripcion: "Material planificable", comentarioCompras: "Compra histórica", archivosUrgente: [{ fileId: "f1", nombre: "urgente.pdf" }], adjuntosCompras: [{ fileId: "f2", nombre: "factura.pdf" }] },
  { _id: "antiguo", proyecto: "Proyecto antiguo", estado: "Archivar", solicitante: "Antiguo" }
];

function mostrar(page, setSolicitudes = jest.fn(), rol = "Admin", datos = pedidos) {
  return render(<MemoryRouter>
    <AuthContext.Provider value={{ user: { rol, email: "admin@example.com" } }}>
      <UsuariosContext.Provider value={{ usuarios: [] }}>
        <SolicitudesContext.Provider value={{ solicitudes: datos, setSolicitudes }}>
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
  fireEvent.change(screen.getByRole("textbox", { name: "Buscar proyecto o solicitante" }), { target: { value: "mixto" } });
  fireEvent.keyDown(screen.getByRole("textbox", { name: "Buscar proyecto o solicitante" }), { key: "Enter" });
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
  expect(screen.getByRole("button", { name: "Abrir Proyecto antiguo, 1 pedidos" })).toBeInTheDocument();
});

test.each([false, true])("Buscador único en histórico=%s: tipos, selección y agrupación", async historico => {
  const datos = [
    { _id: "1", proyecto: "P12345", solicitante: "Juan Pérez", email: "juan@example.com" },
    { _id: "2", proyecto: "P12345", solicitante: "Ana", email: "ana@example.com" },
    { _id: "3", proyecto: "P23456", solicitante: "Juan Pérez", email: "juan@example.com" },
    { _id: "4", proyecto: "Juan García", solicitante: "Juan García", email: "garcia@example.com" },
    { _id: "5", proyecto: "P23456", solicitante: "Juan Pérez", email: "otro-juan@example.com" }
  ].map(pedido => ({ ...pedido, estado: historico ? "Archivar" : "Pendiente" }));
  datos.push({ _id: "fuera", proyecto: "Fuera", solicitante: "Fuera", estado: historico ? "Pedido" : "Archivar" });
  api.get.mockResolvedValue({ data: datos });
  mostrar(historico ? <HistoricoPedidos /> : <MisSolicitudes />, jest.fn(), historico ? "Encargado" : "Usuario", datos);
  await screen.findByRole("button", { name: "Abrir P12345, 2 pedidos" });
  expect(screen.getAllByRole("textbox")).toHaveLength(1);
  expect(screen.queryByText("Modo de filtrado")).not.toBeInTheDocument();
  const buscador = screen.getByRole("textbox", { name: "Buscar proyecto o solicitante" });
  const llamadas = api.get.mock.calls.length;
  fireEvent.change(buscador, { target: { value: "ener" } });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(screen.queryByRole("option")).not.toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Proyecto:");
  fireEvent.change(buscador, { target: { value: "energia mall" } });
  fireEvent.keyDown(buscador, { key: "Tab" });
  expect(buscador).toHaveValue("ENERGÍA MALLORCA");
  expect(screen.getByText("1 proyectos")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir P12345, 2 pedidos" }));
  expect(screen.getByRole("listitem", { name: "Ver solicitud original de Juan Pérez" })).toBeInTheDocument();
  expect(screen.getByRole("listitem", { name: "Ver solicitud original de Ana" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Editar pedido" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Eliminar pedido" })).not.toBeInTheDocument();
  fireEvent.change(buscador, { target: { value: "Juan Pérez (juan@" } });
  fireEvent.keyDown(buscador, { key: "Enter" });
  expect(screen.getByText("2 proyectos")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Abrir P12345, 1 pedidos" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Abrir P23456, 1 pedidos" }));
  expect(screen.getByRole("listitem", { name: "Ver solicitud original de Juan Pérez" })).toBeInTheDocument();
  expect(screen.queryByRole("listitem", { name: "Ver solicitud original de Ana" })).not.toBeInTheDocument();
  fireEvent.change(buscador, { target: { value: "" } });
  expect(buscador).toHaveValue("");
  expect(screen.getByText("3 proyectos")).toBeInTheDocument();
  fireEvent.change(buscador, { target: { value: "no existe" } });
  expect(screen.getByRole("status")).toHaveTextContent("No se encontraron proyectos ni solicitantes");
  fireEvent.keyDown(buscador, { key: "Escape" });
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  expect(api.get).toHaveBeenCalledTimes(llamadas);
});
