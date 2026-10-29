import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import AttachmentList from "./AttachmentList";
import api from "../api";

jest.mock("../api", () => ({ get: jest.fn() }));

test("solo ofrece Visualizar y abre el archivo completo en el navegador", async () => {
  api.get.mockResolvedValue({ data: new Blob(["documento"], { type: "application/pdf" }) });
  const crear = URL.createObjectURL;
  URL.createObjectURL = jest.fn(() => "blob:documento");
  const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    render(<AttachmentList pedido={{ _id: "1", archivos: [{ fileId: "f1", nombre: "plano.pdf" }] }} />);
    expect(screen.queryByRole("button", { name: /Descargar/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Visualizar plano.pdf" }));
    await waitFor(() => expect(click).toHaveBeenCalled());
    expect(api.get).toHaveBeenCalledWith("/api/pedidos/1/archivos/f1", { params: undefined, responseType: "blob" });
    expect(click.mock.instances[0].target).toBe("_blank");
    expect(click.mock.instances[0].href).toBe("blob:documento");
  } finally { URL.createObjectURL = crear; click.mockRestore(); }
});
