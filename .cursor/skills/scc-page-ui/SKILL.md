---
name: scc-page-ui
description: Builds or updates SCC pages with the shared compact shell so lists, forms, tables, filters, and dialogs look the same across the app, stay dense, and keep text contrast clear in light and dark mode. Use when creating or changing a page, list, table, filter bar, page title, form, or dialog anywhere in the app.
---

# SCC page UI

A page you are adding or changing uses one shell. Do not copy a module header, accent color, or toolbar. Leave pages you were not asked to change as they are.

## List page

Compose `ListFrame` from `components/shell/list-frame.tsx`. It renders `PageHeader`, an optional one-row filter slot, and the content slot. For a table, set `plainPanel` and use the table shell below.

- Put `EmptyState` and `ListPagination` in the table slot.
- Keep filters on one horizontal row. Do not stack a tall filter card.
- Short create or edit flows open `GlassDialog` with `solid` on the current page. Do not add a full page for a few fields.
- Forms use `Input`, `Select`, and `Button` from `components/ui`.
- Status uses `Badge`. Do not invent pale text on a pale background.

## Tables

Every data table uses `components/shell/app-data-table.tsx`. Change the look there, not on a page.

- `AppDataTablePanel` is the frosted card. Put `EmptyState`, loading or error states, the table, and `ListPagination` inside it. On a `ListFrame` page, set `plainPanel` so the frame does not add a second card.
- `AppDataTable` is the `<table>`.
- `AppDataTableHead` gives the gray header with dark text. By default it sticks under the navbar while the page scrolls. Add `dense` for narrow columns.
- `AppDataTableBody` gives the row background, hover, and dividers. A row with its own color (editing, selected, alert, group heading) sets `data-tone` so the shared background does not cover it.
- Do not wrap a page table in `overflow-x-auto` or give it `min-w-[...]`. Either one stops the header from sticking. Let text wrap. On small screens, hide secondary columns with `hidden xl:table-cell` on both the `th` and the `td`.
- Do not add a vertical scroller inside a table.
- A small table inside an existing card or dialog uses `AppDataTable`, the head with `sticky={false}`, and the body. It goes without the panel, wrapped in `overflow-x-auto rounded-lg border border-border`.
- Do not override the `ModuleBackdrop` overflow in a layout. Its default keeps sticky headers working.
- Do not set header or row colors, `divide-y`, or `hover:bg-*` on the page. Cells only set padding (`px-4 py-3`, or `px-2` when dense) and alignment.
- Calendar or timeline grids (PM calendar, Gantt) keep their own cell colors and their horizontal scroller, but use `AppDataTablePanel` and the same gray header colors.

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
- Do not hand-build a `table` / `thead` with its own colors, or wrap a table in `DataPanel`. Use the table shell.
- Do not copy the transport toolbar into another module.
- Do not restyle a page you were not asked to change. The list, filter bar, title, or short form you are editing uses `ListFrame` and `PageHeader`.
