# Design Review — 29 October 2026

Baseline: [`DESIGN.md`](../DESIGN.md). Future UI changes must follow this document as recorded in `AGENTS.md`.

## Adjustments

- Centralized the type scale, line heights, weights, 4 px spacing scale, and component dimensions in CSS tokens. Typography uses relative units to respect browser font preferences.
- Aligned the desktop shell to a 208 px sidebar, 78 px minimum header, 20 px content padding/gaps, and 8 px card radii. Heights may grow for enlarged text.
- Applied 20 px page titles, 13 px section titles, and 28 px tabular KPI values at default font settings.
- Added three/two/one-column KPI layouts at desktop/tablet/mobile widths. Tables retain column headings and scroll horizontally instead of losing semantics on mobile.
- Replaced navigation glyphs with consistent outline SVGs and added an accessible mobile navigation drawer, active-state markers, labeled dialogs, column scopes, keyboard-focusable table regions, and exposed filter selection states.
- Preserved the existing app theme separately from the color-neutral measurements. Incremented the service-worker cache version for the updated application shell.

## Verification and Limits

- Existing Node test files and `npm run check` pass.
- Next.js SWC compiles the JSX entry points; PostCSS parses the stylesheet.
- `npm run build` is blocked by the environment rejecting OpenNext's loopback listener (`EPERM`). Chromium also cannot launch because socket operations are restricted.
- Desktop/mobile rendering, keyboard interactions, 200% zoom, contrast, and PWA update behavior still require browser verification. No original screenshot or source design file was available for visual calibration.
- The font stack prefers Inter and falls back to system sans-serif; Inter is not bundled.
