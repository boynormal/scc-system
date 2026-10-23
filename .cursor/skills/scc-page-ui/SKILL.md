---
name: scc-page-ui
description: Builds or updates SCC pages with the shared compact shell so lists, forms, tables, filters, and dialogs look the same across the app, stay dense, and keep text contrast clear in light and dark mode. Use when creating or changing a page, list, table, filter bar, page title, form, or dialog anywhere in the app.
---

# SCC page UI

A page you are adding or changing uses one shell. Do not copy a module header, accent color, or toolbar. Leave pages you were not asked to change as they are.

## List page

Compose `ListFrame` from `components/shell/list-frame.tsx`. It renders `PageHeader`, an optional one-row filter slot, and a table `DataPanel`.

- Put `EmptyState` and `ListPagination` in the table slot.
- Keep filters on one horizontal row. Do not stack a tall filter card.
- Short create or edit flows open `GlassDialog` with `solid` on the current page. Do not add a full page for a few fields.
- Forms use `Input`, `Select`, and `Button` from `components/ui`.
- Status uses `Badge`. Do not invent pale text on a pale background.

## Contrast

`PageHeader` sets the title and the description to `text-foreground` because the header sits on the module gradient. Table cells and headers inside `ListFrame` are `text-foreground`.

- Primary text (title, description, cell, button label, form value) uses `text-foreground`.
- `text-muted-foreground` is only for secondary hints inside a solid `DataPanel` or an `Input`.
- Do not put faint text on `ModuleBackdrop` or on colored blur orbs.
- Do not use `text-white/60`, `text-slate-400`, `text-violet-700/80`, or hardcoded hex text colors.
- Check both light and dark.

## Chrome

If the module layout already wraps `ModuleBackdrop`, do not wrap it again. Finance and transport layouts already do. A new module layout may wrap it once.

User-visible strings go in `messages/*.json`. Client loads use `LoadingState`, `ErrorState` (with Retry), `EmptyState`, and `fetchJson`.

## Do not

- Do not create a new colored page header or blur-orb hero.
- Do not copy the hardcoded white table from `app/(dashboard)/assets/page.tsx`.
- Do not copy the transport toolbar into another module.
- Do not restyle a page you were not asked to change. The list, filter bar, title, or short form you are editing uses `ListFrame` and `PageHeader`.
