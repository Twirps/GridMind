

## Plan: Import Excel/CSV Files into GridMind

### Overview
Add an "Import" button next to the Export dropdown in the editor header. When clicked, it opens a file picker for `.xlsx`, `.xls`, or `.csv` files. The file is parsed client-side using the existing `xlsx` (SheetJS) library and converted into GridMind's `SheetData` format, replacing the current sheets.

### Changes

#### 1. New Import Utility (`src/components/spreadsheet/importUtils.ts`)
- Create `importFromFile(file: File): Promise<SheetData[]>` function
- For CSV: use SheetJS to parse into a worksheet, then iterate rows/cols to build `cells` record
- For XLSX: parse all sheets, iterate each worksheet's used range, map cell values and formulas into `CellData` objects
- Preserve formulas where possible (SheetJS exposes them via `cell.f`)
- Return an array of `SheetData` objects ready for `computeSheet()`

#### 2. Update Editor Page (`src/pages/Index.tsx`)
- Add a hidden `<input type="file" accept=".xlsx,.xls,.csv">` element
- Add an "Import" button (with `Upload` icon from lucide) next to the Export dropdown
- On file selection, call `importFromFile()`, then `computeSheet()` on each sheet, and replace `sheets` state
- Update `docName` to the imported filename (without extension)
- Show a toast confirming successful import with sheet/cell count

### Technical Notes
- SheetJS (`xlsx`) is already installed as a dependency (used in `downloadUtils.ts`)
- No new dependencies needed
- Import is purely client-side — no backend changes required

### Files Changed
- **New**: `src/components/spreadsheet/importUtils.ts`
- **Modified**: `src/pages/Index.tsx` (import button + handler)

