import { renderHook, waitFor } from "@testing-library/react";
import { AuthContext } from "../context/AuthContext";
import useProjectCatalog from "./useProjectCatalog";
import api from "../api";

jest.mock("../api", () => ({ get: jest.fn() }));

test("reutiliza descripciones al navegar entre páginas sin repetir consultas", async () => {
  const catalogo = [{ nomProyecto: "P1", descProyecto: "Energía" }];
  api.get.mockResolvedValue({ data: { value: catalogo } });
  const wrapper = ({ children }) => <AuthContext.Provider value={{ user: { email: "cache@example.com" } }}>{children}</AuthContext.Provider>;
  const primera = renderHook(() => useProjectCatalog(), { wrapper });
  await waitFor(() => expect(primera.result.current).toEqual(catalogo));
  primera.unmount();
  const segunda = renderHook(() => useProjectCatalog(), { wrapper });
  await waitFor(() => expect(segunda.result.current).toEqual(catalogo));
  expect(api.get).toHaveBeenCalledTimes(1);
});

test("si falla el catálogo devuelve lista vacía para conservar los códigos", async () => {
  api.get.mockRejectedValue(new Error("Sin catálogo"));
  const wrapper = ({ children }) => <AuthContext.Provider value={{ user: { email: "error@example.com" } }}>{children}</AuthContext.Provider>;
  const { result } = renderHook(() => useProjectCatalog(), { wrapper });
  await waitFor(() => expect(result.current).toEqual([]));
});
