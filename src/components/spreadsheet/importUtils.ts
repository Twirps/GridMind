import * as XLSX from "xlsx";
import JSZip from "jszip";
import { SheetData, CellData, cellKey } from "./types";

function argbToHex(s: any): string | undefined {
  if (!s || typeof s !== "string") return undefined;
  const v = s.trim().replace(/^#/, "");
  if (v.length === 8) return `#${v.slice(2).toUpperCase()}`;
  if (v.length === 6) return `#${v.toUpperCase()}`;
  return undefined;
}

// ---------- Direct XML style extraction ----------
// SheetJS community build drops font + alignment from cell.s.
// We parse xl/styles.xml and the sheet xml ourselves to recover them.

interface ParsedFont {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  size?: number;
  color?: string; // #RRGGBB
}

interface ParsedXf {
  fontId?: number;
  applyFont?: boolean;
  applyAlignment?: boolean;
  wrapText?: boolean;
  horizontal?: "left" | "center" | "right";
}

interface ParsedStyles {
  fonts: ParsedFont[];
  cellXfs: ParsedXf[];
}

function parseStylesXml(xml: string): ParsedStyles {
  const fonts: ParsedFont[] = [];
  const cellXfs: ParsedXf[] = [];

  // Extract <fonts>...</fonts>
  const fontsBlock = xml.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/);
  if (fontsBlock) {
    const fontMatches = fontsBlock[1].match(/<font[^>]*>[\s\S]*?<\/font>|<font[^/]*\/>/g) || [];
    for (const f of fontMatches) {
      const font: ParsedFont = {};
      if (/<b\s*\/>|<b\s+val="1"/.test(f) || /<b\s*>/.test(f)) font.bold = true;
      if (/<i\s*\/>|<i\s+val="1"/.test(f) || /<i\s*>/.test(f)) font.italic = true;
      if (/<u\s*\/>|<u\s+val=/.test(f) || /<u\s*>/.test(f)) font.underline = true;
      const sz = f.match(/<sz[^>]*val="([\d.]+)"/);
      if (sz) font.size = parseFloat(sz[1]);
      const colorMatch = f.match(/<color[^>]*rgb="([0-9A-Fa-f]+)"/);
      if (colorMatch) {
        const c = argbToHex(colorMatch[1]);
        if (c) font.color = c;
      }
      fonts.push(font);
    }
  }

  // Extract <cellXfs>...</cellXfs>
  const xfsBlock = xml.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/);
  if (xfsBlock) {
    const xfMatches = xfsBlock[1].match(/<xf[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g) || [];
    for (const xfStr of xfMatches) {
      const xf: ParsedXf = {};
      const fontId = xfStr.match(/fontId="(\d+)"/);
      if (fontId) xf.fontId = parseInt(fontId[1], 10);
      if (/applyFont="1"/.test(xfStr)) xf.applyFont = true;
      if (/applyAlignment="1"/.test(xfStr)) xf.applyAlignment = true;
      const align = xfStr.match(/<alignment([^/]*?)\/>/);
      if (align) {
        if (/wrapText="1"/.test(align[1])) xf.wrapText = true;
        const h = align[1].match(/horizontal="(left|center|right)"/);
        if (h) xf.horizontal = h[1] as any;
      }
      cellXfs.push(xf);
    }
  }

  return { fonts, cellXfs };
}

// Parse a sheet xml → map of "A1" → style index (`s=` attr)
function parseSheetStyleIndices(xml: string): Map<string, number> {
  const map = new Map<string, number>();
  // Match <c r="A1" s="3" ...> (s attribute is optional)
  const re = /<c\s+[^>]*r="([A-Z]+\d+)"[^>]*\bs="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    map.set(m[1], parseInt(m[2], 10));
  }
  return map;
}

async function extractDirectXmlStyles(buf: ArrayBuffer): Promise<{
  styles: ParsedStyles | null;
  sheetStyleMaps: Map<string, Map<string, number>>; // sheetName → cellRef → styleIdx
}> {
  try {
    const zip = await JSZip.loadAsync(buf);
    const stylesFile = zip.file("xl/styles.xml");
    if (!stylesFile) return { styles: null, sheetStyleMaps: new Map() };
    const stylesXml = await stylesFile.async("string");
    const styles = parseStylesXml(stylesXml);

    // Build sheet name → file path map via workbook.xml + workbook.xml.rels
    const wbFile = zip.file("xl/workbook.xml");
    const relsFile = zip.file("xl/_rels/workbook.xml.rels");
    const sheetStyleMaps = new Map<string, Map<string, number>>();
    if (!wbFile || !relsFile) return { styles, sheetStyleMaps };

    const wbXml = await wbFile.async("string");
    const relsXml = await relsFile.async("string");

    // sheetName (in order) → rId
    const sheetEntries: Array<{ name: string; rId: string }> = [];
    const sRe = /<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/g;
    let sm: RegExpExecArray | null;
    while ((sm = sRe.exec(wbXml)) !== null) {
      sheetEntries.push({ name: sm[1], rId: sm[2] });
    }

    // rId → target path
    const rels = new Map<string, string>();
    const rRe = /<Relationship[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g;
    let rm: RegExpExecArray | null;
    while ((rm = rRe.exec(relsXml)) !== null) {
      rels.set(rm[1], rm[2]);
    }

    for (const { name, rId } of sheetEntries) {
      const target = rels.get(rId);
      if (!target) continue;
      const path = target.startsWith("/")
        ? target.slice(1)
        : `xl/${target.replace(/^\.\//, "")}`;
      const sheetFile = zip.file(path);
      if (!sheetFile) continue;
      const sheetXml = await sheetFile.async("string");
      sheetStyleMaps.set(name, parseSheetStyleIndices(sheetXml));
    }

    return { styles, sheetStyleMaps };
  } catch {
    return { styles: null, sheetStyleMaps: new Map() };
  }
}

// ---------- Main import ----------

export async function importFromFile(file: File): Promise<SheetData[]> {
  const data = await file.arrayBuffer();
  const wb = XLSX.read(data, { cellFormula: true, cellStyles: true });

  // For xlsx files, also parse the raw XML to recover font/alignment
  // that the SheetJS community build drops.
  const isXlsx = /\.xlsx$/i.test(file.name);
  const { styles, sheetStyleMaps } = isXlsx
    ? await extractDirectXmlStyles(data)
    : { styles: null, sheetStyleMaps: new Map<string, Map<string, number>>() };

  return wb.SheetNames.map((name, idx) => {
    const ws = wb.Sheets[name];
    const cells: Record<string, CellData> = {};
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
    const styleMap = sheetStyleMaps.get(name);

    for (let r = range.s.r; r <= range.e.r; r++) {
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = ws[addr];

        // Even if no value, the direct-XML pass may show this cell has a style
        const xmlStyleIdx = styleMap?.get(addr);
        if (!cell && xmlStyleIdx === undefined) continue;

        const cellData: CellData = { value: "" };

        if (cell?.f) {
          cellData.formula = `=${cell.f}`;
          cellData.value = cell.v != null ? String(cell.v) : "";
        } else if (cell?.v != null) {
          cellData.value = String(cell.v);
        }

        // Fill background — SheetJS DOES surface this
        const sjsStyle: any = cell ? (cell as any).s : null;
        const fill = sjsStyle?.fill;
        if (fill) {
          const bg =
            argbToHex(fill.fgColor?.rgb) || argbToHex(fill.bgColor?.rgb);
          if (bg && bg !== "#FFFFFF") cellData.bgColor = bg;
        }

        // Font + alignment — recovered from raw XML
        if (styles && xmlStyleIdx !== undefined) {
          const xf = styles.cellXfs[xmlStyleIdx];
          if (xf) {
            // Alignment
            if (xf.wrapText) cellData.wrapMode = "wrap";
            if (xf.horizontal) cellData.align = xf.horizontal;
            // Font
            if (xf.fontId !== undefined) {
              const font = styles.fonts[xf.fontId];
              if (font) {
                if (font.bold) cellData.bold = true;
                if (font.italic) cellData.italic = true;
                if (font.underline) cellData.underline = true;
                if (typeof font.size === "number") cellData.fontSize = font.size;
                if (font.color) cellData.textColor = font.color;
              }
            }
          }
        }

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
