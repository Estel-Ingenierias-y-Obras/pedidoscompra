import logo from "../assets/ESTEL_LOGO_RGB POSITIVO.png";

const texto = valor => String(valor ?? "").trim() || "Sin información";
const fecha = valor => valor && !Number.isNaN(new Date(valor).getTime())
  ? new Date(valor).toLocaleDateString("es-ES", { timeZone: "Europe/Madrid" }) : "Sin fecha";

export function datosSolicitudPdf(pedido) {
  const grupos = pedido.urgente ? [
    ["Necesidades urgentes", pedido.motivoUrgencia, pedido.elementosUrgentes],
    ["Necesidades planificables", pedido.descripcion, pedido.elementosNoUrgentes]
  ] : [["Necesidades planificables / materiales solicitados", pedido.descripcion, pedido.elementos]];
  return { grupos };
}

export async function generarSolicitudPdf(pedido, ahora = new Date()) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"), import("jspdf-autotable")
  ]);
  const doc = new jsPDF();
  const imagen = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar el logo corporativo"));
    img.src = logo;
  });
  const anchoLogo = 38;
  doc.addImage(imagen, "PNG", 156, 12, anchoLogo, Math.min(20, anchoLogo * imagen.height / imagen.width));
  doc.setFontSize(20);
  doc.setTextColor(24, 55, 80);
  doc.text("Solicitud de compra", 16, 22);
  let y = 42;
  const tabla = (head, body, opciones = {}) => {
    autoTable(doc, {
      startY: y, head, body, margin: { top: 20, bottom: 22, left: 16, right: 16 },
      styles: { font: "helvetica", fontSize: 9, cellPadding: 3, overflow: "linebreak" },
      headStyles: { fillColor: [24, 55, 80] }, theme: "striped", ...opciones
    });
    y = doc.lastAutoTable.finalY + 8;
  };
  tabla([["Datos de la solicitud", "Información"]], [
    ["Proyecto", texto(pedido.proyecto)], ["Solicitante", texto(pedido.solicitante)],
    ["Email del solicitante", texto(pedido.email)],
    ["Comprador", pedido.compradorAsignado || "Sin asignar"],
    ["Fecha de solicitud", fecha(pedido.fechaCreacion)]
  ]);
  const { grupos } = datosSolicitudPdf(pedido);
  grupos.forEach(([titulo, comentario, elementos]) => {
    tabla([[titulo]], [[texto(comentario)]]);
    if (elementos?.length) tabla([["Material", "Referencia", "Descripción", "Cantidad", "Observaciones"]],
      elementos.map(item => [texto(item.elemento), texto(item.referencia), texto(item.descripcionMaterial),
        `${item.cantidad ?? ""} ${item.unidadMedida || ""}`.trim(), texto(item.descripcion)]),
      { columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 28 }, 2: { cellWidth: 46 }, 3: { cellWidth: 22 }, 4: { cellWidth: 50 } } });
  });
  const dia = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);
  const proyecto = String(pedido.proyecto || "Sin_proyecto").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 80);
  const nombre = `Solicitud_${proyecto}_${dia}.pdf`;
  const paginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(`Generado: ${ahora.toLocaleString("es-ES", { timeZone: "Europe/Madrid" })}`, 16, 282);
    doc.text(`Página ${pagina} de ${paginas}`, 194, 282, { align: "right" });
    doc.text(nombre, 16, 288);
  }
  return { doc, nombre };
}

export async function descargarSolicitudPdf(pedido) {
  const { doc, nombre } = await generarSolicitudPdf(pedido);
  doc.save(nombre);
}
