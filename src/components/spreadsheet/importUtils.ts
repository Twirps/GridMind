import * as XLSX from "xlsx";
import { SheetData, CellData, cellKey } from "./types";

export async function importFromFile(file: File): Promise<SheetData[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { cellFormula: true, cellStyles: true });

  return wb.SheetNames.map((name, idx) => {
    const ws = wb.Sheets[name];
    const cells: Record<string, CellData> = {};
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];
        if (!cell) continue;

        const cellData: CellData = { value: "" };

        if (cell.f) {
          cellData.formula = `=${cell.f}`;
          cellData.value = cell.v != null ? String(cell.v) : "";
        } else if (cell.v != null) {
          cellData.value = String(cell.v);
        }

        // Read style info (wrapText + horizontal alignment)
        const style: any = (cell as any).s;
        const alignment = style?.alignment;
        if (alignment?.wrapText) {
          cellData.wrapMode = "wrap";
        }
        const horiz = alignment?.horizontal;
        if (horiz === "left" || horiz === "center" || horiz === "right") {
          cellData.align = horiz;
        }

        if (cellData.value || cellData.formula) {
          cells[cellKey(r, c)] = cellData;
        }
      }
    }

    const colWidths: Record<number, number> = {};
    if (ws["!cols"]) {
      ws["!cols"].forEach((col, i) => {
        if (col?.wpx) colWidths[i] = col.wpx;
      });
    }

    return { id: `sheet-${idx + 1}`, name, cells, colWidths, rowHeights: {} };
  });
}
