

## Plan: Draggable Column & Row Resize

### Overview
Add the ability to resize columns by dragging the right edge of column headers, and resize rows by dragging the bottom edge of row number headers — exactly like Excel/Google Sheets.

### Changes

#### 1. `src/components/spreadsheet/SpreadsheetGrid.tsx`

**Add resize props and state:**
- Add `onColResize(col: number, width: number)` and `onRowResize(row: number, height: number)` callback props
- Add local state for tracking active resize: `resizingCol`, `resizingRow`, `resizeStart` position, and `resizeOriginal` size

**Column header resize handles:**
- Add a 4px-wide invisible div on the right edge of each column header
- On mousedown, record the column index and starting mouse X position
- On mousemove (window listener), calculate delta and call `onColResize` with new width (min 30px)
- On mouseup, clear resize state
- Show `col-resize` cursor on hover/drag

**Row header resize handles:**
- Add a 4px-tall invisible div on the bottom edge of each row number cell
- Same drag logic but for Y axis, calling `onRowResize` (min 16px)
- Show `row-resize` cursor on hover/drag

**Visual feedback:**
- While dragging, show a thin blue guideline across the grid at the resize position

#### 2. `src/pages/Index.tsx`

**Add resize handlers:**
- `handleColResize(col, width)` — updates `colWidths` on the active sheet
- `handleRowResize(row, height)` — updates `rowHeights` on the active sheet
- Pass both as props to `SpreadsheetGrid`

### Files Changed
- `src/components/spreadsheet/SpreadsheetGrid.tsx` — resize handles on headers, drag logic
- `src/pages/Index.tsx` — resize handler callbacks passed as props

