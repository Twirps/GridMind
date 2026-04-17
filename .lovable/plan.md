

## Plan: Fix Imported Font Size + Click-to-Peek Overlay

Scope reduced to two issues. Excel group import is dropped per request.

### Issue 1 — Imported font size off by ~25%
**Root cause:** Excel stores font size in points (`<sz val="11"/>`); we render it as `${fontSize}px`. 11pt ≈ 14.67px, so imported text appears smaller than the source.

**Fix in `src/components/spreadsheet/importUtils.ts`:**
- Where the parsed `font.size` (or `sz`) value is assigned to `cellData.fontSize`, multiply by `1.333` and round:
  ```ts
  cellData.fontSize = Math.round(font.size * 1.333);
  ```
- Apply in both code paths that set fontSize (the SheetJS `cell.s.font.sz` path and the jszip XML `<sz val="...">` path).

### Issue 2 — Click-to-peek overlay for truncated cells
**Goal:** When the selected cell's content doesn't fully fit (clipped, overflow blocked by a non-empty neighbor, or wrap mode but row too short), show a temporary read-only floating overlay with the full text. Vanishes on selection change or when the user starts editing.

**Fix in `src/components/spreadsheet/SpreadsheetGrid.tsx`:**
- Add a ref to the cell content `<span>` for the selected cell.
- In a `useLayoutEffect` keyed on `selectedCell` + cell value + width/height, measure `scrollWidth > clientWidth` or `scrollHeight > clientHeight` to detect truncation.
- If truncated and not editing, render an absolutely positioned overlay anchored to the selected cell:
  - `position: absolute`, anchored to cell's top-left
  - `min-width: cellWidth`, `max-width: 400px`, `whitespace-pre-wrap`, `word-break: break-word`
  - White background, 1px border matching grid, soft shadow, `z-40`
  - `pointer-events: none` so it doesn't block clicks/drag-selection
  - Inherits font styling (bold/italic/color/size/align) from the cell so it reads identically
- Hide overlay when `editingCell` matches selected cell, or when selection moves.

### Files changed
- `src/components/spreadsheet/importUtils.ts` — pt→px conversion (both font-size code paths)
- `src/components/spreadsheet/SpreadsheetGrid.tsx` — peek overlay with overflow detection

### Out of scope (per your instruction)
- Importing Excel row/column outline groups — skipped.
- Borders, number formats, merged cells, theme color resolution — skipped.

