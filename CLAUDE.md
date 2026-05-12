# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

- `application/` — the Angular 19 app (this is the project root for all `ng`/`npm` commands; `cd application` first).
- `docs/` — committed build artifacts served via GitHub Pages. The Angular production build (`application/dist/application/browser/*`) is copied here when shipping (see commits like "updated prod build" / "production build"). Don't hand-edit; regenerate by building.
- `application/public/` — static assets copied verbatim into the build output.

## Commands (run from `application/`)

- `npm start` — dev server at http://localhost:4200 (auto-reload).
- `npm run build` — production build to `application/dist/application/`. App is configured with Angular SSR/prerender; output includes both `browser/` and `server/`.
- `npm run watch` — incremental development build.
- `npm test` — Karma + Jasmine unit tests (headless Chrome).
- Run a single spec: `npm test -- --include='**/calculator.spec.ts'` (or any path under `src/`). Specs live next to their sources as `*.spec.ts`.
- `npm run serve:ssr:application` — run the built SSR server (`node dist/application/server/server.mjs`).

## Architecture

Single-page app, no routing (`app.routes.ts` is empty). The entire UI is one feature component.

- `src/app/app.component.ts` — shell; just renders `<app-mortgage-visualizer>`.
- `src/components/mortgage-visualizer/calculator.ts` — **pure domain logic**, framework-free. `calculateMortgage(params, existingSchedule?)` produces a `PaymentDetail[]` amortization schedule. Supports monthly / bi-weekly / accelerated-bi-weekly frequencies and a per-payment lump sum. When passed an existing schedule, it mutates and returns that array in place (longer = appended entries, shorter = trailing entries nulled out) so the chart's x-axis labels stay stable as inputs change.
- `src/components/mortgage-visualizer/mortgage-visualizer.component.ts` — the only stateful component. Holds all inputs as reactive `FormControl`s grouped in one `FormGroup`; a `valueChanges` subscription (debounced 100ms) recomputes the schedule and rebuilds `chartData` on every edit. Renders a Chart.js (via `ng2-charts`) hybrid chart: two stacked bar datasets (cumulative interest, cumulative principal) plus a line dataset (remaining principal). Purchase-price has two models — a raw `ngModel` debounced 2s into the form control — to avoid thrashing while typing.

Key conventions:
- Path alias `@components/*` → `src/components/*` (defined in `tsconfig.json`).
- Standalone components only (no NgModules); each component declares its own `imports`.
- TypeScript is in `strict` mode plus `noPropertyAccessFromIndexSignature`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`; Angular `strictTemplates` is on.
- Styling: SCSS; Angular Material with the prebuilt `azure-blue` theme; currency inputs via `ng2-currency-mask`.
- Production build budgets: 2MB initial bundle (error), 8kB per-component style (error).
