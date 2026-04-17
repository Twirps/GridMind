

## Plan: Three-Mode Cell Text Wrapping

### Goal
Replace the current boolean `wrap` toggle with a 3-state wrap mode: **Overflow** (default — text spills into empty neighbors like Excel), **Wrap** (text wraps to new lines, row grows), and **Clip** (hard-truncated, no overflow). On Excel import, detect the source cell's wrap setting and apply it automatically.

### Behavior per mode
- **Overflow**: single line; if the cell to the right is empty, text visually spills over it (Excel default). If neighbor has content, it gets clipped at the cell border.
- **Wrap**: `whitespace-pre-wrap break-words`; row auto-grows to fit content.
- **Clip**: single line, hard-cut at cell boundary, no ellipsis, no overflow.

### Changes

**1. `src/components/spreadsheet/types.ts`**
- Add `export type WrapMode = "overflow" | "wrap" | "clip"`
- Replace `wrap?: boolean` with `wrapMode?: WrapMode` on `CellData` (default treated as `"overflow"`)

**2. `src/components/spreadsheet/Toolbar.tsx`**
- Replace single Wrap toggle button with a 3-button segmented group (icons: `MoveHorizontal` for Overflow, `WrapText` for Wrap, `Scissors` for Clip)
- Active state highlights the current `cellStyle.wrapMode ?? "overflow"`
- Clicking a button calls `onStyleChange({ wrapMode: <mode> })`

**3. `src/components/spreadsheet/SpreadsheetGrid.tsx`**
- Replace the existing wrap conditional in `renderCell` with mode-based rendering:
  - **wrap** → `whitespace-pre-wrap break-words`, cell `height: auto` with `minHeight`, span allowed to grow
  - **clip** → `overflow-hidden whitespace-nowrap` (no ellipsis)
  - **overflow** → `whitespace-nowrap` with `overflow: visible`; render text in an absolutely-positioned span so it visually escapes the cell box only when the right neighbor is empty (check `sheet.cells[cellKey(row, col+1)]`); otherwise behave like clip
- For Wrap mode: switch container `height` to `minHeight` so the row stretches naturally. Note: because rows are rendered as flex rows with per-cell heights, we'll set `alignItems: stretch` on the row and let the tallest wrapped cell define row height (no explicit row-height mutation required — purely visual).

**4. `src/components/spreadsheet/importUtils.ts`**
- Pass `cellStyles: true` to `XLSX.read(...)` so style info is preserved
- For each cell, read `cell.s?.alignment?.wrapText`:
  - if `true` → `cellData.wrapMode = "wrap"`
  - else leave undefined (defaults to overflow, matching Excel default)
- Also map `cell.s?.alignment?.horizontal` ("left" | "center" | "right") to `cellData.align` while we have styles available (small bonus, free win)

**5. Migration safety**
- Anywhere in the codebase that still references the old `wrap` boolean: only `Toolbar.tsx` and `SpreadsheetGrid.tsx` use it (confirmed via grep). No persisted-data migration needed; old saved sheets simply fall back to overflow.

### Files Changed
- `src/components/spreadsheet/types.ts` — add `WrapMode`, replace `wrap` field
- `src/components/spreadsheet/Toolbar.tsx` — 3-button segmented control
- `src/components/spreadsheet/SpreadsheetGrid.tsx` — mode-aware rendering with neighbor check for overflow
- `src/components/spreadsheet/importUtils.ts` — read wrapText + horizontal alignment from XLSX styles

