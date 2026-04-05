import { useRef, useState, useCallback, useEffect } from "react";
import { Sparkles } from "lucide-react"; // Requirement: Visual indicator for AI
import {
  SheetData, CellData, CellAddress, cellKey, colLabel,
  DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, NUM_ROWS, NUM_COLS,
} from "./types";

interface SpreadsheetGridProps {
  sheet: SheetData;
  selectedCell: CellAddress | null;
  selectionRange: { start: CellAddress; end: CellAddress } | null;
  onCellSelect: (addr: CellAddress) => void;
  onCellChange: (addr: CellAddress, value: string) => void;
  onSelectionChange: (range: { start: CellAddress; end: CellAddress }) => void;
}

function isCellInRange(row: number, col: number, range: { start: CellAddress; end: CellAddress } | null): boolean {
  if (!range) return false;
  const minR = Math.min(range.start.row, range.end.row);
  const maxR = Math.max(range.start.row, range.end.row);
  const minC = Math.min(range.start.col, range.end.col);
  const maxC = Math.max(range.start.col, range.end.col);
  return row >= minR && row <= maxR && col >= minC && col <= maxC;
}

export function SpreadsheetGrid({
  sheet, selectedCell, selectionRange,
  onCellSelect, onCellChange, onSelectionChange,
}: SpreadsheetGridProps) {
  const [editingCell, setEditingCell] = useState<CellAddress | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef<CellAddress | null>(null);

  const getColWidth = (c: number) => sheet.colWidths[c] ?? DEFAULT_COL_WIDTH;
  const getRowHeight = (r: number) => sheet.rowHeights[r] ?? DEFAULT_ROW_HEIGHT;

  const startEdit = useCallback((addr: CellAddress) => {
    const cell = sheet.cells[cellKey(addr.row, addr.col)];
    setEditValue(cell?.formula ?? cell?.value ?? "");
    setEditingCell(addr);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [sheet.cells]);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    onCellChange(editingCell, editValue);
    setEditingCell(null);
  }, [editingCell, editValue, onCellChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell) return;
    const { row, col } = selectedCell;

    if (editingCell) {
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        commitEdit();
        if (e.key === "Enter") onCellSelect({ row: Math.min(row + 1, NUM_ROWS - 1), col });
        else onCellSelect({ row, col: Math.min(col + 1, NUM_COLS - 1) });
      } else if (e.key === "Escape") {
        setEditingCell(null);
      }
      return;
    }

    if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      startEdit(selectedCell);
      return;
    }
    if (e.key === "Delete" || e.key === "Backspace") {
      onCellChange(selectedCell, "");
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); onCellSelect({ row: Math.min(row + 1, NUM_ROWS - 1), col }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); onCellSelect({ row: Math.max(row - 1, 0), col }); }
    else if (e.key === "ArrowRight" || e.key === "Tab") { e.preventDefault(); onCellSelect({ row, col: Math.min(col + 1, NUM_COLS - 1) }); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); onCellSelect({ row, col: Math.max(col - 1, 0) }); }
    else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
      setEditValue(e.key);
      setEditingCell(selectedCell);
      setTimeout(() => { if (inputRef.current) { inputRef.current.focus(); inputRef.current.value = e.key; inputRef.current.setSelectionRange(1, 1); } }, 0);
    }
  }, [selectedCell, editingCell, commitEdit, startEdit, onCellSelect, onCellChange]);

  const handleCellMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    if (editingCell) commitEdit();
    e.preventDefault();
    onCellSelect({ row, col });
    isDragging.current = true;
    dragStart.current = { row, col };
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isDragging.current && dragStart.current) {
      onSelectionChange({ start: dragStart.current, end: { row, col } });
    }
  };

  const handleMouseUp = () => { isDragging.current = false; };

  useEffect(() => {
    window.addEventListener("mouseup", handleMouseUp);
    return () => window.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const renderCell = (row: number, col: number) => {
    const key = cellKey(row, col);
    const cell = sheet.cells[key] as any; // Cast to access metadata
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    const isInRange = isCellInRange(row, col, selectionRange);
    const isEditing = editingCell?.row === row && editingCell?.col === col;

    // AI Metadata for Explainable AI
    const isAiGenerated = cell?.metadata?.aiGenerated;
    const aiLogic = cell?.metadata?.logic;

    const displayVal = cell?.computed !== undefined ? cell.computed : (cell?.value ?? "");
    const w = getColWidth(col);
    const h = getRowHeight(row);

    const style: React.CSSProperties = {
      width: w, minWidth: w, maxWidth: w,
      height: h, minHeight: h,
      fontWeight: cell?.bold ? "bold" : undefined,
      fontStyle: cell?.italic ? "italic" : undefined,
      textDecoration: cell?.underline ? "underline" : undefined,
      textAlign: cell?.align ?? "left",
      // UI Polish: AI-generated cells get a subtle blue tint
      backgroundColor: cell?.bgColor 
        ? cell.bgColor 
        : isAiGenerated 
          ? "rgba(59, 130, 246, 0.05)" 
          : isInRange && !isSelected 
            ? "hsl(var(--cell-selected))" 
            : undefined,
      color: cell?.textColor ?? undefined,
      fontSize: cell?.fontSize ? `${cell.fontSize}px` : undefined,
    };

    return (
      <div
        key={key}
        className={`sheet-cell flex-shrink-0 relative cursor-cell group ${
          isSelected ? "sheet-cell-selected z-10" : ""
        } ${isAiGenerated ? "border-blue-100" : ""}`}
        style={style}
        onMouseDown={(e) => handleCellMouseDown(row, col, e)}
        onMouseEnter={() => handleCellMouseEnter(row, col)}
        onDoubleClick={() => startEdit({ row, col })}
      >
        {/* Requirement: Explainable AI - The Sparkle indicator and Logic Tooltip */}
        {isAiGenerated && !isEditing && (
          <div className="absolute top-0 right-0 p-0.5 z-20">
            <Sparkles className="h-2 w-2 text-primary opacity-40 group-hover:opacity-100 transition-opacity" />
            
            <div className="invisible group-hover:visible absolute left-full top-0 ml-2 z-50 w-48 p-2 bg-slate-900 text-white text-[10px] rounded shadow-xl pointer-events-none animate-in fade-in zoom-in-95">
               <p className="font-bold border-b border-white/20 mb-1 pb-1 flex items-center gap-1">
                 <Sparkles className="h-2 w-2" /> AI Reasoning
               </p>
               {aiLogic || "Recognized pattern from context."}
            </div>
          </div>
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            className="sheet-cell-input w-full h-full bg-white outline-none ring-2 ring-primary ring-inset z-30"
            style={{ textAlign: cell?.align ?? "left" }}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); commitEdit(); }
              else if (e.key === "Escape") setEditingCell(null);
            }}
          />
        ) : (
          <span className={`block px-[3px] py-[1px] select-none h-full ${
            cell?.wrap ? "whitespace-pre-wrap break-words" : "overflow-hidden whitespace-nowrap text-ellipsis"
          }`}>
            {String(displayVal)}
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      ref={gridRef}
      className="flex-1 overflow-auto bg-background outline-none scrollbar-thin"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ cursor: "default" }}
    >
      <div className="inline-block min-w-full">
        {/* Column headers */}
        <div className="flex sticky top-0 z-10">
          <div className="flex-shrink-0 border-b border-r border-grid bg-grid-header sticky left-0 z-20"
            style={{ width: 50, height: DEFAULT_ROW_HEIGHT }} />
          {Array.from({ length: NUM_COLS }, (_, c) => (
            <div
              key={c}
              className="flex-shrink-0 border-b border-r border-grid bg-grid-header flex items-center justify-center text-[11px] font-medium text-muted-foreground select-none transition-colors"
              style={{ 
                width: getColWidth(c), 
                height: DEFAULT_ROW_HEIGHT,
                backgroundColor: selectedCell?.col === c ? "hsl(var(--toolbar-active))" : undefined 
              }}
            >
              {colLabel(c)}
            </div>
          ))}
        </div>

        {/* Rows */}
        {Array.from({ length: NUM_ROWS }, (_, r) => (
          <div key={r} className="flex">
            <div
              className="flex-shrink-0 border-b border-r border-grid bg-grid-header flex items-center justify-center text-[11px] font-medium text-muted-foreground select-none sticky left-0 z-10 transition-colors"
              style={{ 
                width: 50, 
                height: getRowHeight(r),
                backgroundColor: selectedCell?.row === r ? "hsl(var(--toolbar-active))" : undefined 
              }}
            >
              {r + 1}
            </div>
            {Array.from({ length: NUM_COLS }, (_, c) => renderCell(r, c))}
          </div>
        ))}
      </div>
    </div>
  );
}
// Visual cue for data that was produced by AI,Logic tooltips and Cell highlight added - Yannic
