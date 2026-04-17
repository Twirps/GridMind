

## Plan: Full Style Preservation on Excel Import

### Goal
Extend `importUtils.ts` to extract every visual property Excel cells carry — colors (text + background), font weight/style/decoration/size, alignment, and wrap mode — and map them onto our existing `CellData` fields (which the grid already renders correctly). Also import row heights, so wrapped/tall rows look identical to the source.

### Why this is small
The grid (`SpreadsheetGrid.tsx`) already honors `bold`, `italic`, `underline`, `fontSize`, `align`, `bgColor`, `textColor`, and `wrapMode`. The only gap is that the importer isn't reading those fields out of the XLSX style object. No grid changes, no type changes.

### Changes

**`src/components/spreadsheet/importUtils.ts`** — single file edit
1. Read `cell.s.font`:
   - `font.bold` → `cellData.bold`
   - `font.italic` → `cellData.italic`
   - `font.underline` → `cellData.underline`
   - `font.sz` → `cellData.fontSize` (number)
   - `font.color.rgb` (or `.theme` fallback) → `cellData.textColor` as `#RRGGBB` (strip leading alpha if 8-char ARGB)
2. Read `cell.s.fill`:
   - `fill.fgColor.rgb` (when `patternType === "solid"`) → `cellData.bgColor` as `#RRGGBB`
3. Keep existing alignment + wrapText logic.
4. Always store the cell if it has any style, even when `value`/`formula` are empty (so a yellow-highlighted blank cell still shows). Update the gating condition accordingly.
5. Add a small helper `argbToHex(s)` that normalizes 6- or 8-char ARGB strings to `#RRGGBB`, returns `undefined` for invalid input.
6. Read `ws["!rows"]`:
   - For each row with `.hpx`, set `rowHeights[r] = hpx`.

### Out of scope (explicit)
- Theme colors / indexed palette resolution beyond what SheetJS surfaces directly (community SheetJS exposes `rgb` for most files; theme-only colors are rare and would require a palette lookup table — can be a follow-up if needed).
- Borders, number formats, merged cells (separate features).
- Per-run rich text styling within a single cell (we apply one style per cell).

### File changed
- `src/components/spreadsheet/importUtils.ts`

