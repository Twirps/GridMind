import { useRef, useState, useCallback, useEffect, useLayoutEffect } from "react";
import { Sparkles } from "lucide-react";
import {
  SheetData, CellData, CellAddress, cellKey, colLabel,
  DEFAULT_COL_WIDTH, DEFAULT_ROW_HEIGHT, NUM_ROWS, NUM_COLS,
} from "./types";
import { isHidden, getMaxLevel, toggleGroup } from "./groupingUtils";

interface SpreadsheetGridProps {
  sheet: SheetData;
  selectedCell: CellAddress | null;
  selectionRange: { start: CellAddress; end: CellAddress } | null;
  onCellSelect: (addr: CellAddress) => void;
  onCellChange: (addr: CellAddress, value: string) => void;
  onSelectionChange: (range: { start: CellAddress; end: CellAddress }) => void;
  onColResize?: (col: number, width: number) => void;
  onRowResize?: (row: number, height: number) => void;
  onToggleRowGroup?: (index: number) => void;
  onToggleColGroup?: (index: number) => void;
}

function isCellInRange(row: number, col: number, range: { start: CellAddress; end: CellAddress } | null): boolean {
  if (!range) return false;
  const minR = Math.min(range.start.row, range.end.row);
  const maxR = Math.max(range.start.row, range.end.row);
  const minC = Math.min(range.start.col, range.end.col);
  const maxC = Math.max(range.start.col, range.end.col);
  return row >= minR && row <= maxR && col >= minC && col <= maxC;
}

const GUTTER_UNIT = 16; // px per nesting level

export function SpreadsheetGrid({
  sheet, selectedCell, selectionRange,
  onCellSelect, onCellChange, onSelectionChange,
  onColResize, onRowResize,
  onToggleRowGroup, onToggleColGroup,
}: SpreadsheetGridProps) {
  const [editingCell, setEditingCell] = useState<CellAddress | null>(null);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef<CellAddress | null>(null);

  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [resizingRow, setResizingRow] = useState<number | null>(null);
  const resizeStart = useRef(0);
  const resizeOriginal = useRef(0);

  // Peek overlay: detect when selected cell content is truncated
  const selectedContentRef = useRef<HTMLSpanElement>(null);
  const [peekTruncated, setPeekTruncated] = useState(false);

  const getColWidth = (c: number) => sheet.colWidths[c] ?? DEFAULT_COL_WIDTH;
  const getRowHeight = (r: number) => sheet.rowHeights[r] ?? DEFAULT_ROW_HEIGHT;

  const rowGroups = sheet.rowGroups;
  const colGroups = sheet.colGroups;
  const rowGutterLevels = getMaxLevel(rowGroups) + 1; // 0 if no groups
  const colGutterLevels = getMaxLevel(colGroups) + 1;
  const rowGutterWidth = rowGutterLevels * GUTTER_UNIT;
  const colGutterHeight = colGutterLevels * GUTTER_UNIT;

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

  const handleColResizeStart = (col: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(col);
    resizeStart.current = e.clientX;
    resizeOriginal.current = getColWidth(col);
  };

  const handleRowResizeStart = (row: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingRow(row);
    resizeStart.current = e.clientY;
    resizeOriginal.current = getRowHeight(row);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (resizingCol !== null && onColResize) {
        const delta = e.clientX - resizeStart.current;
        onColResize(resizingCol, Math.max(30, resizeOriginal.current + delta));
      }
      if (resizingRow !== null && onRowResize) {
        const delta = e.clientY - resizeStart.current;
        onRowResize(resizingRow, Math.max(16, resizeOriginal.current + delta));
      }
    };
    const onUp = () => {
      setResizingCol(null);
      setResizingRow(null);
      isDragging.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizingCol, resizingRow, onColResize, onRowResize]);

  // Reset peek state on selection change / edit start
  useEffect(() => {
    setPeekTruncated(false);
  }, [selectedCell?.row, selectedCell?.col, editingCell]);

  // Detect if selected cell content overflows its visible box
  useLayoutEffect(() => {
    if (!selectedCell || editingCell) {
      setPeekTruncated(false);
      return;
    }
    const el = selectedContentRef.current;
    if (!el) {
      setPeekTruncated(false);
      return;
    }
    const truncated =
      el.scrollWidth > el.clientWidth + 1 ||
      el.scrollHeight > el.clientHeight + 1;
    setPeekTruncated(truncated);
  });

  const renderCell = (row: number, col: number) => {
    const key = cellKey(row, col);
    const cell = sheet.cells[key] as any;
    const isSelected = selectedCell?.row === row && selectedCell?.col === col;
    const isInRange = isCellInRange(row, col, selectionRange);
    const isEditing = editingCell?.row === row && editingCell?.col === col;

    const isAiGenerated = cell?.metadata?.aiGenerated;
    const aiLogic = cell?.metadata?.logic;

    const displayVal = cell?.computed !== undefined ? cell.computed : (cell?.value ?? "");
    const w = getColWidth(col);
    const h = getRowHeight(row);

    const wrapMode: "overflow" | "wrap" | "clip" = cell?.wrapMode ?? "overflow";

    const rightKey = cellKey(row, col + 1);
    const rightCell = sheet.cells[rightKey];
    const rightEmpty =
      !rightCell ||
      (rightCell.value === "" && rightCell.computed === undefined && !rightCell.formula);
    const canOverflow = wrapMode === "overflow" && rightEmpty && String(displayVal).length > 0;

    const style: React.CSSProperties = {
      width: w, minWidth: w, maxWidth: w,
      fontWeight: cell?.bold ? "bold" : undefined,
      fontStyle: cell?.italic ? "italic" : undefined,
      textDecoration: cell?.underline ? "underline" : undefined,
      textAlign: cell?.align ?? "left",
      backgroundColor: cell?.bgColor
        ? cell.bgColor
        : isAiGenerated
          ? "rgba(59, 130, 246, 0.05)"
          : isInRange && !isSelected
            ? "hsl(var(--cell-selected))"
            : undefined,
      color: cell?.textColor ?? undefined,
      fontSize: cell?.fontSize ? `${cell.fontSize}px` : undefined,
      ...(wrapMode === "wrap"
        ? { minHeight: h, height: "auto" as const }
        : { minHeight: h }),
      overflow: canOverflow ? "visible" : "hidden",
    };

    let contentClass = "block px-[3px] py-[1px] select-none h-full ";
    if (wrapMode === "wrap") {
      contentClass += "whitespace-pre-wrap break-words";
    } else if (wrapMode === "clip") {
      contentClass += "overflow-hidden whitespace-nowrap";
    } else {
      contentClass += "whitespace-nowrap";
    }

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
        ) : canOverflow ? (
          <span
            ref={isSelected ? selectedContentRef : undefined}
            className={contentClass + " absolute top-0 left-0 pointer-events-none"}
            style={{
              width: "max-content",
              maxWidth: "none",
              textAlign: cell?.align ?? "left",
            }}
          >
            {String(displayVal)}
          </span>
        ) : (
          <span
            ref={isSelected ? selectedContentRef : undefined}
            className={contentClass}
          >
            {String(displayVal)}
          </span>
        )}

        {isSelected && !isEditing && peekTruncated && String(displayVal).length > 0 && (
          <div
            className="absolute top-0 left-0 pointer-events-none z-40 bg-background border border-border shadow-lg rounded-sm px-[3px] py-[1px]"
            style={{
              minWidth: w,
              maxWidth: 400,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontWeight: cell?.bold ? "bold" : undefined,
              fontStyle: cell?.italic ? "italic" : undefined,
              textDecoration: cell?.underline ? "underline" : undefined,
              textAlign: cell?.align ?? "left",
              color: cell?.textColor ?? undefined,
              fontSize: cell?.fontSize ? `${cell.fontSize}px` : undefined,
            }}
          >
            {String(displayVal)}
          </div>
        )}
      </div>
    );
  };

  const isResizing = resizingCol !== null || resizingRow !== null;

  // Pre-compute visible row/col indices honoring collapsed groups
  const visibleRows: number[] = [];
  for (let r = 0; r < NUM_ROWS; r++) {
    if (!isHidden(r, rowGroups)) visibleRows.push(r);
  }
  const visibleCols: number[] = [];
  for (let c = 0; c < NUM_COLS; c++) {
    if (!isHidden(c, colGroups)) visibleCols.push(c);
  }

  // --- Gutter render helpers ---
  const renderColGroupGutter = () => {
    if (!colGroups || colGroups.length === 0) return null;
    return (
      <div className="flex" style={{ height: colGutterHeight }}>
        {/* corner spacer for row gutter + row header */}
        <div
          className="flex-shrink-0 bg-grid-header border-b border-r border-grid sticky left-0 z-30"
          style={{ width: rowGutterWidth + 50 }}
        />
        <div className="relative flex-shrink-0" style={{ height: colGutterHeight }}>
          {/* Build a spacer matching total visible width */}
          <div className="flex">
            {visibleCols.map((c) => (
              <div key={c} style={{ width: getColWidth(c) }} className="flex-shrink-0" />
            ))}
          </div>
          {/* Brackets per group */}
          {colGroups.map((g, i) => {
            // Compute pixel left/right based on visible cols
            let left = 0;
            let width = 0;
            for (const c of visibleCols) {
              if (c < g.start) left += getColWidth(c);
              else if (c >= g.start && c <= g.end) width += getColWidth(c);
            }
            const top = g.level * GUTTER_UNIT + 2;
            return (
              <div
                key={i}
                className="absolute pointer-events-none"
                style={{ left, top, width, height: GUTTER_UNIT - 4 }}
              >
                {!g.collapsed && (
                  <div className="absolute inset-x-0 top-1/2 h-px bg-muted-foreground/40" />
                )}
                <button
                  onClick={() => onToggleColGroup?.(i)}
                  className="pointer-events-auto absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3.5 h-3.5 bg-background border border-muted-foreground/60 text-[10px] leading-none flex items-center justify-center rounded-sm hover:bg-muted z-10"
                  title={g.collapsed ? "Expand" : "Collapse"}
                >
                  {g.collapsed ? "+" : "−"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderRowGroupGutterCell = (rowIdx: number) => {
    if (!rowGroups || rowGroups.length === 0) return null;
    // Find the bracket cells for this row at each level
    return (
      <div
        className="flex-shrink-0 relative bg-grid-header border-b border-r border-grid"
        style={{ width: rowGutterWidth, minHeight: getRowHeight(rowIdx) }}
      >
        {rowGroups.map((g, i) => {
          if (rowIdx < g.start || rowIdx > g.end) return null;
          const left = g.level * GUTTER_UNIT + 2;
          const isLast = rowIdx === g.end;
          return (
            <div
              key={i}
              className="absolute top-0 bottom-0"
              style={{ left, width: GUTTER_UNIT - 4 }}
            >
              {!g.collapsed && (
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-muted-foreground/40" />
              )}
              {isLast && (
                <button
                  onClick={() => onToggleRowGroup?.(i)}
                  className="absolute left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2 w-3.5 h-3.5 bg-background border border-muted-foreground/60 text-[10px] leading-none flex items-center justify-center rounded-sm hover:bg-muted z-10"
                  title={g.collapsed ? "Expand" : "Collapse"}
                >
                  {g.collapsed ? "+" : "−"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      ref={gridRef}
      className="flex-1 overflow-auto bg-background outline-none scrollbar-thin"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      style={{ cursor: isResizing ? (resizingCol !== null ? "col-resize" : "row-resize") : "default" }}
    >
      <div className="inline-block min-w-full">
        {/* Column-group gutter (above column headers) */}
        {renderColGroupGutter()}

        {/* Column headers */}
        <div className="flex sticky top-0 z-10">
          {/* Top-left corner: row gutter + row-number column */}
          <div className="flex-shrink-0 border-b border-r border-grid bg-grid-header sticky left-0 z-20"
            style={{ width: rowGutterWidth + 50, height: DEFAULT_ROW_HEIGHT }} />
          {visibleCols.map((c) => (
            <div
              key={c}
              className="flex-shrink-0 border-b border-r border-grid bg-grid-header flex items-center justify-center text-[11px] font-medium text-muted-foreground select-none transition-colors relative"
              style={{
                width: getColWidth(c),
                height: DEFAULT_ROW_HEIGHT,
                backgroundColor: selectedCell?.col === c ? "hsl(var(--toolbar-active))" : undefined
              }}
            >
              {colLabel(c)}
              <div
                className="absolute top-0 right-0 w-[4px] h-full cursor-col-resize hover:bg-primary/30 z-30"
                onMouseDown={(e) => handleColResizeStart(c, e)}
              />
            </div>
          ))}
        </div>

        {/* Rows */}
        {visibleRows.map((r) => (
          <div key={r} className="flex items-stretch">
            {/* Row-group gutter cell */}
            {renderRowGroupGutterCell(r)}
            {/* Row number */}
            <div
              className="flex-shrink-0 border-b border-r border-grid bg-grid-header flex items-center justify-center text-[11px] font-medium text-muted-foreground select-none sticky z-10 transition-colors relative"
              style={{
                width: 50,
                left: rowGutterWidth,
                minHeight: getRowHeight(r),
                backgroundColor: selectedCell?.row === r ? "hsl(var(--toolbar-active))" : undefined
              }}
            >
              {r + 1}
              <div
                className="absolute bottom-0 left-0 w-full h-[4px] cursor-row-resize hover:bg-primary/30 z-30"
                onMouseDown={(e) => handleRowResizeStart(r, e)}
              />
            </div>
            {visibleCols.map((c) => renderCell(r, c))}
          </div>
        ))}
      </div>
    </div>
  );
}
