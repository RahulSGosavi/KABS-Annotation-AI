# KABS Annotation & Pricing AI - Design Guidelines

## Design Approach
**Reference-Based:** Drawing inspiration from professional productivity tools like Linear, Figma, and Notion for clean, efficient interfaces optimized for focused work.

**Core Principle:** Professional-grade annotation tool with minimal visual distraction and maximum functional clarity.

---

## Color Strategy
**Dark Theme Foundation** (user-specified default):
- Deep charcoal/near-black backgrounds
- Subtle borders and dividers for hierarchy
- High-contrast text for readability
- Accent colors for interactive elements and tool states
- Muted backgrounds for panels to reduce eye strain during long editing sessions

---

## Typography
**Font Stack:** 
- Primary: Inter or SF Pro (clean, professional)
- Monospace: JetBrains Mono (for measurements and technical data)

**Hierarchy:**
- Page Titles: 24px, semibold
- Section Headers: 18px, medium
- Body Text: 14px, regular
- UI Labels: 12px, medium
- Technical Data (measurements): 13px monospace

---

## Layout System
**Spacing Units:** Tailwind units of 2, 4, 6, and 8 for consistent rhythm
- Component padding: p-4 to p-6
- Section spacing: gap-6 to gap-8
- Container margins: mx-auto with max-w-7xl

**Grid Strategy:**
- Dashboard cards: 2-column grid (md:grid-cols-2)
- Projects page: 3-column grid for project cards (sm:grid-cols-2 lg:grid-cols-3)
- Editor: Fixed sidebar layout (left tools 64px, right panels 280px, center fluid)

---

## Core Components

### Authentication Pages
- Centered card layout (max-w-md)
- Minimal, focused design
- Large input fields with clear labels
- Single primary CTA button

### Top Navigation Bar
- Fixed height: h-16
- Left: Logo/brand text
- Right: User dropdown with subtle hover state
- Persistent across all pages except editor (where it adapts)

### Dashboard Cards
- Rounded corners (rounded-lg)
- Hover lift effect (subtle shadow increase)
- Clear iconography for modules
- "Coming Soon" badge treatment for inactive modules

### Projects Page
- Section headers with counts
- Project cards with metadata (name, date, status badge)
- Hover states with scale transform
- Primary "New Project" button (prominent, top-right)

### Editor Layout
**Left Toolbar:**
- Vertical icon-only buttons (48x48px active areas)
- Active tool highlight state
- Tooltips on hover
- Grouped by function with subtle dividers

**Center Canvas:**
- Full remaining viewport
- PDF centered with surrounding workspace
- Zoom controls (bottom-right floating)
- Page navigation controls (bottom-center)
- Smooth pan/zoom animations (300ms ease)

**Right Panel:**
- Tabbed interface (Properties/Layers)
- Collapsible sections
- Live preview of color/stroke changes
- Drag handles for layer reordering

### Modals & Dialogs
- Backdrop blur effect
- Centered, max-w-lg
- Clear primary/secondary actions
- Smooth fade-in (200ms)

---

## Component Library Details

### Buttons
- Primary: Solid fill, rounded-md, px-6 py-2.5
- Secondary: Border only, same padding
- Icon buttons: Square 40x40px minimum touch target
- Disabled state: Reduced opacity (0.5)

### Inputs
- Height: h-11
- Border radius: rounded-md
- Focus ring: 2px accent color
- Error state: Red border with message below

### Status Badges
- Pill shape (rounded-full)
- Small text (text-xs)
- Draft: Muted yellow
- Saved: Green
- Coming Soon: Blue

### Sidebar Panels
- Background slightly lighter than main
- Subtle shadow for depth
- Resizable with drag handle (optional for properties)

---

## Animations & Interactions
**Minimal, Purpose-Driven:**
- Tool selection: 150ms color transition
- Canvas zoom: 300ms smooth ease
- Card hover: 200ms scale + shadow
- Auto-save indicator: Fade pulse
- Page transitions: None (instant for performance)

**Critical:** All canvas interactions (draw, move, resize) must be 60fps - no animation delays on core annotation functions.

---

## Responsive Behavior
- Desktop (1440px+): Full three-panel editor layout
- Tablet (768-1439px): Collapsible right panel, floating tool switcher
- Mobile (< 768px): Stacked UI, bottom tool drawer, simplified controls

---

## Images
**No Hero Images Required** - This is a professional tool, not a marketing site.

**In-App Graphics:**
- Empty state illustrations for zero projects
- Tool icons (use Heroicons or Lucide Icons)
- PDF thumbnails generated from uploads

---

## Footer
- Simple, single-line text
- Centered, text-sm
- Hidden on editor page
- Present on all other pages

---

## Accessibility
- Keyboard shortcuts for all tools (displayed in tooltips)
- Focus indicators on all interactive elements
- ARIA labels for icon-only buttons
- High contrast maintained throughout