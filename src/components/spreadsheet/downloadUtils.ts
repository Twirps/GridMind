import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { SheetData, colLabel, NUM_ROWS, NUM_COLS, cellKey } from "./types";

function getSheetMatrix(sheet: SheetData): string[][] {
  // Find the actual used bounds
  let maxRow = 0;
  let maxCol = 0;
  Object.keys(sheet.cells).forEach((key) => {
    const [r, c] = key.split(",").map(Number);
    if (r > maxRow) maxRow = r;
    if (c > maxCol) maxCol = c;
  });

  const rows: string[][] = [];
  for (let r = 0; r <= maxRow; r++) {
    const row: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cell = sheet.cells[cellKey(r, c)];
      const val = cell?.computed !== undefined ? cell.computed : (cell?.value ?? "");
      row.push(String(val));
    }
    rows.push(row);
  }
  return rows;
}

export function downloadCSV(sheet: SheetData) {
  const matrix = getSheetMatrix(sheet);
  const csv = matrix
    .map((row) => row.map((v) => `"${v.replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${sheet.name}.csv`);
}

export function downloadExcel(sheets: SheetData[]) {
  const wb = XLSX.utils.book_new();
  sheets.forEach((sheet) => {
    const matrix = getSheetMatrix(sheet);
    // Build aoa with styles by iterating cells
    let maxRow = 0;
    let maxCol = 0;
    Object.keys(sheet.cells).forEach((key) => {
      const [r, c] = key.split(",").map(Number);
      if (r > maxRow) maxRow = r;
      if (c > maxCol) maxCol = c;
    });

    const aoa: (string | number)[][] = [];
    for (let r = 0; r <= maxRow; r++) {
      const row: (string | number)[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const cell = sheet.cells[cellKey(r, c)];
        const val = cell?.computed !== undefined ? cell.computed : (cell?.value ?? "");
        // Try to keep numeric values as numbers
        const num = Number(val);
        row.push(val !== "" && !isNaN(num) ? num : String(val));
      }
      aoa.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  });
  XLSX.writeFile(wb, "spreadsheet.xlsx");
}

export function downloadPDF(sheet: SheetData) {
  const matrix = getSheetMatrix(sheet);
  if (matrix.length === 0) {
    alert("No data to export.");
    return;
  }

  const maxCols = matrix[0]?.length ?? 0;
  const headers = Array.from({ length: maxCols }, (_, c) => colLabel(c));

  // Determine orientation based on column count
  const orientation = maxCols > 8 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(sheet.name, 14, 14);

  autoTable(doc, {
    head: [headers],
    body: matrix,
    startY: 20,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 10, right: 10 },
  });

  doc.save(`${sheet.name}.pdf`);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
