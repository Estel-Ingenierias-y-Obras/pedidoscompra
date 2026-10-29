import { generarSolicitudPdf } from "./solicitudPdf";

test("genera un PDF paginado con datos, materiales y caracteres españoles", async () => {
  const original = global.Image;
  global.Image = class {
    width = 1;
    height = 1;
    set src(value) { this.onload(); }
  };
  // El logo se sustituye por un píxel válido para probar el PDF real en jsdom.
  const { jsPDF } = await import("jspdf");
  const imagen = jest.spyOn(jsPDF.API, "addImage").mockReturnThis();
  try {
    const { doc, nombre } = await generarSolicitudPdf({
      _id: "solicitud-1", proyecto: "Proyecto/Ávila", solicitante: "María", email: "maria@example.com",
      compradorAsignado: "José", estado: "Archivar", fechaCreacion: "2026-10-28", urgente: true,
      motivoUrgencia: "Necesidad urgente", descripcion: "Comentario planificable", comentarioCompras: "Compra completada",
      elementosUrgentes: Array.from({ length: 100 }, (_, i) => ({ elemento: `Material ${i}`, referencia: `REF-${i}`, descripcionMaterial: "Descripción", cantidad: 2, descripcion: "Observación" })),
      archivosUrgente: [{ nombre: "plano.pdf" }], adjuntosCompras: [{ nombre: "factura.pdf" }]
    }, new Date("2026-10-29T12:00:00Z"));
    expect(nombre).toBe("Solicitud_Proyecto_Avila_2026-10-29.pdf");
    expect(doc.getNumberOfPages()).toBeGreaterThan(2);
    const pdf = doc.output();
    for (const contenido of ["REF-99", "Comentario planificable", "Necesidad urgente", "María", "José", "Observación"]) {
      expect(pdf).toContain(contenido);
    }
    for (const eliminado of ["Estado actual / final registrado", "Tipo de solicitud", "Identificador", "Información de Compras", "Adjuntos", "plano.pdf", "factura.pdf", "Compra completada", "solicitud-1", "Archivar"]) {
      expect(pdf).not.toContain(eliminado);
    }
    expect(pdf).toContain(`de ${doc.getNumberOfPages()}`);
    expect(pdf.startsWith("%PDF-")).toBe(true);
  } finally {
    imagen.mockRestore();
    global.Image = original;
  }
});
