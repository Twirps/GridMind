

## Plan: Enhanced AI Assistant with Spreadsheet Guardrails

### Overview
Upgrade the AI assistant to be a focused spreadsheet expert that can answer questions about cells/formulas, test scenarios, debug errors, and help build models -- while rejecting non-spreadsheet requests. Changes span the edge function (system prompt) and the frontend chat pane (richer context passing, quick-action buttons, and response parsing for executable commands).

### 1. Rewrite Edge Function System Prompt (`supabase/functions/spreadsheet-ai/index.ts`)

Replace the current generic system prompt with a tightly scoped one that:

- **Guardrails**: Explicitly instructs the model to only respond to spreadsheet-related requests. If a user asks something unrelated (e.g., "write me a poem"), it politely declines and redirects.
- **Cell-level citations**: When explaining formulas or values, always reference cells (e.g., "Cell B5 uses `=SUM(B2:B4)` which totals...").
- **Scenario testing**: When the user asks "what if X changes to Y", walk through every affected cell and explain the ripple effect.
- **Error debugging**: When the user mentions `#REF!`, `#VALUE!`, `#DIV/0!`, or circular references, trace the error chain and provide step-by-step fixes.
- **Model building**: When asked to create a model or fill a template, output structured `SET_CELLS` commands the frontend can execute, along with explanations.
- **Multi-sheet awareness**: Include all sheet names and data in the context so the AI can reference cross-tab formulas.

### 2. Improve Context Passing (`src/pages/Index.tsx`)

Update `getSheetContext()` to send richer data:
- Include **all sheets** (not just active), with sheet names as headers
- Include **formulas** alongside computed values for every cell
- Include the **selected cell** and its formula so the AI knows what the user is looking at
- Include **error cells** (cells with `#REF!`, `#VALUE!`, etc.) flagged explicitly
- Cap at a reasonable limit (e.g., 200 cells per sheet) to avoid token overflow

### 3. Add Quick Action Chips to Chat Pane (`src/components/AIChatPane.tsx`)

Add a row of suggestion chips below the welcome message and when the chat is idle:
- "Explain this cell" (auto-fills with selected cell reference)
- "Find errors" (scans for error values)
- "Test a scenario"
- "Build a model"

These pre-fill the input with a contextual prompt.

### 4. Parse AI Responses for Executable Commands (`src/components/AIChatPane.tsx`)

After the AI finishes streaming, scan the response for JSON code blocks containing `{ "action": "SET_CELLS", ... }`. If found:
- Show an "Apply Changes" button below the message
- When clicked, call `onExecute(command)` to apply the changes to the spreadsheet
- Highlight which cells will be affected before applying

### 5. Enhanced Welcome Message

Update the initial assistant message to describe the four capabilities clearly, so users know what to ask.

### Files Changed
- **`supabase/functions/spreadsheet-ai/index.ts`** -- new guardrailed system prompt with spreadsheet-expert persona
- **`src/pages/Index.tsx`** -- richer `getSheetContext()` with all sheets, formulas, errors, and selected cell
- **`src/components/AIChatPane.tsx`** -- quick action chips, "Apply Changes" button for executable responses, updated welcome message

