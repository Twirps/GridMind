import * as XLSX from "xlsx";
import { SheetData, CellData, cellKey } from "./types";

function argbToHex(s: any): string | undefined {
  if (!s || typeof s !== "string") return undefined;
  const v = s.trim().replace(/^#/, "");
  if (v.length === 8) return `#${v.slice(2).toUpperCase()}`;
  if (v.length === 6) return `#${v.toUpperCase()}`;
  return undefined;
}

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

        const style: any = (cell as any).s;

        // Font properties
        const font = style?.font;
        if (font) {
          if (font.bold) cellData.bold = true;
          if (font.italic) cellData.italic = true;
          if (font.underline) cellData.underline = true;
          if (typeof font.sz === "number") cellData.fontSize = font.sz;
          const textColor = argbToHex(font.color?.rgb);
          if (textColor) cellData.textColor = textColor;
        }

        // Fill / background color
        const fill = style?.fill;
        if (fill) {
          // SheetJS exposes solid fills via fgColor.rgb most commonly
          const bg =
            argbToHex(fill.fgColor?.rgb) ||
            argbToHex(fill.bgColor?.rgb);
          // Skip pure white fills that often come as default "no fill"
          if (bg && bg !== "#FFFFFF") cellData.bgColor = bg;
        }

        // Alignment + wrap
        const alignment = style?.alignment;
        if (alignment?.wrapText) {
          cellData.wrapMode = "wrap";
        }
        const horiz = alignment?.horizontal;
        if (horiz === "left" || horiz === "center" || horiz === "right") {
          cellData.align = horiz;
        }

        // Store cell if it has value, formula, OR any styling
        const hasStyle =
          cellData.bold ||
          cellData.italic ||
          cellData.underline ||
          cellData.fontSize !== undefined ||
          cellData.textColor !== undefined ||
          cellData.bgColor !== undefined ||
          cellData.wrapMode !== undefined ||
          cellData.align !== undefined;

        if (cellData.value || cellData.formula || hasStyle) {
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

    const rowHeights: Record<number, number> = {};
    if (ws["!rows"]) {
      ws["!rows"].forEach((row: any, i: number) => {
        if (row?.hpx) rowHeights[i] = row.hpx;
      });
    }

    return { id: `sheet-${idx + 1}`, name, cells, colWidths, rowHeights };
  });
}
