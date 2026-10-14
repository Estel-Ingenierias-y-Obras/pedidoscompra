import { puedeAcceder } from "./permissions";

test("movimientos comparte los permisos de Almacén", () => {
  for (const rol of ["Admin", "Comprador"]) {
    expect(puedeAcceder(rol, "/material/almacen/movimientos")).toBe(true);
    expect(puedeAcceder(rol, "/material/almacen/movimientos/")).toBe(true);
  }
  for (const rol of ["Usuario", "Encargado", undefined]) {
    expect(puedeAcceder(rol, "/material/almacen/movimientos")).toBe(false);
  }
  expect(puedeAcceder("Admin", "/material/almacen/desconocido")).toBe(false);
});
