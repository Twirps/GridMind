

## Plan: Clean, Professional UI Overhaul

### Problem
The current design is over-styled with excessive gradients, glassmorphism, animated mesh backgrounds, and heavy shadows — hallmarks of "vibecoded" aesthetics. The goal is a clean, professional look similar to Google Sheets or Notion.

### Design Direction
- **Remove** all gradient backgrounds (`bg-gradient-to-*`, `mesh-gradient`, `dot-pattern`, `glass`)
- **Remove** decorative shadows (`shadow-lg shadow-primary/20`, `shadow-2xl`)
- **Remove** excessive animations (`animate-fade-in`, `animate-scale-in`, `animate-slide-up` on page load)
- **Flatten** the color scheme — solid backgrounds, simple borders, no color tinting
- **Simplify** buttons — plain solid or outline styles, no gradient fills
- **Tone down** the branding — smaller logo area, no glowing icon containers

### Files Changed

#### 1. `src/index.css`
- Remove `mesh-gradient`, `dot-pattern`, `glass`, `shimmer` utility classes
- Simplify CSS variables to clean neutrals (pure white background, standard gray borders)
- Remove `--glass-bg`, `--gradient-start`, `--gradient-end` variables
- Keep spreadsheet cell styles functional but simplify

#### 2. `src/pages/Dashboard.tsx`
- Replace gradient header with a simple white header + bottom border
- Replace gradient logo container with a plain icon
- Remove `mesh-gradient` from page background — plain `bg-background`
- Simplify spreadsheet cards: no hover translate, no gradient borders, just a clean card with subtle hover shadow
- Simplify sign-in overlay: plain white card, no glassmorphism, standard button styles
- Remove staggered animation delays on cards

#### 3. `src/pages/Index.tsx`
- Replace `glass` header with a simple `bg-background border-b`
- Remove gradient from logo icon — use a plain primary-colored container
- Simplify AI toggle button — standard primary style when active, outline when inactive
- Remove gradient from guest badge — plain muted background
- Remove `shadow-2xl` from AI pane

#### 4. `src/components/AIChatPane.tsx`
- Remove gradient header — plain border-b with simple icon
- Simplify message avatars — plain colored circles, no gradients
- User messages: solid primary background instead of gradient
- Apply button: solid primary instead of gradient
- Send button: solid primary instead of gradient
- Quick action chips: cleaner, no border animations

#### 5. `src/components/spreadsheet/Toolbar.tsx`
- Remove `glass` class — simple `bg-background border-b`
- Keep functional grouping but remove `bg-accent/40` wrappers around button groups

#### 6. `tailwind.config.ts`
- Keep animation keyframes (they're useful) but the excessive decorative usage will be removed from components

### Result
A clean, tool-like interface that looks professional and production-ready — closer to Google Sheets, Notion, or Airtable than a design experiment.

