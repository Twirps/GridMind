export interface CellData {
  value: string;
  formula?: string;
  computed?: string | number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  bgColor?: string;
  textColor?: string;
  fontSize?: number;
  wrap?: boolean;
}

export type CellAddress = { row: number; col: number };

export interface SheetData {
  id: string;
  name: string;
  cells: Record<string, CellData>;
  colWidths: Record<number, number>;
  rowHeights: Record<number, number>;
}

export interface SpreadsheetState {
  sheets: SheetData[];
  activeSheetId: string;
  selectedCell: CellAddress | null;
  selectionRange: { start: CellAddress; end: CellAddress } | null;
  editingCell: CellAddress | null;
}

export const DEFAULT_COL_WIDTH = 100;
export const DEFAULT_ROW_HEIGHT = 24;
export const NUM_ROWS = 50;
export const NUM_COLS = 26;

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function colLabel(col: number): string {
  let label = "";
  let c = col;
  while (c >= 0) {
    label = String.fromCharCode(65 + (c % 26)) + label;
    c = Math.floor(c / 26) - 1;
  }
  return label;
}

export function cellLabel(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}

export function parseCellRef(ref: string): CellAddress | null {
  const match = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/);
  if (!match) return null;
  const colStr = match[1];
  const rowNum = parseInt(match[2]) - 1;
  let col = 0;
  for (let i = 0; i < colStr.length; i++) {
    col = col * 26 + (colStr.charCodeAt(i) - 64);
  }
  col -= 1;
  return { row: rowNum, col };
}
