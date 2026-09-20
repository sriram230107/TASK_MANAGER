---
description: New UI foundation (design system, routing, theming, accessibility, PWA, i18n) plus 3D
---
# Phase 2: modern UI, design system and 3D

Context: read `AGENTS.md` (Frontend and design section), `frontend/src/index.css`, `pages/DashboardRouter.tsx`, `components/three/LoginScene.tsx`.
Current problems: navigation is one `useState` (only `/` and `/login` exist), about 1,270 inline styles, dark-only, 3 aria attributes in the whole app, 15 native `alert/confirm`,
`lucide-react` and `zod` installed but unused, a single 535 KB script with no code splitting, components of 600 to 880 lines.
Strategy: **strangler migration.** Build the new shell and design system, then move screens one module at a time. Keep `src/services` and the API contract.
Write a **design plan first** (palette of 4 to 6 named colors, type pairing, layout sketch, principles), review it against "would this look like any generic SaaS?", revise, then wait for my approval.

## Steps

1. **Foundations.** Tailwind CSS plus shadcn/ui (Radix), design tokens as CSS variables, light, dark and system themes, brand color and logo from organization settings
   (add the settings and an upload). Replace the Google Fonts `@import` with a self-hosted, chosen typeface pair. No `alert()` or `confirm()`: use toasts (sonner) and dialogs.
2. **Routing.** React Router with real URLs and nested, lazy routes (`/`, `/tasks`, `/tasks/:id`, `/people`, `/people/:id`, `/attendance`, `/leave`, `/performance`, `/payroll`,
   `/documents`, `/reports`, `/settings`, `/audit`). Role guards. Redirect after sign-in to the requested URL. 404 page. Each route is its own chunk.
3. **Data layer.** TanStack Query with typed hooks per service, cache invalidation, optimistic updates for task moves. Shared zod schemas for forms (react-hook-form).
4. **App shell.** Collapsible sidebar, top bar with global search, **Ctrl+K command palette** (`cmdk`), notification drawer, breadcrumbs, user menu. Skeleton loaders and empty states with a next action.
5. **Home.** Personalised, rearrangeable widgets (my tasks, due today, approvals waiting, team workload, attendance, announcements) instead of four fixed role pages.
6. **Accessibility.** Keyboard navigation everywhere, visible focus, labels, live regions for toasts, WCAG AA contrast. Add Playwright with `@axe-core/playwright` and fail CI on serious violations.
7. **Responsive and PWA.** Mobile-first layouts, installable PWA, offline shell, safe areas. Test at 360, 768, 1280 and 1920 px.
8. **i18n.** `react-i18next`, English first, all strings extractable, locale-aware dates, numbers and currency (from organization settings).
9. **3D (see rules in `AGENTS.md`).**
   - Keep the sign-in "work graph". Make node colors follow the brand color.
   - Add a **Home hero** that draws a live task graph from real data (hubs are teams, nodes are open tasks, edges are dependencies), click a node to open `/tasks/:id`.
   - Add an **Org chart** page with a 2D tree by default and a 3D toggle (lazy). The 2D view is always the accessible one.
   - Share one `SafeCanvas` wrapper (WebGL check, error boundary, reduced motion, data saver, low-power, idle pause, dispose). Keep every 3D chunk under about 250 KB gzipped.
10. **Migration order.** Login, the auth screens built in the identity stage (invite, reset, 2FA, sessions), and the shell; then Tasks (coordinate with Phase 3), People, Leave, Attendance, Documents, Performance, Payroll, Reports, Settings, Audit. Delete each old component once replaced.

## Acceptance criteria

- No new inline styles; migrated screens have none. Lighthouse accessibility 95+ on main pages; axe reports no serious issues.
- Refresh and back button work everywhere; deep links open the right screen after sign-in.
- Initial JS under about 200 KB gzipped; 3D loads only where used. `npm run build` and `lint` pass.
- Playwright smoke tests for sign-in, navigation per role, command palette, theme switch, and 3D fallback (WebGL disabled).
- Screenshots of every migrated screen at mobile and desktop attached to the report. Then run `/verify-phase`.
