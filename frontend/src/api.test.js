import api from "./api";
import { msalInstance } from "./authConfig";

jest.mock("./authConfig", () => ({ msalInstance: {
  getActiveAccount: jest.fn(), getAllAccounts: jest.fn(), setActiveAccount: jest.fn(), acquireTokenSilent: jest.fn()
} }));
const token = () => `header.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.signature`;
const respuesta = config => Promise.resolve({ data: "ok", status: 200, statusText: "OK", headers: {}, config });

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); sessionStorage.clear();
  msalInstance.getActiveAccount.mockReturnValue({ username: "persona@example.com" });
});
afterEach(() => jest.useRealTimers());

test("las lecturas HTTP tienen un límite de espera y conservan el token válido", async () => {
  localStorage.setItem("microsoftAuthToken", token());
  const adapter = jest.fn(respuesta);
  await api.get("/api/almacen/stock", { adapter });
  expect(adapter.mock.calls[0][0].timeout).toBe(60000);
  expect(adapter.mock.calls[0][0].headers.Authorization).toContain("Bearer ");
  expect(msalInstance.acquireTokenSilent).not.toHaveBeenCalled();
});

test("una renovación bloqueada termina y no envía peticiones sin autenticar", async () => {
  jest.useFakeTimers();
  msalInstance.acquireTokenSilent.mockReturnValue(new Promise(() => {}));
  const adapter = jest.fn(respuesta);
  const peticiones = [api.get("/api/almacen/stock", { adapter }), api.get("/api/almacen/productos", { adapter })];
  const terminadas = Promise.allSettled(peticiones);
  await Promise.resolve();
  await Promise.resolve();
  jest.advanceTimersByTime(20001);
  const resultados = await terminadas;
  expect(resultados.every(r => r.status === "rejected")).toBe(true);
  expect(msalInstance.acquireTokenSilent).toHaveBeenCalledTimes(1);
  expect(adapter).not.toHaveBeenCalled();
  expect(sessionStorage.getItem("sessionExpired")).toBe("1");
});
