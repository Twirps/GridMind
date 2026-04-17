

## Plan: Make AI Text Wrapping Reliably Work

### Root causes
The previous "fix" wired `wrapMode` through the apply handler correctly, but the feature still appears broken because:

1. **AI rarely emits the JSON block.** `google/gemini-3-flash-preview` often answers with prose ("I'll wrap your text…") and skips the ```json``` block entirely. Without the block, no Apply button appears and nothing changes — but the AI's narrative claims success.
2. **No range-aware targeting.** When a user says "wrap column B", the AI either (a) lists only rows with values it can see in context, missing empty/long cells, or (b) targets empty cells, so even when applied there's no visible change.
3. **No auto-apply / confirmation gap.** Even when the JSON is correct, the user may not click the Apply button and assume the AI did it automatically.
4. **Wrapped text can still look unchanged** if the row height is the default 28px — wrapping happens but only the first line shows because the row stays short.

### Fixes

**A. Stronger AI instructions (`supabase/functions/spreadsheet-ai/index.ts`)**
- Add a hard rule near the top: *"For ANY formatting request (wrap, bold, color, align, font size), you MUST output a SET_CELLS JSON block. Never describe formatting changes in prose alone."*
- Tell the AI to infer ranges from context: when user says "column B" or "this column", emit cells for every row in the visible context for that column, plus the selected cell's row range.
- Add a second example: wrap based on the selected cell ("wrap this cell" → SET_CELLS for just that cell).
- Upgrade model from `google/gemini-3-flash-preview` to `google/gemini-2.5-flash` for more reliable instruction-following on structured output.

**B. Auto-grow row height when wrapping (`src/pages/Index.tsx`)**
- In the `SET_CELLS` handler, after applying cells, for every cell that received `wrapMode: "wrap"`, ensure the corresponding row's `rowHeights[row]` is at least `60px` (≈3 lines) if not already taller. This guarantees the wrap is visually obvious.
- Update via the same `updateActiveSheet` callback so undo still works.

**C. Empty-cell guard (`src/pages/Index.tsx`)**
- When AI sends a cell that has no existing value AND no `value` field in the command, skip creating the cell. Prevents "ghost" wraps on blank cells that produce no visible change and clutter saved data.
- Exception: if the cell already exists (was non-empty), apply the style as normal.

**D. Better Apply feedback (`src/components/AIChatPane.tsx`)**
- When the assistant message contains formatting verbs ("wrap", "bold", "color") but `extractCommands` returns zero commands, append a small inline warning: *"⚠️ The AI described changes but didn't produce an Apply block. Try rephrasing: 'Wrap rows 1–10 of column B'."* This surfaces the silent-failure mode immediately.

### Files changed
- `supabase/functions/spreadsheet-ai/index.ts` — stronger wrap rules, second example, model upgrade
- `src/pages/Index.tsx` — auto-grow row heights for wrapped cells; skip empty ghost cells
- `src/components/AIChatPane.tsx` — warning when formatting is described but no JSON block emitted

### Out of scope
- Changing the AI provider / adding function-calling — staying with the existing JSON-in-markdown contract
- Auto-applying without user confirmation — keeping the explicit Apply button for safety

