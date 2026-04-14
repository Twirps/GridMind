/* import { SheetData, cellKey, parseCellRef } from "./types";

function getCellValue(sheet: SheetData, ref: string): number | string {
  const addr = parseCellRef(ref.trim());
  if (!addr) return 0;
  const cell = sheet.cells[cellKey(addr.row, addr.col)];
  if (!cell) return 0;
  const val = cell.computed !== undefined ? cell.computed : cell.value;
  if (val === "" || val === undefined || val === null) return 0;
  const num = Number(val);
  return isNaN(num) ? String(val) : num;
}

function getRangeValues(sheet: SheetData, rangeStr: string): number[] {
  const parts = rangeStr.toUpperCase().split(":");
  if (parts.length !== 2) return [];
  const start = parseCellRef(parts[0].trim());
  const end = parseCellRef(parts[1].trim());
  if (!start || !end) return [];
  const values: number[] = [];
  for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
    for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
      const cell = sheet.cells[cellKey(r, c)];
      if (cell) {
        const val = cell.computed !== undefined ? cell.computed : cell.value;
        const num = Number(val);
        if (!isNaN(num)) values.push(num);
      } else {
        values.push(0);
      }
    }
  }
  return values;
}

function evalFunctions(expr: string, sheet: SheetData): string {
  // SUM
  expr = expr.replace(/SUM\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return String(vals.reduce((a: number, b: number) => a + b, 0));
  });
  // AVERAGE / AVG
  expr = expr.replace(/(?:AVERAGE|AVG)\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return vals.length ? String(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : "0";
  });
  // COUNT
  expr = expr.replace(/COUNT\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return String(vals.filter((v: number) => !isNaN(v)).length);
  });
  // MAX
  expr = expr.replace(/MAX\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return vals.length ? String(Math.max(...vals)) : "0";
  });
  // MIN
  expr = expr.replace(/MIN\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return vals.length ? String(Math.min(...vals)) : "0";
  });
  // IF
  expr = expr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, tVal, fVal) => {
    try {
      const result = Function('"use strict"; return (' + cond.trim() + ')')();
      return result ? tVal.trim() : fVal.trim();
    } catch {
      return "#ERR";
    }
  });
  // ABS
  expr = expr.replace(/ABS\(([^)]+)\)/gi, (_, arg) => {
    return String(Math.abs(Number(arg.trim())));
  });
  // ROUND
  expr = expr.replace(/ROUND\(([^,]+),([^)]+)\)/gi, (_, num, dec) => {
    return String(Number(Number(num.trim()).toFixed(Number(dec.trim()))));
  });
  // SQRT
  expr = expr.replace(/SQRT\(([^)]+)\)/gi, (_, arg) => {
    return String(Math.sqrt(Number(arg.trim())));
  });
  // CONCATENATE / CONCAT
  expr = expr.replace(/(?:CONCATENATE|CONCAT)\(([^)]+)\)/gi, (_, args) => {
    return args.split(",").map((a: string) => {
      const t = a.trim();
      if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
      return String(getCellValue(sheet, t));
    }).join("");
  });
  // LEN
  expr = expr.replace(/LEN\(([^)]+)\)/gi, (_, arg) => {
    const t = arg.trim();
    const val = t.startsWith('"') ? t.slice(1, -1) : String(getCellValue(sheet, t));
    return String(val.length);
  });
  // UPPER/LOWER
  expr = expr.replace(/UPPER\(([^)]+)\)/gi, (_, arg) => {
    return String(getCellValue(sheet, arg.trim())).toUpperCase();
  });
  expr = expr.replace(/LOWER\(([^)]+)\)/gi, (_, arg) => {
    return String(getCellValue(sheet, arg.trim())).toLowerCase();
  });
  return expr;
}

function replaceRefs(expr: string, sheet: SheetData): string {
  return expr.replace(/\b([A-Z]+\d+)\b/g, (match) => {
    const val = getCellValue(sheet, match);
    return String(val);
  });
}

export function evaluateFormula(formula: string, sheet: SheetData): string | number {
  try {
    let expr = formula.substring(1).toUpperCase().trim();
    // Handle string literals - keep them as-is
    if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
    expr = evalFunctions(expr, sheet);
    expr = replaceRefs(expr, sheet);
    // Evaluate arithmetic
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result === "number" && isNaN(result)) return "#NUM!";
    if (result === undefined || result === null) return "";
    if (typeof result === "number") {
      // Round to avoid floating point issues
      return parseFloat(result.toFixed(10));
    }
    return String(result);
  } catch {
    return "#ERR!";
  }
}

export function computeSheet(sheet: SheetData): SheetData {
  const updatedCells = { ...sheet.cells };
  // Two passes for dependency resolution
  for (let pass = 0; pass < 2; pass++) {
    for (const key of Object.keys(updatedCells)) {
      const cell = updatedCells[key];
      if (cell.formula && cell.formula.startsWith("=")) {
        const tempSheet = { ...sheet, cells: updatedCells };
        updatedCells[key] = {
          ...cell,
          computed: evaluateFormula(cell.formula, tempSheet),
        };
      }
    }
  }
  return { ...sheet, cells: updatedCells };
}
*/
import { SheetData, cellKey, parseCellRef } from "./types";
import { Parser } from "expr-eval";

const safeParser = new Parser();

function getCellValue(sheet: SheetData, ref: string): number | string {
  const addr = parseCellRef(ref.trim());
  if (!addr) return 0;
  const cell = sheet.cells[cellKey(addr.row, addr.col)];
  if (!cell) return 0;
  const val = cell.computed !== undefined ? cell.computed : cell.value;
  if (val === "" || val === undefined || val === null) return 0;
  const num = Number(val);
  return isNaN(num) ? String(val) : num;
}

function getRangeValues(sheet: SheetData, rangeStr: string): number[] {
  const parts = rangeStr.toUpperCase().split(":");
  if (parts.length !== 2) return [];
  const start = parseCellRef(parts[0].trim());
  const end = parseCellRef(parts[1].trim());
  if (!start || !end) return [];
  const values: number[] = [];
  for (let r = Math.min(start.row, end.row); r <= Math.max(start.row, end.row); r++) {
    for (let c = Math.min(start.col, end.col); c <= Math.max(start.col, end.col); c++) {
      const cell = sheet.cells[cellKey(r, c)];
      if (cell) {
        const val = cell.computed !== undefined ? cell.computed : cell.value;
        const num = Number(val);
        if (!isNaN(num)) values.push(num);
      } else {
        values.push(0);
      }
    }
  }
  return values;
}

// --- CORE AI ENHANCEMENTS START HERE ---

/**
 * Requirement: Smart Fill Context
 * Gathers vertical context so AI knows "Apple" near "Google" is a Tech Company.
 */
export function getVerticalPattern(sheet: SheetData, row: number, col: number): string {
  const pattern: string[] = [];
  // Look at 5 cells above the current position
  for (let i = 1; i <= 5; i++) {
    const val = sheet.cells[cellKey(row - i, col)]?.value;
    if (val) pattern.push(String(val));
  }
  return pattern.reverse().join(", ") || "No previous pattern";
}

/**
 * Requirement: Insight Discovery
 * Uses Standard Deviation to detect "dips" or "spikes" in a range of numbers.
 */
export function detectAnomalies(values: number[]) {
  if (values.length < 4) return null; // Need a baseline to detect a dip

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const stdDev = Math.sqrt(
    values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / values.length
  );

  const lastValue = values[values.length - 1];
  const threshold = 2; // 2 standard deviations is a common statistical "dip"

  if (lastValue < mean - (stdDev * threshold)) {
    return {
      type: "dip",
      severity: "high",
      message: `I noticed a significant dip (${lastValue}) compared to the average (${mean.toFixed(2)}).`
    };
  }
  return null;
}

// --- CORE AI ENHANCEMENTS END HERE ---

function evalFunctions(expr: string, sheet: SheetData): string {
  // SUM
  expr = expr.replace(/SUM\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return String(vals.reduce((a: number, b: number) => a + b, 0));
  });
  // AVERAGE / AVG
  expr = expr.replace(/(?:AVERAGE|AVG)\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return vals.length ? String(vals.reduce((a: number, b: number) => a + b, 0) / vals.length) : "0";
  });
  // COUNT
  expr = expr.replace(/COUNT\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return String(vals.filter((v: number) => !isNaN(v)).length);
  });
  // MAX
  expr = expr.replace(/MAX\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return vals.length ? String(Math.max(...vals)) : "0";
  });
  // MIN
  expr = expr.replace(/MIN\(([^)]+)\)/gi, (_, args) => {
    const vals = args.includes(":") ? getRangeValues(sheet, args) : args.split(",").map((a: string) => Number(getCellValue(sheet, a.trim())));
    return vals.length ? String(Math.min(...vals)) : "0";
  });
  // IF
  expr = expr.replace(/IF\(([^,]+),([^,]+),([^)]+)\)/gi, (_, cond, tVal, fVal) => {
    try {
      const result = Function('"use strict"; return (' + cond.trim() + ')')();
      return result ? tVal.trim() : fVal.trim();
    } catch {
      return "#ERR";
    }
  });
  // ABS
  expr = expr.replace(/ABS\(([^)]+)\)/gi, (_, arg) => {
    return String(Math.abs(Number(arg.trim())));
  });
  // ROUND
  expr = expr.replace(/ROUND\(([^,]+),([^)]+)\)/gi, (_, num, dec) => {
    return String(Number(Number(num.trim()).toFixed(Number(dec.trim()))));
  });
  // SQRT
  expr = expr.replace(/SQRT\(([^)]+)\)/gi, (_, arg) => {
    return String(Math.sqrt(Number(arg.trim())));
  });
  // CONCATENATE / CONCAT
  expr = expr.replace(/(?:CONCATENATE|CONCAT)\(([^)]+)\)/gi, (_, args) => {
    return args.split(",").map((a: string) => {
      const t = a.trim();
      if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1);
      return String(getCellValue(sheet, t));
    }).join("");
  });
  // LEN
  expr = expr.replace(/LEN\(([^)]+)\)/gi, (_, arg) => {
    const t = arg.trim();
    const val = t.startsWith('"') ? t.slice(1, -1) : String(getCellValue(sheet, t));
    return String(val.length);
  });
  // UPPER/LOWER
  expr = expr.replace(/UPPER\(([^)]+)\)/gi, (_, arg) => {
    return String(getCellValue(sheet, arg.trim())).toUpperCase();
  });
  expr = expr.replace(/LOWER\(([^)]+)\)/gi, (_, arg) => {
    return String(getCellValue(sheet, arg.trim())).toLowerCase();
  });
  return expr;
}

function replaceRefs(expr: string, sheet: SheetData): string {
  return expr.replace(/\b([A-Z]+\d+)\b/g, (match) => {
    const val = getCellValue(sheet, match);
    return String(val);
  });
}

export function evaluateFormula(formula: string, sheet: SheetData): string | number {
  try {
    let expr = formula.substring(1).toUpperCase().trim();
    if (expr.startsWith('"') && expr.endsWith('"')) return expr.slice(1, -1);
    expr = evalFunctions(expr, sheet);
    expr = replaceRefs(expr, sheet);
    const result = Function('"use strict"; return (' + expr + ')')();
    if (typeof result === "number" && isNaN(result)) return "#NUM!";
    if (result === undefined || result === null) return "";
    if (typeof result === "number") {
      return parseFloat(result.toFixed(10));
    }
    return String(result);
  } catch {
    return "#ERR!";
  }
}

export function computeSheet(sheet: SheetData): SheetData {
  const updatedCells = { ...sheet.cells };
  for (let pass = 0; pass < 2; pass++) {
    for (const key of Object.keys(updatedCells)) {
      const cell = updatedCells[key];
      if (cell.formula && cell.formula.startsWith("=")) {
        const tempSheet = { ...sheet, cells: updatedCells };
        updatedCells[key] = {
          ...cell,
          computed: evaluateFormula(cell.formula, tempSheet),
        };
      }
    }
  }
  return { ...sheet, cells: updatedCells };
}

// adeed vericalpattern recongition and anomalies detection -Yannic
