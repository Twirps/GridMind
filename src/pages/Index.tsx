import React, { useState, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { SpreadsheetGrid } from "@/components/spreadsheet/SpreadsheetGrid";
import { FormulaBar } from "@/components/spreadsheet/FormulaBar";
import { Toolbar } from "@/components/spreadsheet/Toolbar";
import { SheetTabs } from "@/components/spreadsheet/SheetTabs";
import { AIChatPane } from "@/components/AIChatPane";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SheetData, CellAddress, CellData, cellKey,
} from "@/components/spreadsheet/types";
import { computeSheet } from "@/components/spreadsheet/formulaEngine";
import { downloadCSV, downloadExcel, downloadPDF } from "@/components/spreadsheet/downloadUtils";
import { importFromFile } from "@/components/spreadsheet/importUtils";
import { Sparkles, FileSpreadsheet, Download, FileText, Table, FileDown, Zap, Save, ArrowLeft, LogOut, Upload } from "lucide-react";


function createSheet(name: string, id: string): SheetData {
  return { id, name, cells: {}, colWidths: {}, rowHeights: {} };
}

let sheetCounter = 2;

export default function Index() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isGuest = searchParams.get("guest") === "true";
  const spreadsheetId = searchParams.get("id");

  const [sheets, setSheets] = useState<SheetData[]>([computeSheet(createSheet("Sheet1", "sheet-1"))]);
  const [activeSheetId, setActiveSheetId] = useState("sheet-1");
  const [selectedCell, setSelectedCell] = useState<CellAddress | null>({ row: 0, col: 0 });
  const [selectionRange, setSelectionRange] = useState<{ start: CellAddress; end: CellAddress } | null>(null);
  const [history, setHistory] = useState<SheetData[][]>([]);
  const [future, setFuture] = useState<SheetData[][]>([]);
  const [aiOpen, setAiOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docName, setDocName] = useState("Untitled Spreadsheet");

  useEffect(() => {
    if (spreadsheetId && user) {
      supabase
        .from("spreadsheets")
        .select("name, data")
        .eq("id", spreadsheetId)
        .single()
        .then(({ data, error }) => {
          if (error || !data) {
            toast({ title: "Error", description: "Could not load spreadsheet", variant: "destructive" });
            return;
          }
          setDocName(data.name);
          const loaded = (data.data as unknown as SheetData[]) ?? [];
          if (loaded.length > 0) {
            setSheets(loaded.map((s) => computeSheet(s)));
            setActiveSheetId(loaded[0].id);
          }
        });
    }
  }, [spreadsheetId, user]);

  const handleSave = async () => {
    if (!user || isGuest) return;
    setSaving(true);
    try {
      if (spreadsheetId) {
        await supabase.from("spreadsheets").update({ data: sheets as any, name: docName }).eq("id", spreadsheetId);
      } else {
        const { data, error } = await supabase
          .from("spreadsheets")
          .insert({ user_id: user.id, name: docName, data: sheets as any })
          .select("id")
          .single();
        if (data && !error) {
          window.history.replaceState(null, "", `/editor?id=${data.id}`);
        }
      }
      toast({ title: "Saved!" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

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

  const handleAIExecute = useCallback((command: any) => {
    updateActiveSheet((sheet) => {
      const newCells = { ...sheet.cells };
      switch (command.action) {
        case "SET_CELLS":
          command.data.forEach((item: any) => {
            const key = cellKey(item.row, item.col);
            newCells[key] = {
              ...newCells[key],
              value: item.value,
              metadata: { aiGenerated: true, logic: item.logic || "Pattern recognized by GridMind" }
            };
          });
          break;
        case "DELETE_BOTTOM_PERCENT": {
          const columnValues = Object.entries(sheet.cells)
            .filter(([key]) => key.endsWith(`,${command.col}`))
            .map(([key, cell]) => ({
              key,
              val: parseFloat(cell.computed?.toString() || cell.value || "0")
            }))
            .filter(item => !isNaN(item.val))
            .sort((a, b) => a.val - b.val);
          const countToRemove = Math.ceil(columnValues.length * (command.percent / 100));
          for (let i = 0; i < countToRemove; i++) {
            delete newCells[columnValues[i].key];
          }
          toast({
            title: "Task Executed",
            description: `Automated cleanup: Removed bottom ${command.percent}% from column ${String.fromCharCode(65 + command.col)}`
          });
          break;
        }
        case "INSIGHT_DISCOVERY":
          toast({
            title: "💡 Insight Discovery",
            description: command.message,
            duration: 6000,
          });
          break;
      }
      return { ...sheet, cells: newCells };
    });
  }, [updateActiveSheet, toast]);

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
      if (value === "") delete cells[key];
      else cells[key] = newCell;
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

  const getSheetContext = () => {
    const lines: string[] = [];
    sheets.forEach((sheet) => {
      lines.push(`\n=== Sheet: ${sheet.name} ===`);
      const cellEntries = Object.entries(sheet.cells).slice(0, 200);
      const errors: string[] = [];
      if (cellEntries.length > 0) {
        cellEntries.forEach(([key, cell]) => {
          const [r, c] = key.split(",").map(Number);
          const colStr = String.fromCharCode(65 + c);
          const ref = `${colStr}${r + 1}`;
          const val = cell.computed !== undefined ? cell.computed : cell.value;
          const formula = cell.formula ? ` | Formula: ${cell.formula}` : "";
          const valStr = String(val || "");
          if (valStr.startsWith("#") || valStr.includes("REF!") || valStr.includes("VALUE!") || valStr.includes("DIV/0!") || valStr.includes("NAME?") || valStr.includes("N/A")) {
            errors.push(`  ⚠️ ${ref}: ${valStr}${formula}`);
          }
          if (val) lines.push(`  ${ref}: ${val}${formula}`);
        });
      }
      if (errors.length > 0) {
        lines.push(`\nErrors found in ${sheet.name}:`);
        lines.push(...errors);
      }
    });
    if (selectedCell) {
      const colStr = String.fromCharCode(65 + selectedCell.col);
      const ref = `${colStr}${selectedCell.row + 1}`;
      const cellData = activeSheet.cells[cellKey(selectedCell.row, selectedCell.col)];
      lines.push(`\nCurrently selected: ${ref}`);
      if (cellData) {
        lines.push(`  Value: ${cellData.computed ?? cellData.value}`);
        if (cellData.formula) lines.push(`  Formula: ${cellData.formula}`);
      } else {
        lines.push(`  (empty)`);
      }
    }
    return lines.join("\n");
  };

  const selectedCellLabel = selectedCell
    ? `${String.fromCharCode(65 + selectedCell.col)}${selectedCell.row + 1}`
    : undefined;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={() => navigate("/")} className="mr-1">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="bg-primary p-1.5 rounded-md">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          {user && !isGuest ? (
            <input
              className="text-sm font-medium text-foreground bg-transparent border-none outline-none focus:ring-1 focus:ring-ring rounded px-1"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
            />
          ) : (
            <span className="text-sm font-medium text-foreground">GridMind AI</span>
          )}
          {isGuest && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded font-medium">Guest</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {user && !isGuest && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-2" onClick={handleSave} disabled={saving}>
              <Save className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-2">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => downloadCSV(activeSheet)} className="gap-2 text-xs">
                <FileDown className="h-3.5 w-3.5" /> Download CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadExcel(sheets)} className="gap-2 text-xs">
                <Table className="h-3.5 w-3.5 text-green-600" /> Download Excel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant={aiOpen ? "default" : "outline"}
            size="sm"
            className="h-8 px-4 text-xs gap-2"
            onClick={() => setAiOpen((v) => !v)}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {aiOpen ? "Hide AI" : "AI Assistant"}
          </Button>
        </div>
      </div>

      <Toolbar
        cellStyle={selectedCellData ?? {}}
        onStyleChange={handleStyleChange}
        onUndo={() => { if (history.length > 0) setSheets(history[history.length - 1]); }}
        onRedo={() => {}}
        canUndo={history.length > 0}
        canRedo={false}
      />

      <FormulaBar
        selectedCell={selectedCell}
        cellData={selectedCellData}
        onCommit={(value) => { if (selectedCell) handleCellChange(selectedCell, value); }}
      />

      {/* Main grid & AI pane */}
      <div className="flex flex-1 overflow-hidden relative">
        <SpreadsheetGrid
          sheet={activeSheet}
          selectedCell={selectedCell}
          selectionRange={selectionRange}
          onCellSelect={(addr) => { setSelectedCell(addr); setSelectionRange(null); }}
          onCellChange={handleCellChange}
          onSelectionChange={(range) => { setSelectionRange(range); setSelectedCell(range.start); }}
        />

        {aiOpen && (
          <div className="w-[380px] border-l border-border bg-card z-10">
            <AIChatPane
              onClose={() => setAiOpen(false)}
              sheetContext={getSheetContext()}
              onExecute={handleAIExecute}
              selectedCellLabel={selectedCellLabel}
            />
          </div>
        )}
      </div>

      <SheetTabs
        sheets={sheets}
        activeSheetId={activeSheetId}
        onSelectSheet={setActiveSheetId}
        onAddSheet={() => {}}
        onRenameSheet={() => {}}
        onDeleteSheet={() => {}}
      />
    </div>
  );
}
