

## Plan: Make AI deletion of rows/columns/cells actually work

### Root cause
The AI has no way to delete data. The system prompt only documents `SET_CELLS`, and the frontend handler only knows `SET_CELLS`, `DELETE_BOTTOM_PERCENT`, and `INSIGHT_DISCOVERY`. When you say "delete column B" or "clear row 5":
- The AI either emits prose with no JSON (silent failure), or
- Emits `SET_CELLS` with `value: ""`, which the handler stores as an empty-string cell (still present, still styled) instead of removing it. Visually this can leave residue (background colors, formulas not cleared) and doesn't actually shrink the data.

There's also no way to remove an entire row/column structure — only cell contents.

### Fix

**A. New AI action `DELETE_CELLS` (`supabase/functions/spreadsheet-ai/index.ts`)**
- Add to the schema and a new section "## 🗑️ Deleting / Clearing":
  - `DELETE_CELLS` → array of `{row, col}` to fully remove (value, formula, styling — all gone).
  - Add an `entireRow: true` / `entireCol: true` shorthand: `{row: 4, entireRow: true}` clears the whole row across all populated columns; `{col: 1, entireCol: true}` clears the whole column.
- Update the critical execution rule to also cover deletion verbs: *"For ANY delete/clear/remove/erase/wipe request, you MUST output a `DELETE_CELLS` JSON block."*
- Add an example: user says "delete column B" → `{"action":"DELETE_CELLS","explanation":"Clearing all of column B.","data":[{"col":1,"entireCol":true}]}`.
- Add an example: "clear row 5" → `{"col":..., "entireRow": true, "row": 4}`.

**B. Handler for `DELETE_CELLS` (`src/pages/Index.tsx`)**
- Add a new `case "DELETE_CELLS"` in `handleAIExecute`:
  - For each `{row, col}` entry, `delete newCells[cellKey(row, col)]`.
  - If `entireRow`, find every key in `sheet.cells` matching that row prefix and delete each.
  - If `entireCol`, find every key matching that col suffix and delete each.
- Also fix the existing `SET_CELLS` path: when `item.value === ""` and no styling is provided, treat it as a delete (`delete newCells[key]`) instead of leaving an empty-string cell. This makes legacy AI responses work too.

**C. Apply-button label (`src/components/AIChatPane.tsx`)**
- Update the button label so `DELETE_CELLS` reads as e.g. *"Apply 12 cell deletions"* instead of falling through to the generic action name.
- Extend the `FORMATTING_VERB_REGEX` warning to also fire on delete/clear/remove verbs when no JSON block is emitted, so silent failures surface.

### Files changed
- `supabase/functions/spreadsheet-ai/index.ts` — add `DELETE_CELLS` schema, rule, examples
- `src/pages/Index.tsx` — `DELETE_CELLS` handler + empty-value treated as delete in `SET_CELLS`
- `src/components/AIChatPane.tsx` — button label + delete-verb warning

### Out of scope
- Structurally removing rows/columns (shifting remaining data up/left). This stays as "clear contents" because shifting requires reindexing all formulas — much larger change. Can be a follow-up.

