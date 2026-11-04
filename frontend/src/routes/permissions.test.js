import { puedeAcceder } from "./permissions";

test("movimientos comparte los permisos de Almacén", () => {
  for (const rol of ["Admin", "Comprador"]) {
    expect(puedeAcceder(rol, "/material/almacen/movimientos")).toBe(true);
    expect(puedeAcceder(rol, "/material/almacen/movimientos/")).toBe(true);
    expect(puedeAcceder(rol, "/material/almacen/movimientos/enviados")).toBe(true);
  }
  for (const rol of ["Usuario", "Encargado", undefined]) {
    expect(puedeAcceder(rol, "/material/almacen/movimientos")).toBe(false);
  }
  expect(puedeAcceder("Admin", "/material/almacen/desconocido")).toBe(false);
});
test("Enviados a BC comparte los permisos del módulo Pedidos Compra", () => {
  for (const rol of ["Admin", "Comprador"]) expect(puedeAcceder(rol, "/pedidos-compra/enviados")).toBe(true);
  for (const rol of ["Usuario", "Encargado", undefined]) expect(puedeAcceder(rol, "/pedidos-compra/enviados")).toBe(false);
});
