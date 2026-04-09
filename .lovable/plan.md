

## Plan: Dashboard Homepage with Optional Auth

### Overview
Make the "My Spreadsheets" dashboard the homepage (`/`). It shows a blurred overlay requiring Google login to access saved sheets. A "Use Without Account" button bypasses login and opens a temporary spreadsheet editor. The editor route moves to `/editor`.

### 1. Fix Build Error
Add `onExecute` prop to `AIChatPaneProps` interface in `AIChatPane.tsx`.

### 2. Database Migration
Create `spreadsheets` table with RLS:
```sql
CREATE TABLE public.spreadsheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled',
  data JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.spreadsheets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own spreadsheets" ON public.spreadsheets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

### 3. Configure Google OAuth
Use the Configure Social Login tool to set up Google sign-in via `lovable.auth.signInWithOAuth("google")`.

### 4. Auth Context (`src/contexts/AuthContext.tsx`)
- Wrap app with auth provider exposing `user`, `session`, `signOut`, `signInWithGoogle`.
- Use `onAuthStateChange` listener for session state.

### 5. New Routes & Pages

**`src/pages/Dashboard.tsx`** (new homepage at `/`)
- If logged in: show grid of saved spreadsheets with open/delete/rename, plus "New Spreadsheet" button.
- If not logged in: show the same page but **blurred** with a centered overlay containing:
  - "Sign in with Google" button
  - "Use Without Account" button (navigates to `/editor?guest=true`)

**`src/pages/Editor.tsx`** (moved from current `Index.tsx` to `/editor`)
- If `?guest=true`: works as-is, no save button, no DB interaction.
- If logged in and `?id=<uuid>`: loads that spreadsheet from DB.
- If logged in and no id: creates a new spreadsheet, shows save button.
- Header shows user avatar + "My Sheets" link when logged in, or "Sign In" when guest.

### 6. Updated Routing (`src/App.tsx`)
```
/          → Dashboard (homepage)
/editor    → Spreadsheet Editor
*          → NotFound
```
Wrap with `AuthProvider`.

### Files Changed
- **New**: `src/contexts/AuthContext.tsx`, `src/pages/Dashboard.tsx`
- **Modified**: `src/App.tsx`, `src/pages/Index.tsx` (rename/move to Editor logic), `src/components/AIChatPane.tsx` (fix props)
- **Migration**: Create `spreadsheets` table

