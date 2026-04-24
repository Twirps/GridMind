## Goal

Produce the **full C4 model diagram set** for GridMind — System Context, Container, Component, Code — plus a **Deployment Diagram**, each as a downloadable Mermaid (`.mmd`) artifact, with an inline walkthrough explaining every box and arrow.

This complements the existing `GridMind_UML.mmd` and `GridMind_ERD.mmd` artifacts and gives you a complete architecture documentation pack suitable for engineering reviews, investor decks, or onboarding docs.

## Deliverables

Five new Mermaid files in `/mnt/documents/`:

1. **`GridMind_C1_SystemContext.mmd`** — GridMind as a black box, with the people and external systems it touches.
2. **`GridMind_C2_Container.mmd`** — the runtime containers inside GridMind (SPA, edge function, database, auth).
3. **`GridMind_C3_Component.mmd`** — components inside the React SPA container (pages, spreadsheet components, utilities, integrations).
4. **`GridMind_C4_Code.mmd`** — code-level class diagram zoomed into the spreadsheet engine (`Index` page state + `formulaEngine` + types).
5. **`GridMind_Deployment.mmd`** — physical/runtime topology: user browser, Lovable static hosting (Cloudflare edge), Supabase (Postgres + Auth + Edge Functions on Deno), Lovable AI Gateway → Gemini.

Plus an in-chat walkthrough of each diagram.

## Diagram Contents

### C1 — System Context
- **Person**: *Spreadsheet User* (signed-in or guest).
- **Person**: *Google Account holder* (OAuth identity provider — drawn as external person/system).
- **System (focus)**: *GridMind AI* — "AI-native spreadsheet for explaining, debugging, and mutating cells via natural language."
- **External systems**: *Google OAuth*, *Lovable Cloud* (managed Supabase: Postgres + Auth + Edge Functions), *Lovable AI Gateway* (proxy to Gemini 2.5 Flash).
- Arrows: user → GridMind (uses), GridMind → Lovable Cloud (persists workbooks, authenticates), GridMind → Lovable AI Gateway (sends prompts, streams completions), Lovable Cloud → Google OAuth (delegates sign-in).

### C2 — Container
Inside the *GridMind AI* boundary:
- **Web SPA** (React 18 + Vite + TS, served as static assets) — runs in browser, owns spreadsheet state, formula engine, AI chat UI.
- **`spreadsheet-ai` Edge Function** (Deno on Supabase) — JWT-validates request, builds system prompt, proxies to AI Gateway, streams SSE back.
- **Postgres Database** (Supabase) — `public.spreadsheets` table (JSONB workbook blobs), RLS on `auth.uid() = user_id`.
- **Auth Service** (Supabase Auth) — issues JWTs, manages sessions, handles Google OAuth callback.

External: *Google OAuth*, *Lovable AI Gateway → Gemini 2.5 Flash*.

Arrows label protocols: HTTPS, Postgres wire (via PostgREST), SSE, OAuth 2.0 redirect.

### C3 — Component (zoom into Web SPA)
Grouped:
- **Routing/Providers**: `App`, `QueryClientProvider`, `AuthProvider`, `BrowserRouter`, `TooltipProvider`.
- **Pages**: `Dashboard` (`/`), `Index` (`/editor`), `NotFound`.
- **Spreadsheet UI**: `SpreadsheetGrid`, `Toolbar`, `FormulaBar`, `SheetTabs`.
- **AI UI**: `AIChatPane` (with `extractCommands` JSON parser).
- **Utilities**: `formulaEngine.computeSheet`, `downloadUtils`, `importUtils`, `groupingUtils`.
- **Integrations**: `supabase` client, `lovable` auth wrapper, `AuthContext`.

Arrows: composition (`Index *--> components`), function calls (`AIChatPane --> supabase.functions.invoke('spreadsheet-ai')`), data persistence (`Index --> supabase.from('spreadsheets')`).

### C4 — Code (zoom into the spreadsheet engine)
Class diagram for the editor's domain core:
- `Index` (state holders: `sheets`, `activeSheetId`, `history`, `future`, `aiMessages`, `docName`, `saving`; methods: `handleSave`, `handleCellChange`, `handleAICommand`, undo/redo).
- `SheetData`, `CellData`, `OutlineGroup`, `CellAddress`, `WrapMode`, `AICommand`, `AIActionType`.
- `formulaEngine`: `computeSheet(sheet)`, `getCellValue`, `getRangeValues`, `evalFunctions`.
- `AIChatPane.extractCommands(content)` returning `AICommand[]`.

Shows how a cell edit flows: `Index.handleCellChange` → updates `SheetData.cells` → `computeSheet` recomputes → React rerenders `SpreadsheetGrid`.

### Deployment Diagram
Nodes (rendered as nested boxes):
- **User Device** → *Web Browser* running the React SPA bundle.
- **Cloudflare Edge / Lovable static hosting** → serves built SPA assets (`index.html`, JS, CSS) from `usegridmind.com` / `clever-cells-ai.lovable.app`.
- **Supabase region** containing:
  - *Postgres 15* (with `spreadsheets` table + RLS policies + `update_updated_at_column` trigger).
  - *PostgREST / GoTrue (Auth)* fronted by the Supabase API gateway.
  - *Edge Runtime (Deno)* hosting the `spreadsheet-ai` function.
- **Lovable AI Gateway** → forwards to *Google Gemini 2.5 Flash*.
- **Google Identity Platform** for OAuth.

Connections labeled with protocol, port, and auth (HTTPS 443, JWT Bearer, SSE, OAuth 2.0 PKCE).

## Walkthrough (in chat alongside the artifacts)

For each diagram I'll explain:
- **Audience**: who this view is for (execs, new engineers, ops).
- **Key boxes**: what each entity is and why it exists.
- **Critical flows**: e.g. "guest opens `/editor` → state stays in-memory, no DB call" vs "signed-in user saves → debounced UPDATE through PostgREST under RLS."
- **Trust boundaries**: where JWT verification happens, where RLS enforces row ownership, where the user-supplied prompt crosses into the AI gateway.

## Technical notes

- All five files use `graph TB` / `flowchart TB` (C1, C2, Deployment), `flowchart LR` (C3), and `classDiagram` (C4) — the syntaxes Mermaid renders cleanly.
- Each artifact emitted with `mime_type="text/vnd.mermaid"` so the in-app viewer renders them.
- No code changes; documentation only.
- I'll sanity-check Mermaid syntax by reading each file back after writing.

## Out of scope

- Sequence diagrams (AI request flow, save flow) — easy follow-up if you want them.
- Threat model / data-flow diagram (DFD with trust boundaries called out) — also a good follow-up.
- Infrastructure-as-code or CI/CD pipeline diagram.
