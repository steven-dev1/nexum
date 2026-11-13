import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Cell } from "./datasets";

type Column = { header: string; width?: number };

/** Nombre de archivo seguro: sin acentos, espacios ni caracteres raros. */
export function fileName(parts: string[], ext: string) {
  const base = parts
    .join("-")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `${base || "exportacion"}.${ext}`;
}

/** Excel (.xlsx): encabezado en negrita, fila fija, filtros y anchos de columna. Las celdas son siempre texto o número (nunca fórmulas). */
export async function buildXlsx(title: string, subtitle: string, columns: Column[], rows: Cell[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Nexum";
  wb.created = new Date();
  const ws = wb.addWorksheet(title.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });

  ws.columns = columns.map((c) => ({ header: c.header, width: c.width ?? 18 }));
  const header = ws.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  header.alignment = { vertical: "middle" };

  for (const row of rows) ws.addRow(row.map((c) => (c === null ? "" : c)));
  if (columns.length > 0) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  // Hoja de datos del archivo (qué es, de cuándo y quién lo generó).
  const info = wb.addWorksheet("Datos del archivo");
  info.columns = [{ width: 22 }, { width: 60 }];
  info.addRows([
    ["Reporte", title],
    ["Rango", subtitle],
    ["Filas", rows.length],
    ["Generado", new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" })],
    ["Origen", "Nexum"],
  ]);
  info.getColumn(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** PDF horizontal (A4) con encabezado, tabla paginada y pie con numeración. */
export function buildPdf(title: string, subtitle: string, columns: Column[], rows: Cell[][]): Buffer {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const margin = 36;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, margin, 40);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(`${subtitle}  ·  ${rows.length} fila${rows.length === 1 ? "" : "s"}`, margin, 56);
  doc.setTextColor(0);

  autoTable(doc, {
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => r.map((c) => (c === null ? "" : String(c)))),
    startY: 70,
    margin: { left: margin, right: margin, bottom: 36 },
    styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [29, 78, 216], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [244, 247, 252] },
    showHead: "everyPage",
  });

  const pages = doc.getNumberOfPages();
  const stamp = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(`Nexum · ${stamp}`, margin, doc.internal.pageSize.getHeight() - 18);
    doc.text(`Página ${i} de ${pages}`, doc.internal.pageSize.getWidth() - margin, doc.internal.pageSize.getHeight() - 18, { align: "right" });
  }
  return Buffer.from(doc.output("arraybuffer"));
}
