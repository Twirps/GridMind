

## Plan: Modern UI Refresh

### Overview
Transform the plain, utilitarian look into a polished, modern aesthetic with subtle gradients, glassmorphism effects, refined typography, smooth animations, and a cohesive visual hierarchy -- without changing any functionality.

### Changes

#### 1. Color Palette and CSS Variables (`src/index.css`)
- Shift from flat white/gray to a slightly tinted cool-gray background with subtle depth
- Add a gradient mesh background for the dashboard page
- Add smooth transition animations (fade-in, slide-up) as keyframes
- Refine the spreadsheet cell styles with softer borders and smoother selection highlights
- Add a subtle animated gradient for the AI pane header

#### 2. Dashboard Page (`src/pages/Dashboard.tsx`)
- Add a hero gradient background with animated mesh/grid pattern
- Upgrade the header with a frosted glass effect (`backdrop-blur-xl`, semi-transparent bg)
- Make spreadsheet cards more visually rich: subtle gradient borders on hover, slight scale transform, shadow transitions
- Restyle the sign-in overlay card with a frosted glass aesthetic, gradient border accent, and larger typography hierarchy
- Add a subtle grid/dot pattern behind the blurred sample cards
- Improve the "New Spreadsheet" button with a gradient and hover animation
- Better empty state with an illustration-style icon treatment

#### 3. Editor Page (`src/pages/Index.tsx`)
- Frosted glass header bar matching dashboard style
- Refined save/export buttons with subtle hover states
- AI toggle button with a gradient accent when active
- Guest mode badge with a modern pill style

#### 4. AI Chat Pane (`src/components/AIChatPane.tsx`)
- Gradient header with the Sparkles icon
- Message bubbles with softer rounded corners and subtle shadows
- Typing indicator with animated dots instead of a spinner
- Input area with a modern floating style and gradient send button
- Smoother slide-in animation

#### 5. Toolbar (`src/components/spreadsheet/Toolbar.tsx`)
- Frosted glass background instead of flat gray
- Slightly rounded tool groups with subtle dividers
- Better active state indicators with smooth color transitions

#### 6. Tailwind Config (`tailwind.config.ts`)
- Add new keyframe animations: `fade-in`, `slide-up`, `shimmer`
- Add `backdrop-blur` utilities if needed

### Files Changed
- `src/index.css` -- new variables, animations, backgrounds
- `src/pages/Dashboard.tsx` -- modern card/overlay styling
- `src/pages/Index.tsx` -- refined header and layout
- `src/components/AIChatPane.tsx` -- polished chat UI
- `src/components/spreadsheet/Toolbar.tsx` -- glassmorphism toolbar
- `tailwind.config.ts` -- new animations

