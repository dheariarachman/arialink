# DESIGN.md — Pradaci Dashboard Design System

> **Scope:** A color-agnostic design system derived from the supplied Pradaci dashboard screenshot. Focuses on typography, spacing, layout, component geometry, hierarchy, and responsive behavior.
>
> **Status:** Reference specification / implementation baseline, **not** an exported Figma design system. All screenshot-based dimensions and font identifications are **visual estimates** and should be calibrated against the original source file, if available.

> **Spacing baseline:** Section 3.3 records the approved compact spacing used in ARIALink. These implementation rules take precedence over screenshot estimates for spacing.

## 1. Design Principles

- **Minimalist SaaS aesthetic:** Prioritize clarity, alignment, and functional hierarchy over decoration.
- **Compact information density:** Display useful dashboard data using small but readable typography and controlled spacing.
- **Consistent rhythm:** Apply a 4 px spacing grid throughout page layout and components.
- **Quiet component boundaries:** Separate content with thin borders and whitespace instead of heavy effects.
- **Predictable interaction geometry:** Use consistent heights for navigation rows, controls, and table rows.
- **Responsive by design:** Preserve information hierarchy while adjusting grids, navigation, and tables for smaller viewports.
- **No color prescriptions:** Do not infer or specify a palette, semantic colors, or theme colors from this reference.

## 2. Typography

### 2.1 Font family

**Recommended implementation font:** `Inter`.

The original font **cannot be positively identified from the screenshot**. Inter provides a practical, visually similar starting point; Plus Jakarta Sans is a plausible alternative. The choice of Inter here is an implementation recommendation, not a claim about the exact source font.

```css
font-family: "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
  "Segoe UI", sans-serif;
```

### 2.2 Type scale

| Token | Size | Default line-height | Suggested weight | Typical use |
| --- | ---: | ---: | ---: | --- |
| `text-xs` | 11 px | 16 px | 400–500 | Table headers, metadata, helper text |
| `text-sm` | 12 px | 18 px | 400–500 | Descriptions, KPI labels, secondary body text |
| `text-base` | 13 px | 20 px | 400–500 | Sidebar items, compact controls, table values |
| `text-md` | 14 px | 20 px | 400–500 | General body text, input labels |
| `text-lg` | 16 px | 24 px | 500–600 | Brand name, greeting |
| `text-xl` | 20 px | 28 px | 600 | Page title |
| `text-2xl` | 28 px | 32 px | 600 | Primary KPI value |

The screenshot suggests KPI values around **26–28 px**. Start with 28 px and adjust if the reference requires a denser fit.

### 2.3 Font-weight rules

| Token | Value | Usage |
| --- | ---: | --- |
| `font-regular` | 400 | Body copy, inactive navigation, metadata |
| `font-medium` | 500 | Labels, controls, table emphasis |
| `font-semibold` | 600 | Page headings, card headings, KPI values |

Avoid relying on 700–800 weights: the reference establishes hierarchy primarily through scale and whitespace.

### 2.4 Typography behavior

- **Headings:** Typically use slight negative tracking (`-0.02em`) only when appropriate, especially page titles and large metrics.
- **Body:** Keep natural tracking (`normal` or `0`).
- **Financial metrics:** Enable tabular numerals with `font-variant-numeric: tabular-nums`.
- **Text alignment:** Default left-aligned; numerical columns may be right-aligned for easier comparison when the table design permits.
- **Truncation:** Use ellipsis only where column width is constrained; provide access to the full value.
- **Legibility:** Do not automatically scale all typography smaller on mobile. Compact source measurements are not a reason to compromise accessibility.

### 2.5 Typography hierarchy by element

| Element | Size | Weight | Line-height |
| --- | ---: | ---: | ---: |
| App brand | 16 px | 600 | 24 px |
| Greeting | 16 px | 600 | 24 px |
| Page title (`Dashboard`) | 20 px | 600 | 28 px |
| Page description | 12 px | 400 | 18 px |
| KPI title | 12 px | 500 | 18 px |
| KPI number | 26–28 px | 600 | 32 px |
| Section/card title | 13 px | 600 | 20 px |
| Sidebar link | 13 px | 400–500 | 20 px |
| Table header | 11 px | 400–500 | 16 px |
| Table cell | 11–12 px | 400–500 | 18 px |
| Helper text/pagination | 11–12 px | 400 | 16–18 px |

## 3. Spacing and Rhythm

### 3.1 Base unit

Use a **4 px base spacing unit**. The most commonly visible intervals appear to be 8, 12, 16, 20, and 24 px.

| Token | Value | Common usage |
| --- | ---: | --- |
| `space-1` | 4 px | Tight label/description gap |
| `space-2` | 8 px | Icon-text gap, compact element gap |
| `space-3` | 12 px | List row padding, content gaps, card section spacing |
| `space-4` | 16 px | Card padding, mobile page padding |
| `space-5` | 20 px | Main content padding, card-to-card gap |
| `space-6` | 24 px | Sidebar grouping, section separation |
| `space-8` | 32 px | Major section separation |
| `space-10` | 40 px | Larger layout breathing room |

### 3.2 Estimated spacing in the screenshot

| Relationship | Estimated spacing |
| --- | ---: |
| Sidebar horizontal content padding | 20–24 px |
| Space between sidebar navigation rows | 4–8 px |
| Sidebar row internal horizontal padding | 10–12 px |
| Sidebar section separation | 24–28 px |
| Main content horizontal padding | 18–20 px |
| Main content top padding | 20–24 px |
| Page title to subtitle | 4–8 px |
| Subtitle to KPI row | 16 px |
| KPI internal padding | 12–16 px |
| Horizontal card gap | 18–20 px |
| Vertical card gap | 18–20 px |
| Table cell horizontal padding | 8–12 px |

**Implementation convention:** Prefer exact tokens (for example, 20 px) when a screenshot estimate falls within a narrow interval. Avoid adding arbitrary 1–3 px adjustments until visual QA.

### 3.3 Current application spacing rules

Apply these rules across Beranda, Transaksi, Saldo, Laporan, Pengguna, and their detail dialogs. Keep colors, typography, borders, radii, and data behavior unchanged when adjusting spacing.

| Relationship | Size | CSS token | Tailwind equivalent |
| --- | ---: | --- | --- |
| Card-to-card gap, both axes | 20 px | `--card-gap` | `gap-5` |
| Card inner padding | 16 px | `--card-padding` | `p-4` |
| List/detail row vertical padding | 12 px | `--row-padding` | `py-3` |
| Gap between row contents | 12 px | `--row-gap` | `gap-3` |
| Card header/content spacing | 12 px | `--section-gap` | `gap-3`, `mb-3` |
| Gap between adjacent action buttons | 8 px | `--action-gap` | `gap-2` |
| Label/metadata gap | 4 px | `--space-1` | `gap-1`, `mt-1` |
| Main content horizontal padding | 20 px desktop/tablet; 16 px mobile | `--content-padding`, `--space-4` | `px-5`, `px-4` |

- Keep related row content together. Name/email blocks must not grow merely to push roles or actions to the far edge. Balance summaries, detail rows, and report filters use natural content widths and 12 px gaps.
- Let text wrap with `min-width: 0` and `overflow-wrap: anywhere` where needed. Allow actions to wrap rather than adding large gaps or clipping labels.
- Remove first-row top padding and last-row bottom padding when the enclosing card already supplies the outer padding. When a header or footer intervenes, retain the applicable 12 px section gap.
- Financial tables retain aligned columns and their existing cell padding and row heights; do not convert them to compact flex rows.
- Use one shared grid for related card rows, with spanning panels on the same tracks. Use three summary/balance columns on desktop, two on tablet, and one on mobile. Cash denomination cards retain five desktop columns, two on tablet, and one on mobile.
- Preserve 44 px mobile touch targets and visible keyboard focus. Compact spacing must not shrink interactive targets.
- Keep the 20 px card gap at every breakpoint. Use 24 px vertical padding and 16 px horizontal padding for empty states.

## 4. Dashboard Layout

### 4.1 Desktop regions

The screenshot shows:

1. A **fixed-width sidebar** at the left.
2. A **top header** within the remaining content region.
3. A **page introduction** (title and description).
4. A horizontal row of **KPI cards**.
5. A lower content row with a **wide transaction table** and **narrower chart/metric panel**.

```text
┌──────────────┬───────────────────────────────────────────────┐
│              │ Header: Greeting      Search       Actions    │
│   Sidebar    ├───────────────────────────────────────────────┤
│              │ Dashboard                                     │
│   Brand      │ Description                                   │
│   Nav        │                                               │
│   Tools      │ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│   Other      │ │ KPI card 1 │ │ KPI card 2 │ │ KPI card 3 │ │
│              │ └────────────┘ └────────────┘ └────────────┘ │
│              │                                               │
│              │ ┌───────────────────────┐ ┌─────────────────┐ │
│              │ │ Transaction table     │ │ Chart / metric  │ │
│              │ │                       │ │                 │ │
│              │ └───────────────────────┘ └─────────────────┘ │
└──────────────┴───────────────────────────────────────────────┘
```

### 4.2 Desktop layout measurements

| Token / Region | Estimated value |
| --- | --- |
| Sidebar width | 206–208 px; implement as **208 px** |
| Header height | 76–80 px; implement as **78 px** |
| Main content horizontal padding | **20 px** |
| Gap between cards | **20 px** |
| KPI card height | 136–140 px; implement as **138 px** if fixed height is needed |
| Search height | 38–40 px; implement as **40 px** |
| Table row height | 27–29 px; implement as **28 px** for visual reproduction |

The screenshot is cropped at the right edge. Do **not** infer exact total page width or assume that all three KPI cards fit within the visible crop at every viewport size.

### 4.3 Grid recommendations

- Use a two-column **application shell**: `208px minmax(0, 1fr)` on desktop.
- Within main content, use a flexible grid with **20 px** gap.
- KPI card layout: `repeat(3, minmax(0, 1fr))` only when the available container width permits readable content.
- Lower dashboard panels share the three summary-card tracks: the transaction panel spans two tracks and the balance panel spans one. On tablet/mobile, these panels span the full grid width.
- Apply `min-width: 0` to grid children so long content does not unexpectedly expand columns.

## 5. Component Specifications

### 5.1 Application sidebar

**Structure:** Brand/header area, navigation groups, icon-and-label items.

| Property | Guideline |
| --- | --- |
| Width | 208 px desktop |
| Horizontal content padding | 20–24 px |
| Navigation row height | 36 px visual target |
| Navigation radius | 8 px |
| Icon size | 16 px |
| Icon-to-label gap | 10–12 px |
| Label font | 13 px / 20 px, 400–500 |
| Group separation | 24 px |

- Keep icon and label vertically centered.
- Active items have a rounded bounded state; distinguish them by more than color in the final themed implementation.
- Icons are outlined, visually similar to Lucide, with approximately 1.5–1.75 px strokes.
- Provide an accessible text label and current-page indicator (`aria-current="page"`) for the active link.

### 5.2 Top header

| Property | Guideline |
| --- | --- |
| Height | 78 px |
| Greeting | 16 px, weight 600 |
| Subtitle | 12 px, weight 400 |
| Search | 40 px high, pill radius |
| Header action icons | ~16–20 px |

- Use flex layout, with greeting left and search/actions to the right.
- Prevent search from forcing the action group off-screen.
- Maintain adequate interactive hit areas independent of the visual icon size.

### 5.3 Page introduction

- **Page title:** 20 px, weight 600, 28 px line-height.
- **Subtitle:** 12 px, regular, 18 px line-height.
- **Title/subtitle spacing:** 4–8 px.
- **Gap to KPI row:** about 16 px.
- Optional badges and compact context labels sit adjacent to the title, vertically centered.

### 5.4 KPI / statistics card

| Property | Guideline |
| --- | --- |
| Height | Approximately 138 px |
| Padding | 12–16 px |
| Radius | 6–8 px |
| Heading | 12 px, weight 500 |
| Value | 26–28 px, weight 600, 32 px line-height |
| Secondary data | 11–12 px |
| Filter control | Approximately 28 px high |

**Composition:**

```text
┌────────────────────────────────────┐
│ Metric title        [Period ▼]     │
│                                    │
│ $597,095.04                       │
│                                    │
│ +12% vs prev. month    [mini chart]│
└────────────────────────────────────┘
```

- Use tabular numerals for values.
- Align dropdown controls consistently across cards.
- Do not allow mini-chart decorations to overlap KPI values or labels.
- The percentage change should have explicit text or an accessible label conveying its direction, not color alone.

### 5.5 Transaction table / data card

| Property | Guideline |
| --- | --- |
| Section heading | 13 px / 20 px, weight 600 |
| Table header text | 11 px / 16 px |
| Table cell text | 11–12 px / 18 px |
| Row height | Approximately 28 px visually |
| Cell horizontal padding | 8–12 px |
| Pagination text | 11–12 px |

- Use semantic `<table>`, `<thead>`, `<tbody>`, and `<th scope="col">` elements.
- Keep column headings and values aligned.
- Status pills can include an icon and short text; text must remain present.
- Use concise truncation only when full text is reachable (for example, through a tooltip or detail view).
- Use horizontal scrolling on constrained screens instead of crushing columns until unreadable.
- For production accessibility, allow rows to grow taller than the 28 px visual reference if needed for readable type and touch interaction.

### 5.6 Search and filters

- **Search field:** 40 px visual height, rounded pill (radius 9999 px).
- **Compact filter:** 24–28 px visual height, rounded medium/pill depending on context.
- **Search icon:** ~16 px; clear placeholder and accessible name.
- **Chevron:** aligned to the right of the control label.
- Keep controls keyboard-operable and expose focus states in the later theme implementation.

### 5.7 Secondary chart panel

- Panel radius: 6–8 px.
- Title: 13 px / 20 px, weight 600.
- Maintain distinct spacing between title, chart, and supporting legend/metrics.
- Use readable numeric labeling and textual equivalents for chart data; avoid relying solely on arcs, bars, or color.
- Chart geometry is a reference illustration, not an exact data visualization contract.

### 5.8 Icons

- Prefer an outline icon family such as **Lucide**.
- Default size: **16 px** for navigation and compact controls.
- Adjust header action icon sizes up to ~20 px as needed.
- Stroke width: approximately **1.5–1.75 px**.
- Use consistent optical alignment; avoid mixing filled and outline styles without a reason.

## 6. Shape, Borders, and Elevation (Color-Neutral)

| Token | Value | Use |
| --- | --- | --- |
| `radius-sm` | 4 px | Dense sub-elements |
| `radius-md` | 6 px | Small controls |
| `radius-lg` | 8 px | Cards, active navigation |
| `radius-pill` | 9999 px | Search, pill filters |
| `border-thin` | 1 px | Card outlines, dividers, table rules |

The reference appears to rely on **subtle 1 px boundaries** rather than prominent shadows. Border colors, fills, and elevations are intentionally **not defined** here.

## 7. Responsive Behavior (Recommended, Not Inferred)

The screenshot only provides a desktop view. The rules below are proposed implementation behavior rather than measured properties of the source design.

| Viewport | Application shell | KPI layout | Lower panels |
| --- | --- | --- | --- |
| `>= 1200px` | Fixed 208 px sidebar | 3 columns | 2 columns |
| `768–1199px` | Collapsible or compact sidebar | 2–3 columns depending on usable width | 1–2 columns |
| `< 768px` | Sidebar becomes drawer | 1 column, optionally 2 when room allows | 1 column |

- On mobile, show a clear navigation trigger instead of shrinking the full sidebar to fit.
- Allow the header greeting and search/action area to wrap or reorganize.
- Keep card metrics legible; do not force a 28 px KPI value into a narrow layout if it will clip.
- Apply the exact current column counts and spacing in section 3.3 when implementing ARIALink; the table above describes the original reference recommendations.
- Allow transaction tables to scroll horizontally or provide an intentionally designed card-based alternative.
- Treat **44 × 44 px** as a useful minimum touch target for interactive mobile controls, even if the visual component is smaller.
- Respect user font-size and zoom settings; prevent fixed heights from clipping enlarged text.

## 8. CSS Design Tokens

The following tokens intentionally omit all colors.

```css
:root {
  /* Font family */
  --font-family: "Inter", ui-sans-serif, system-ui, sans-serif;

  /* Type scale */
  --text-xs: 11px;
  --text-sm: 12px;
  --text-base: 13px;
  --text-md: 14px;
  --text-lg: 16px;
  --text-xl: 20px;
  --text-2xl: 28px;

  /* Line heights */
  --leading-xs: 16px;
  --leading-sm: 18px;
  --leading-base: 20px;
  --leading-lg: 24px;
  --leading-xl: 28px;
  --leading-2xl: 32px;

  /* Font weights */
  --font-regular: 400;
  --font-medium: 500;
  --font-semibold: 600;

  /* Spacing: 4px grid */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* Layout */
  --sidebar-width: 208px;
  --header-height: 78px;
  --content-padding: 20px;
  --card-gap: 20px;
  --card-padding: 16px;
  --row-padding: var(--space-3);
  --row-gap: var(--space-3);
  --action-gap: var(--space-2);
  --section-gap: var(--space-3);

  /* Radius and geometry */
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-pill: 9999px;
  --border-thin: 1px;

  /* Component targets */
  --nav-height: 36px;
  --input-height: 40px;
  --filter-height: 28px;
  --kpi-height: 138px;
  --table-row-height: 28px;
  --icon-size: 16px;
}

/* Example: color-neutral application shell */
.app-shell {
  display: grid;
  grid-template-columns: var(--sidebar-width) minmax(0, 1fr);
  min-height: 100vh;
}

.main-content {
  min-width: 0;
  padding: var(--content-padding);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--card-gap);
}

.kpi-card {
  min-width: 0;
  padding: var(--card-padding);
  border-radius: var(--radius-lg);
  /* Border styling is supplied by the consuming theme. */
}

.metric-value {
  font-size: var(--text-2xl);
  line-height: var(--leading-2xl);
  font-weight: var(--font-semibold);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 1199px) {
  .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 767px) {
  .app-shell { grid-template-columns: minmax(0, 1fr); }
  .kpi-grid { grid-template-columns: minmax(0, 1fr); }
  .main-content { padding: var(--space-4); }
}
```

## 9. Tailwind CSS / shadcn/ui Implementation Notes

ARIALink uses JSX and global CSS. Tailwind and the shadcn/ui component foundation are installed; migration of existing screens is incremental.

- Add only the shadcn/ui components needed by existing screens. Keep their source in the repository and adapt them to this design system rather than treating their defaults as a new design baseline.
- Map shared spacing, typography, geometry, and responsive behavior to the existing tokens in `app/globals.css`. Keep theme colors in the application theme; this document does not prescribe them.
- Preserve the existing Indonesian labels, accessible names, keyboard behavior, focus visibility, mobile touch targets, and data-entry behavior. In particular, retain rupiah formatting, empty-versus-zero distinctions, and manually maintained balances.
- Migrate the application shell and existing screens incrementally. Preserve authentication, API, synchronization, and offline behavior; the component migration should not introduce new product features.
- Verify layouts at desktop, tablet, and mobile widths and at 200% zoom. Test dialogs, navigation, forms, tables, loading and error states with keyboard and touch as appropriate.

- Install and set **Inter** as the application sans-serif font, or swap to another visually validated candidate.
- Tailwind's default spacing scale already maps naturally to the 4 px base: `1=4px`, `2=8px`, `3=12px`, `4=16px`, `5=20px`, `6=24px`, `8=32px`, `10=40px`.
- Prefer explicit typography utilities for this compact visual system; for example `text-[13px] leading-5` for sidebar labels and `text-[28px] leading-8 font-semibold tabular-nums` for KPI values.
- The default shadcn/ui control sizing may be larger than the screenshot. Override selectively, without shrinking focus targets or making controls inaccessible.
- Customize radius tokens globally to maintain consistency.
- Implement app structure using composable components:
  - `AppShell`
  - `AppSidebar`
  - `DashboardHeader`
  - `PageHeading`
  - `StatCard`
  - `FilterSelect`
  - `TransactionTable`
  - `Pagination`
  - `MetricChartCard`
- Keep density and typography decisions centralized in tokens rather than repeating arbitrary pixel values across components.

### Sample JSX / Tailwind structure

```tsx
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-[208px_minmax(0,1fr)]">
      <aside className="hidden md:block">{/* AppSidebar */}</aside>
      <div className="min-w-0">
        <header className="min-h-[78px]">{/* DashboardHeader */}</header>
        <main className="min-w-0 p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
}

export function KpiGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}
```

These examples illustrate layout only. They intentionally contain no palette or theme styling.

## 10. Accessibility and UX Requirements

Visual fidelity should not come at the expense of usability:

- Maintain semantic heading order (`h1` for page title, then lower heading levels for card sections).
- Provide visible focus states through the consuming theme.
- Ensure keyboard access for sidebar links, filters, search, pagination, and menus.
- Support at least 200% zoom without content loss or unusable overflow.
- Use accessible labels for icon-only buttons and search fields.
- Avoid communicating status and data-change direction through color alone.
- Use text or accessible data tables as alternatives to chart-only information.
- Keep interactive hit targets comfortably sized, especially for touch devices.
- Verify text contrast once a color theme is defined; contrast cannot be tested in this color-neutral specification.

## 11. Design QA Checklist

- [ ] Typography uses one consistent sans-serif family with weights 400/500/600.
- [ ] Page title is visually stronger than section headings and KPI labels.
- [ ] KPI numbers use tabular numerals and fit their containers.
- [ ] Spacing uses the 4 px scale rather than arbitrary values.
- [ ] Desktop sidebar targets 208 px and header targets 78 px.
- [ ] Sidebar items align icons and labels on a consistent 36 px visual rhythm.
- [ ] KPI cards align their titles, filters, and values.
- [ ] Card gaps and content padding are consistent.
- [ ] Rows use 12 px padding/gaps, actions use 8 px gaps, and metadata uses 4 px gaps.
- [ ] First/last rows avoid doubled outer padding; related content has no expanding spacer.
- [ ] Tables retain readable column labels and values at narrow widths.
- [ ] The interface is usable with keyboard, zoom, and screen readers.
- [ ] Responsive layouts are tested at desktop, tablet, and mobile widths.
- [ ] No palette or specific colors are hard-coded in the design system.
- [ ] Final measurements have been verified against the original design file if available.

## 12. Known Uncertainties

1. **Exact font family:** Not determinable from this screenshot. `Inter` is a recommended approximation.
2. **Exact spacing and layout coordinates:** Derived from visual inspection, not pixel-perfect measurement of original assets.
3. **Complete dashboard width and grid proportions:** The right side of the screenshot is cropped.
4. **Interactions and behavior:** Hover, focus, selected, expanded, and empty states are not visible.
5. **Mobile/tablet design:** No responsive reference was supplied; behavior in this document is proposed, not observed.
6. **Color theme:** Deliberately excluded from scope.

---

**Implementation priority:** Start with typography → spacing → application shell → card/grid geometry → tables/controls → responsive adaptation → accessibility review. Calibrate the visual details against the actual design source when available.
