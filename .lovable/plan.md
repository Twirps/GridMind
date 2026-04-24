
## Goal

Produce two architectural diagrams for GridMind — a **UML class/component diagram** describing the frontend + edge-function structure, and an **Entity-Relationship Diagram (ERD)** describing the persistent backend schema — and walk through each one in detail.

Both diagrams will be delivered as downloadable Mermaid (`.mmd`) artifacts so you can drop them into a pitch deck, README, or design doc, alongside an inline explanation of every box, relationship, and arrow.

## Deliverables

1. **`GridMind_UML.mmd`** — a UML diagram showing modules, key types, contexts, components, and the edge function, plus their relationships (composition, dependency, render, network).
2. **`GridMind_ERD.mmd`** — an ERD covering the `spreadsheets` table, the embedded JSONB `data` schema (sheets → cells), the implicit relationship to `auth.users`, and the RLS boundary.
3. **In-chat walkthrough** of both diagrams in plain language: what each entity/class does, what flows between them, and which pieces matter for an investor or technical reviewer.

## UML Diagram — what it will show

Grouped into four layers so the diagram stays readable:

- **Routing & Providers**: `App` → `QueryClientProvider`, `AuthProvider`, `BrowserRouter`, `TooltipProvider`. Routes: `/` → `Dashboard`, `/editor` → `Index`.
- **Pages**: `Dashboard` (lists saved workbooks, calls Supabase directly) and `Index` (the spreadsheet editor — owns sheet state, history/future stacks, AI pane state, doc name, save status).
- **Spreadsheet components**: `SpreadsheetGrid`, `Toolbar`, `FormulaBar`, `SheetTabs`, `AIChatPane` — composed by `Index`. Utility modules: `formulaEngine` (computeSheet), `downloadUtils` (CSV/Excel/PDF), `importUtils`, `groupingUtils`.
- **Domain types**: `SheetData`, `CellData`, `CellAddress`, `SpreadsheetState`, `OutlineGroup`, `AICommand` / `AIActionType` — drawn as classes with fields.
- **Integrations / external**: `supabase` client, `lovable` auth wrapper, `AuthContext` (User, Session), and the `spreadsheet-ai` Deno edge function (calls Lovable AI Gateway → Gemini 2.5 Flash, streams SSE).

Relationships shown: composition (Index *--> components), dependency (components ..> types), call/network (AIChatPane --> spreadsheet-ai --> AI Gateway), and auth flow (AuthProvider --> supabase.auth).

## ERD Diagram — what it will show

- **`auth.users`** (managed by Lovable Cloud auth — shown as external, greyed entity with `id`, `email`).
- **`public.spreadsheets`** with all columns: `id (uuid pk)`, `user_id (uuid)`, `name (text)`, `data (jsonb)`, `created_at`, `updated_at`. Implicit FK `user_id → auth.users.id` (enforced by RLS, not a hard FK constraint).
- **Logical sub-entities inside the JSONB blob** (rendered as separate ER entities with a "embedded in JSONB" note): `Sheet` (id, name, colWidths, rowHeights, rowGroups, colGroups), `Cell` (row, col, value, formula, computed, bold, italic, underline, align, bgColor, textColor, fontSize, wrapMode, metadata).
- **Trigger / function**: `update_updated_at_column()` annotated on the `updated_at` column.
- **RLS boundary**: shown as a labeled box around `spreadsheets` listing the four policies (`SELECT/INSERT/UPDATE/DELETE` on `auth.uid() = user_id`).

Cardinalities: one user → many spreadsheets; one spreadsheet → many sheets (1..N inside JSONB); one sheet → many cells (sparse map keyed by `"row,col"`).

## Walkthrough section (in chat, alongside the artifacts)

For each diagram, a short narrative explaining:
- What the major boxes are and why they exist.
- The data flow at runtime (e.g. user types in cell → `Index` updates state → `formulaEngine.computeSheet` recomputes → `SpreadsheetGrid` rerenders → debounced save to `spreadsheets.data`).
- The AI mutation flow (user prompt in `AIChatPane` → POST to `spreadsheet-ai` edge function with JWT → SSE stream back → JSON action block parsed client-side → `SET_CELLS` / `DELETE_CELLS` applied to local state → autosaved).
- Why the JSONB-blob storage choice matters (single round-trip load/save, no per-cell rows, RLS-protected at the row level).

## Technical notes

- Mermaid file types: `classDiagram` for UML, `erDiagram` for the ERD.
- Both files written to `/mnt/documents/` and surfaced as `<lov-artifact>` tags with `mime_type="text/vnd.mermaid"` so you can preview/download them.
- No code changes to the app — this is a documentation deliverable only.
- After writing each `.mmd`, I will not need to QA-render it visually (Mermaid renders client-side in the artifact viewer), but I will sanity-check the syntax by reading back the file.

## Out of scope

- Sequence diagrams (can be added in a follow-up if you want one for the AI request flow specifically).
- Deployment/infrastructure diagram (Cloudflare edge + Supabase regions) — also a good follow-up artifact if useful for the pitch.
