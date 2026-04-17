

## Plan: Persist AI chat across open/close + make pane resizable

### Problem
- `AIChatPane` holds `messages` in local `useState`, so unmounting (closing the pane) wipes history.
- Pane width is hardcoded `380px` inline — not resizable.

### Investigation needed
Confirm where `AIChatPane` is mounted/unmounted and how Index.tsx toggles it.

### Fixes

**A. Lift chat state to `Index.tsx` (persists across open/close, cleared on route leave)**
- Move `messages` and `input` state from `AIChatPane` into `Index.tsx` (which only mounts on `/editor`).
- Pass them down as props: `messages`, `setMessages`, `input`, `setInput`.
- When the user navigates away from `/editor`, `Index` unmounts and state naturally clears — matches requested behavior.
- Keep all send/streaming logic inside `AIChatPane` but operate on the lifted state setters.

**B. Make pane horizontally resizable**
- Replace hardcoded `style={{ width: 380 }}` with controlled width state lifted to `Index.tsx` (so width also persists across toggles within the editor session).
- Add a drag handle (`<div>` with `cursor-col-resize`) on the **left edge** of the pane.
- On `mousedown`, attach `mousemove` listener that updates width = `window.innerWidth - e.clientX`, clamped between `320px` and `800px`. Release on `mouseup`.
- Use a small custom hook inline (no new dependency) — `react-resizable-panels` is overkill since the pane is a fixed sibling, not part of a panel group.

### Files changed
- `src/pages/Index.tsx` — lift `aiMessages`, `aiInput`, `aiPaneWidth` state; pass down as props.
- `src/components/AIChatPane.tsx` — accept new props instead of local state; add left-edge drag handle; use prop width.

### Out of scope
- Persisting chat to localStorage/Supabase across full page reloads (current request only asks for open/close persistence within the editor session).
- Vertical resize / detachable window.

