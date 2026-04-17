

## Plan: Remove AI reasoning highlight on cells

### What to remove
In `src/components/SpreadsheetGrid.tsx`, cells flagged with `metadata.aiGenerated` currently get:
1. A blue tint background (`rgba(59, 130, 246, 0.05)`)
2. A `border-blue-100` class
3. A `Sparkles` icon overlay in the top-right corner with a hover tooltip showing AI reasoning

### Changes
**`src/components/spreadsheet/SpreadsheetGrid.tsx`**
- Remove the `isAiGenerated` and `aiLogic` variables in `renderCell`.
- Remove the `Sparkles` icon overlay block and its hover tooltip.
- Remove the AI-generated background tint from the inline `style.backgroundColor` fallback chain.
- Remove the `border-blue-100` conditional class.
- Drop the now-unused `Sparkles` import from `lucide-react`.

The underlying `metadata.aiGenerated` data on cells is left untouched (no migration), just no longer rendered.

### Out of scope
- Removing `metadata` writes from AI handlers in `Index.tsx` / edge function (data-only, invisible now).
- Any change to the AI chat pane itself.

