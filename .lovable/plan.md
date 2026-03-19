

# 🏗️ Engineering-Plattform — MechAI

A browser-based engineering platform for mechanical engineering & construction with AI-powered analysis, component search, and documentation.

## Phase 1: Foundation — Design System, Sidebar & Dashboard

### Design System
- Dark blue/gray theme (#1E3A8A primary, #374151 gray, #F59E0B orange accent)
- Inter font for headings, monospace for technical terms
- Custom CSS variables for the engineering color palette
- Dark mode by default with light mode toggle

### Sidebar Navigation
- Collapsible sidebar with icons: Home, Bild-Analyse, Komponenten-Suche, Lösungen, AI-Prompts, Dokumentation
- Active link highlighting, hover effects
- Mobile: collapses to hamburger menu
- Floating Action Button "Neue Analyse"

### Dashboard (/home)
- Hero card with image upload zone + text input + "Analysieren starten" button
- 6 Quick-Action cards in a responsive grid (Normteil-Suche, Material-Beratung, Solid Edge Tipps, DIN/ISO Normen, Blech-Design, Stückliste)
- Recent projects table with status, last modified, quick actions

## Phase 2: Bild-Analyse Page (/analyse)

- Drag & drop upload zone (JPG/PNG, max 10MB)
- Loading animation during AI analysis
- AI-powered image recognition via Lovable AI (Vision) identifying components, materials, norms
- Result cards: Recognized parts table, recommended alternatives, next steps (CAD, norm check, manufacturing)
- Problem detection highlights (e.g., bend radius too small)

## Phase 3: Komponenten-Suche (/komponenten)

- Search bar with autocomplete suggestions
- Multi-filter panel: Category, Material, Norm (DIN/ISO/EN), Load type
- Results in a Shadcn data table with columns: Component, Norm, Material, Size, Price, Supplier, CAD link
- Favorites button + export to CSV/PDF for bill of materials

## Phase 4: Lösungsvorschläge (/loesung)

- Input form for project description + requirements
- AI generates 3 solution variants displayed as tabs: Best recommendation, Cost-effective, High-performance
- Each solution includes: description, component list table, pros/cons accordion, cost estimate, "Export to CAD" button
- Simple SVG sketch area for solution visualization

## Phase 5: AI-Prompt Generator (/prompts)

- Input field for describing desired technical image
- AI generates detailed, professional prompts for image AIs (CAD-style rendering prompts)
- Copy-to-clipboard button + save as template functionality
- Template library for reusable prompts

## Phase 6: Dokumentation (/dokumentation)

- Bill of materials generator (table → PDF export)
- Technical drawing template viewer (SVG with dimensions)
- Norms overview (DIN/ISO/EN searchable reference)
- Material data sheets in tabular format
- Release checklist for mechanical engineering projects

## AI Integration (Central Intelligence)

- Lovable Cloud backend with edge functions
- Engineering-specialized system prompt (Senior Maschinenbau-Ingenieur persona)
- Context memory across sessions
- Image upload + Vision API for technical image analysis
- Structured output for component lists, norms, materials

