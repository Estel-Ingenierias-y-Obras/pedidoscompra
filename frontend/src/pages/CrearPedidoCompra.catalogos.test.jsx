import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import api from "../api";
import CrearPedidoCompra from "./CrearPedidoCompra";
jest.mock("../api", () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock("../components/Layout", () => ({ children }) => <div>{children}</div>);
jest.mock("../components/LineasMovimiento", () => () => <div>Materiales</div>);

test("selecciona códigos reales, sincroniza proveedor y nombre y descarta usuarios inventados", async () => {
  localStorage.clear();
  Object.defineProperty(global, "crypto", { configurable: true, value: { randomUUID: () => "12345678-1234-4234-8234-123456789012" } });
  api.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/configuracion") ? { entorno: "Production", empresaId: "empresa", empresa: "Empresa" }
    : url.endsWith("/direccion-entrega") ? { nombre: config.params.tipo === "almacen" ? "Almacén destino" : "Proyecto destino", direccion: config.params.tipo === "almacen" ? "Calle almacén" : "Calle " + config.params.proyecto, pais: "ES" }
      : url.endsWith("/paises-entrega") ? [{ code: "ES", name: "España" }]
    : url === "/api/proyectos" ? [{ nomProyecto: "ACEES24-001", descProyecto: "Proyecto" }, { nomProyecto: "ACEES24-002", descProyecto: "Otro proyecto" }]
      : url.endsWith("/usuarios-asignados") ? [{ userId: "JAVIER.GURDIEL" }]
        : url.endsWith("/tareas") ? [{ number: "CAP1", description: "Almacén" }]
          : url.endsWith("/clientes") ? [{ number: "C001", displayName: "Cliente prueba" }]
            : url.endsWith("/direcciones-cliente") ? [{ code: "OBRA", name: "Obra cliente" }]
              : url.endsWith("/almacenes-entrega") ? [{ code: "CENTRAL", displayName: "Central" }] : [{ number: "P0039", displayName: "Traditel S.L." }] }));
  render(<MemoryRouter><AuthContext.Provider value={{ user: { email: "compras@example.test" } }}><CrearPedidoCompra /></AuthContext.Provider></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Nº de proveedor" })).not.toBeDisabled());
  const entrega = within(screen.getByRole("group", { name: "Envío y pago" }));
  await waitFor(() => expect(entrega.getByLabelText("Dirección de envío")).not.toBeDisabled());
  const envio = entrega.getByLabelText("Dirección de envío");
  expect(within(envio).getAllByRole("option").map(o => o.textContent)).toEqual(["Predeterminado", "Almacén", "Dirección del cliente", "Dirección personalizada"]);
  expect(entrega.queryByRole("combobox", { name: "Cliente" })).not.toBeInTheDocument();
  expect(entrega.queryByLabelText("Nombre")).not.toBeInTheDocument();
  expect(entrega.queryByLabelText("Dirección")).not.toBeInTheDocument();
  expect(entrega.getByLabelText("Dirección pago")).toHaveValue("proveedor");
  fireEvent.change(envio, { target: { value: "almacen" } });
  fireEvent.focus(entrega.getByRole("combobox", { name: "Cód. almacén" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "CENTRAL · Central" }));
  expect(api.get).toHaveBeenCalledWith("/api/pedidos-compra/direccion-entrega", { params: { tipo: "almacen", almacen: "CENTRAL", cliente: "", codigoDireccion: "" } });
  fireEvent.change(entrega.getByLabelText("Dirección de envío"), { target: { value: "cliente" } });
  fireEvent.focus(entrega.getByRole("combobox", { name: "Cliente" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "C001 · Cliente prueba" }));
  await waitFor(() => expect(entrega.getByRole("combobox", { name: "Cód. dirección envío cliente" })).not.toBeDisabled());
  fireEvent.focus(entrega.getByRole("combobox", { name: "Cód. dirección envío cliente" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "OBRA · Obra cliente" }));
  expect(api.get).toHaveBeenCalledWith("/api/pedidos-compra/direcciones-cliente", { params: { cliente: "C001" } });
  fireEvent.change(entrega.getByLabelText("Dirección de envío"), { target: { value: "empresa" } });
  expect(entrega.queryByRole("combobox", { name: "Cliente" })).not.toBeInTheDocument();
  expect(entrega.queryByRole("combobox", { name: "Cód. dirección envío cliente" })).not.toBeInTheDocument();
  fireEvent.change(envio, { target: { value: "personalizada" } });
  expect(entrega.getByLabelText("Nombre")).not.toHaveAttribute("readonly");
  fireEvent.change(entrega.getByLabelText("Nombre"), { target: { value: "Entrega libre" } });
  fireEvent.change(entrega.getByLabelText("Dirección"), { target: { value: "Calle nueva" } });
  expect(entrega.getByLabelText("Nombre")).toHaveValue("Entrega libre");
  expect(entrega.getByRole("combobox", { name: "País/Región" })).toBeInTheDocument();
  fireEvent.change(envio, { target: { value: "cliente" } });
  expect(entrega.getByRole("combobox", { name: "Cliente" })).toHaveValue("");
  fireEvent.change(envio, { target: { value: "empresa" } });
  expect(screen.getByRole("combobox", { name: "Tarea" })).toBeDisabled();
  fireEvent.focus(screen.getByRole("combobox", { name: "Nº de proveedor" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "P0039 · Traditel S.L." }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Nº de proveedor" })).toHaveValue("P0039 · Traditel S.L."));
  expect(screen.queryByLabelText("Nombre del proveedor")).not.toBeInTheDocument();
  fireEvent.focus(screen.getByRole("combobox", { name: "Proyecto" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "ACEES24-001 · Proyecto" }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Tarea" })).not.toBeDisabled());
  fireEvent.focus(screen.getByRole("combobox", { name: "Tarea" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "CAP1 · Almacén" }));
  expect(api.get).toHaveBeenCalledWith("/api/pedidos-compra/tareas", { params: { proyecto: "ACEES24-001" } });
  await screen.findByText("Calle ACEES24-001");
  expect(api.get).toHaveBeenCalledWith("/api/pedidos-compra/direccion-entrega", { params: { tipo: "empresa", proyecto: "ACEES24-001", almacen: "", cliente: "", codigoDireccion: "" } });
  fireEvent.focus(screen.getByRole("combobox", { name: "Proyecto" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "ACEES24-002 · Otro proyecto" }));
  await screen.findByText("Calle ACEES24-002");
  fireEvent.change(envio, { target: { value: "almacen" } });
  fireEvent.focus(entrega.getByRole("combobox", { name: "Cód. almacén" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "CENTRAL · Central" }));
  await screen.findByText("Calle almacén");
  fireEvent.focus(screen.getByRole("combobox", { name: "Proyecto" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "ACEES24-001 · Proyecto" }));
  await screen.findByText("Calle almacén");
  expect(envio).toHaveValue("almacen");
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Tarea" })).not.toBeDisabled());
  fireEvent.change(envio, { target: { value: "personalizada" } });
  fireEvent.change(entrega.getByLabelText("Dirección"), { target: { value: "Dirección elegida por el usuario" } });
  fireEvent.focus(screen.getByRole("combobox", { name: "Proyecto" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "ACEES24-002 · Otro proyecto" }));
  expect(entrega.getByLabelText("Dirección")).toHaveValue("Dirección elegida por el usuario");
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Tarea" })).not.toBeDisabled());
  const usuario = screen.getByRole("combobox", { name: "Id. usuario asignado" });
  fireEvent.focus(usuario);
  fireEvent.change(usuario, { target: { value: "JAVIER.COSTA" } });
  expect(screen.queryByRole("option", { name: "JAVIER.COSTA" })).not.toBeInTheDocument();
  fireEvent.blur(usuario);
  expect(usuario).toHaveValue("");
  expect(api.post).not.toHaveBeenCalled();
}, 15000);

test("pago muestra nombre y contacto según la opción y limpia los datos al cambiar", async () => {
  localStorage.clear();
  Object.defineProperty(global, "crypto", { configurable: true, value: { randomUUID: () => "12345678-1234-4234-8234-123456789012" } });
  api.get.mockImplementation(async (url, config) => ({ data: url.endsWith("/configuracion") ? { entorno: "Production", empresaId: "empresa", empresa: "Empresa" }
    : url === "/api/proyectos" ? [] : url.endsWith("/usuarios-asignados") ? []
      : url.endsWith("/direccion-entrega") ? { nombre: "Empresa", direccion: "Calle" }
        : url.endsWith("/paises-entrega") ? [{ code: "ES", name: "España" }]
          : url.endsWith("/almacenes-entrega") ? []
            : url.endsWith("/proveedor-pago") ? { name: config.params.proveedor === "P0040" ? "Otro S.L." : "Traditel S.L.", direccion: "Calle proveedor", pais: "ES" }
              : url.endsWith("/contactos-pago") ? [{ number: "CT001", name: "Eva" }]
                : [{ number: "P0039", displayName: "Traditel S.L." }, { number: "P0040", displayName: "Otro S.L." }] }));
  render(<MemoryRouter><AuthContext.Provider value={{ user: { email: "compras@example.test" } }}><CrearPedidoCompra /></AuthContext.Provider></MemoryRouter>);
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Nº de proveedor" })).not.toBeDisabled());
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Nº de proveedor" })).not.toBeDisabled());
  fireEvent.focus(screen.getByRole("combobox", { name: "Nº de proveedor" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "P0039 · Traditel S.L." }));
  const seccion = within(screen.getByRole("group", { name: "Envío y pago" }));
  const pago = seccion.getByLabelText("Dirección pago");
  expect(within(pago).getAllByRole("option").map(o => o.textContent)).toEqual(["Predeterminado (proveedor)", "Otro proveedor", "Dirección personalizada"]);
  expect(seccion.queryByLabelText("Contacto")).not.toBeInTheDocument();
  fireEvent.change(pago, { target: { value: "otro" } });
  fireEvent.focus(seccion.getByRole("combobox", { name: "Nombre" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "Otro S.L." }));
  await waitFor(() => expect(seccion.getByRole("combobox", { name: "Contacto" })).not.toBeDisabled());
  fireEvent.focus(seccion.getByRole("combobox", { name: "Contacto" }));
  fireEvent.mouseDown(await screen.findByRole("option", { name: "Eva" }));
  const borrador = () => JSON.parse(localStorage.getItem("pedido-compra-v2:Production:empresa:compras@example.test")).cuerpo;
  expect(borrador().pago).toEqual({ tipo: "otro", proveedor: "P0040", codigoContacto: "CT001", contacto: "Eva" });
  fireEvent.change(pago, { target: { value: "personalizada" } });
  await waitFor(() => expect(seccion.getByLabelText("Nombre")).toHaveValue("Traditel S.L."));
  expect(seccion.getByLabelText("Nombre")).toHaveAttribute("readonly");
  expect(borrador().pago.codigoContacto).toBe("");
  fireEvent.click(seccion.getByText("Detalles de dirección de pago"));
  fireEvent.change(seccion.getByLabelText("Dirección"), { target: { value: "Calle nueva" } });
  expect(borrador().pago.personalizada.direccion).toBe("Calle nueva");
  fireEvent.change(pago, { target: { value: "proveedor" } });
  expect(seccion.queryByLabelText("Nombre")).not.toBeInTheDocument();
  expect(seccion.queryByLabelText("Contacto")).not.toBeInTheDocument();
  expect(borrador().pago).toEqual({ tipo: "proveedor", proveedor: "", codigoContacto: "", contacto: "" });
});
