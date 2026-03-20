import { useState, useCallback } from "react";
import { SpreadsheetGrid } from "@/components/spreadsheet/SpreadsheetGrid";
import { FormulaBar } from "@/components/spreadsheet/FormulaBar";
import { Toolbar } from "@/components/spreadsheet/Toolbar";
import { SheetTabs } from "@/components/spreadsheet/SheetTabs";
import { AIChatPane } from "@/components/AIChatPane";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SheetData, CellAddress, CellData, cellKey,
} from "@/components/spreadsheet/types";
import { computeSheet } from "@/components/spreadsheet/formulaEngine";
import { downloadCSV, downloadExcel, downloadPDF } from "@/components/spreadsheet/downloadUtils";
import { Sparkles, FileSpreadsheet, Download, FileText, Table, FileDown } from "lucide-react";

function createSheet(name: string, id: string): SheetData {
  return { id, name, cells: {}, colWidths: {}, rowHeights: {} };
}

let sheetCounter = 2;

const initialSheet = computeSheet(createSheet("Sheet1", "sheet-1"));

export default function Index() {
  const [sheets, setSheets] = useState<SheetData[]>([initialSheet]);
  const [activeSheetId, setActiveSheetId] = useState("sheet-1");
  const [selectedCell, setSelectedCell] = useState<CellAddress | null>({ row: 0, col: 0 });
  const [selectionRange, setSelectionRange] = useState<{ start: CellAddress; end: CellAddress } | null>(null);
  const [history, setHistory] = useState<SheetData[][]>([]);
  const [future, setFuture] = useState<SheetData[][]>([]);
  const [aiOpen, setAiOpen] = useState(false);

  const activeSheet = sheets.find((s) => s.id === activeSheetId) ?? sheets[0];
  const selectedCellData = selectedCell
    ? (activeSheet.cells[cellKey(selectedCell.row, selectedCell.col)] as CellData | undefined)
    : undefined;

  const updateSheets = useCallback((newSheets: SheetData[]) => {
    setHistory((h) => [...h.slice(-49), sheets]);
    setFuture([]);
    setSheets(newSheets);
  }, [sheets]);

  const updateActiveSheet = useCallback((updater: (s: SheetData) => SheetData) => {
    const newSheets = sheets.map((s) => s.id === activeSheetId ? computeSheet(updater(s)) : s);
    updateSheets(newSheets);
  }, [sheets, activeSheetId, updateSheets]);

  const handleCellChange = useCallback((addr: CellAddress, value: string) => {
    updateActiveSheet((sheet) => {
      const key = cellKey(addr.row, addr.col);
      const existing = sheet.cells[key] ?? {};
      const isFormula = value.startsWith("=");
      const newCell: CellData = {
        value: isFormula ? "" : value,
        ...existing,
        formula: isFormula ? value : (existing as CellData).formula,
      };
      if (!isFormula) delete (newCell as CellData).formula;
      const cells = { ...sheet.cells };
      if (value === "") {
        const cleaned: Partial<CellData> = { ...(existing as CellData) };
        delete cleaned.value;
        delete cleaned.formula;
        delete cleaned.computed;
        if (Object.keys(cleaned).length === 0) delete cells[key];
        else cells[key] = cleaned as CellData;
      } else {
        cells[key] = newCell;
      }
      return { ...sheet, cells };
    });
  }, [updateActiveSheet]);

  const handleStyleChange = useCallback((style: Partial<CellData>) => {
    if (!selectedCell) return;
    updateActiveSheet((sheet) => {
      const key = cellKey(selectedCell.row, selectedCell.col);
      const existing = sheet.cells[key] ?? { value: "" };
      return { ...sheet, cells: { ...sheet.cells, [key]: { ...existing, ...style } } };
    });
  }, [selectedCell, updateActiveSheet]);

  const handleUndo = () => {
    if (history.length === 0) return;
    setFuture((f) => [sheets, ...f]);
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setSheets(prev);
  };

  const handleRedo = () => {
    if (future.length === 0) return;
    setHistory((h) => [...h, sheets]);
    const next = future[0];
    setFuture((f) => f.slice(1));
    setSheets(next);
  };

  const handleAddSheet = () => {
    const id = `sheet-${Date.now()}`;
    const name = `Sheet${sheetCounter++}`;
    const newSheet = createSheet(name, id);
    setSheets((prev) => [...prev, newSheet]);
    setActiveSheetId(id);
  };

  const handleRenameSheet = (id: string, name: string) => {
    setSheets((prev) => prev.map((s) => s.id === id ? { ...s, name } : s));
  };

  const handleDeleteSheet = (id: string) => {
    const idx = sheets.findIndex((s) => s.id === id);
    const newSheets = sheets.filter((s) => s.id !== id);
    setSheets(newSheets);
    if (activeSheetId === id) {
      setActiveSheetId(newSheets[Math.max(0, idx - 1)]?.id ?? newSheets[0]?.id);
    }
  };

  // Build a small context summary for AI
  const getSheetContext = () => {
    const lines: string[] = [`Sheet: ${activeSheet.name}`];
    const cellEntries = Object.entries(activeSheet.cells).slice(0, 30);
    if (cellEntries.length > 0) {
      lines.push("Data sample:");
      cellEntries.forEach(([key, cell]) => {
        const [r, c] = key.split(",").map(Number);
        const colStr = String.fromCharCode(65 + c);
        const val = cell.computed !== undefined ? cell.computed : cell.value;
        if (val) lines.push(`  ${colStr}${r + 1}: ${val}${cell.formula ? ` (formula: ${cell.formula})` : ""}`);
      });
    }
    return lines.join("\n");
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-border bg-muted flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Spreadsheet</span>
        </div>
        <Button
          variant={aiOpen ? "default" : "outline"}
          size="sm"
          className="h-6 text-xs gap-1.5"
          onClick={() => setAiOpen((v) => !v)}
        >
          <Sparkles className="h-3.5 w-3.5" />
          {aiOpen ? "Close AI" : "AI Assistant"}
        </Button>
      </div>

      {/* Toolbar */}
      <Toolbar
        cellStyle={selectedCellData ?? {}}
        onStyleChange={handleStyleChange}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={history.length > 0}
        canRedo={future.length > 0}
      />

      {/* Formula bar */}
      <FormulaBar
        selectedCell={selectedCell}
        cellData={selectedCellData}
        onCommit={(value) => { if (selectedCell) handleCellChange(selectedCell, value); }}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        <SpreadsheetGrid
          sheet={activeSheet}
          selectedCell={selectedCell}
          selectionRange={selectionRange}
          onCellSelect={(addr) => { setSelectedCell(addr); setSelectionRange(null); }}
          onCellChange={handleCellChange}
          onSelectionChange={(range) => { setSelectionRange(range); setSelectedCell(range.start); }}
        />
        {aiOpen && (
          <AIChatPane
            onClose={() => setAiOpen(false)}
            sheetContext={getSheetContext()}
          />
        )}
      </div>

      {/* Sheet tabs */}
      <SheetTabs
        sheets={sheets}
        activeSheetId={activeSheetId}
        onSelectSheet={setActiveSheetId}
        onAddSheet={handleAddSheet}
        onRenameSheet={handleRenameSheet}
        onDeleteSheet={handleDeleteSheet}
      />
    </div>
  );
}
