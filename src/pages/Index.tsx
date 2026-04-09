import { useState, useCallback, useEffect } from "react";
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
import { Sparkles, FileSpreadsheet, Download, FileText, Table, FileDown, Zap, Save, ArrowLeft, LogOut } from "lucide-react";


function createSheet(name: string, id: string): SheetData {
  return { id, name, cells: {}, colWidths: {}, rowHeights: {} };
}

let sheetCounter = 2;

export default function Index() {
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

  // Load spreadsheet from DB if id is provided
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

  // --- CORE AI EXECUTION ENGINE (Requirements: Execution, Smart Fill, Insights) ---
  const handleAIExecute = useCallback((command: any) => {
    updateActiveSheet((sheet) => {
      const newCells = { ...sheet.cells };
      
      switch (command.action) {
        case "SET_CELLS": 
          // Handles "Natural Language Execution" and "Smart Fill"
          command.data.forEach((item: any) => {
            const key = cellKey(item.row, item.col);
            newCells[key] = { 
              ...newCells[key],
              value: item.value, 
              // Requirement: Explainable AI - Store logic in metadata
              metadata: { aiGenerated: true, logic: item.logic || "Pattern recognized by GridMind" } 
            };
          });
          break;

        case "DELETE_BOTTOM_PERCENT": 
          // Requirement: "Automatically do certain tasks: remove the bottom 5% of sales"
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

        case "INSIGHT_DISCOVERY": 
          // Requirement: "Notices a dip and automatically breaks it down why"
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
    const lines: string[] = [`Sheet: ${activeSheet.name}`];
    const cellEntries = Object.entries(activeSheet.cells).slice(0, 100);
    if (cellEntries.length > 0) {
      lines.push("Data:");
      cellEntries.forEach(([key, cell]) => {
        const [r, c] = key.split(",").map(Number);
        const colStr = String.fromCharCode(65 + c);
        const val = cell.computed !== undefined ? cell.computed : cell.value;
        if (val) lines.push(`  ${colStr}${r + 1}: ${val}${cell.formula ? ` (fn: ${cell.formula})` : ""}`);
      });
    }
    return lines.join("\n");
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#f8fafc]">
      {/* --- HEADER (Requirement: Make it Nicer) --- */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-white shadow-sm flex-shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-1.5 rounded-lg">
            <Zap className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-800 uppercase">GridMind AI</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Requirement: Auto-report Button */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 text-xs gap-2 text-slate-600 hover:text-primary"
            onClick={() => { setAiOpen(true); toast({ title: "Narrative Engine", description: "Analyzing data for weekly report..." }); }}
          >
            <FileText className="h-4 w-4" />
            Auto-Report
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 text-xs gap-2">
                <Download className="h-4 w-4" />
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
            className={`h-8 px-4 text-xs gap-2 transition-all shadow-sm ${aiOpen ? 'bg-slate-900' : 'hover:border-primary/50'}`}
            onClick={() => setAiOpen((v) => !v)}
          >
            <Sparkles className={`h-4 w-4 ${aiOpen ? 'animate-spin-slow' : 'text-primary'}`} />
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

      {/* --- MAIN GRID & AI PANE --- */}
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
          <div className="w-[400px] border-l border-border bg-white shadow-2xl z-10 transition-all animate-in slide-in-from-right">
            <AIChatPane
              onClose={() => setAiOpen(false)}
              sheetContext={getSheetContext()}
              onExecute={handleAIExecute} 
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

//added set cells and delete bottom percent aswell as explainable insights -Yannic

