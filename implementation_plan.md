# Implementation Plan: Float-Rail Pagination for `@platen/engine`

Status: awaiting approval. Nothing has been changed yet.

## 1. Goal

A working package that paginates a native `contenteditable` editor (Lexical first) into
discrete sheets, with page breaks that fall **between lines**, including in the middle of a
paragraph, and that stays correct when a whole document is pasted in.

## 2. The change of approach

The current hook (`useBlockPagination`) writes a `margin-top` onto each block that crosses a
page boundary. That can only ever move whole blocks, so it can never break mid-paragraph.

This plan replaces it with a **float rail**:

- A zero-height element (the rail) sits immediately before the editor root, in the same
  block formatting context.
- The rail holds one full-width floated spacer per page boundary. Each spacer is as tall as
  the dead zone (bottom margin + desk gutter + top margin) and starts where a page's
  printable area ends.
- A line of text cannot sit beside a full-width float, so the browser itself moves each line
  that would land in the dead zone to the top of the next page.

What this gives us:

- **Mid-paragraph breaks**, done by the browser's own line layout. No text measurement.
- **Atomic blocks for free**: tables, images and anything that forms its own formatting
  context are moved whole.
- **No writes to editor-owned DOM.** The rail is a sibling of the editor root, so Lexical's
  reconciler and Liveblocks never see it. Caret, selection, IME and spellcheck stay native.
- **Paste-proof.** Layout is a pure function of content; a 50-page paste is one browser
  layout pass plus one page-count update.

The only state the engine computes is the page count:

```txt
period    = usableHeight + deadZone
pageCount = max(1, ceil((contentHeight + deadZone) / period))
spacers   = pageCount - 1
```

A spacer is only added once content crosses its boundary, and adding it can only make the
content taller, so the count cannot oscillate.

### Confidence and known limits

- The technique is established prior art (float-based pagination plugins exist for
  ProseMirror/Tiptap). It has **not yet been run against this Lexical setup**; step 2 below
  is a browser test that proves or disproves it before anything else is built on it.
- Requirement on the host: no element between the rail and the editor root may create a new
  formatting context (no flex/grid item, `overflow`, `contain`, `flow-root`). The package
  will check this in development and warn.
- A paragraph's own background or border spans the gap, because only its lines move. Blocks
  with a visible box (code blocks, callouts) should be marked atomic via a documented class.
- Widow/orphan control and repeated table headers are not part of this plan. Both are
  possible later on top of the same rail.
- A single unbreakable block taller than a page (a huge image) still overflows; it will be
  capped to the printable height.

## 3. Steps

### Step 0 — Preserve the current work (needs your call, see section 6)

The working tree holds about 900 lines of uncommitted canvas work plus untracked files.
Before deleting anything, snapshot it on a branch `archive/canvas-engine` so it is
recoverable.

### Step 1 — Pure layout math

`src/core/PageFlow.ts` (new)

- `resolvePageGeometry(options)`: page size preset or explicit size, margins, gutter →
  `{ width, height, margins, usableWidth, usableHeight, deadZone, period }`. Reuses the
  presets in `src/core/Geometry.ts`; this becomes the only geometry type.
- `computePageCount(contentHeight, geometry)`.
- `getSpacerOffsets(pageCount, geometry)` and `getSheetOffsets(pageCount, geometry)`.
- `pageForOffset(y, geometry)` for callers that need "which page is the caret on".

`tests/page-flow.test.ts` (new): boundaries at 864 / 865 / 1076, counts for 1, 2 and 10
pages, A4 and custom margins, zero and negative input.

### Step 2 — Rail, hook and components

- `src/components/PageBreakRail.tsx` (new): the zero-height rail and its floated spacers.
- `src/hooks/usePageFlow.ts` (new): observes the editor root with one `ResizeObserver`,
  returns `{ pageCount, geometry }`. Depends on primitive values only, and does not set
  state when the count is unchanged.
- `src/components/PagedDocument.tsx` (new): the drop-in wrapper. Renders the sheet
  backgrounds, the rail, and `children` (the editor) padded to the printable area. Accepts
  `zoom`, `renderHeader`, `renderFooter`.
- `src/components/PagedSheet.tsx` (rewrite): a decorative sheet only (size, shadow, header
  and footer slots, print rules). All canvas track rendering is removed.
- `src/components/PagedDesk.tsx` (simplify): desk background and scroll container only.

Browser test (new, Vitest browser mode with Playwright/Chromium):

- A paragraph crossing the first boundary has lines on both sheets and none in the dead zone.
- A table that does not fit moves whole.
- Pasting 30 pages of text yields the right page count and no line in any dead zone.
- Re-rendering the host with fresh prop objects does not change layout (the loop bug).
- Deleting content removes sheets.

### Step 3 — Clean up

Delete (all canvas-pipeline or superseded code):

- `src/renderer/` (MicroCanvas, SyntheticCaret, SelectionOverlay, AccessibilityMesh)
- `src/proxy/` (InputProxy, ClipboardProxy, WACEditingElement)
- `src/adapters/` (PagedEngineBridge, LexicalAdapter, ProseMirrorAdapter, Types)
- `src/core/`: LayoutSlicer, LineBreaker, MetricEngine, CaretPositioner, SelectionTypes,
  PaginationMetrics, and the track/slice types in Types.ts
- `src/layout/BlockPagination.ts`, `src/hooks/useBlockPagination.ts`
- Their tests: caret-positioner, layout-slicer, lexical-adapter, line-breaker, micro-canvas,
  paged-engine-bridge, prosemirror-adapter, selection, block-pagination, pagination-metrics
- `PAGED_ENGINE_SPECIFICATION.md` (untracked duplicate of the whitepaper)

Keep and update: `src/core/Geometry.ts`, `src/index.ts`, `README.md`, `ARCHITECTURE.md`,
`package.json` (description and keywords no longer say "micro-canvas").

Resulting public API:

```ts
export { PagedDocument, PagedDesk, PagedSheet, PageBreakRail } from './components/...';
export { usePageFlow } from './hooks/usePageFlow';
export { resolvePageGeometry, computePageCount, pageForOffset } from './core/PageFlow';
export { PAGE_SIZES, DEFAULT_PAGE_MARGINS } from './core/Geometry';
```

This removes exports that shipped in 0.1.3, so it is a breaking release.

### Step 4 — Verify

- `npm test`, `npm run typecheck`, `npm run format:check`, `npm run build`,
  `npm run check:exports`.
- Report results as they are, including any failure.

### Step 5 — Hand-off note

A short write-up for the docs-editor agent: what changed, the new API, and the exact
integration steps (replace `PlatenEngineCanvas` internals with `PagedDocument`, delete
`PagedEditorPlugin`'s bridge and spacer code, remove the `EditorShell` page-count effect in
paged mode).

## 4. New dev dependencies

`@vitest/browser`, `playwright` (Chromium only), for the layout tests in step 2. jsdom
cannot test this because it does not perform layout.

## 5. Out of scope

- Changes inside `docs-editor` (covered by the hand-off note).
- Widows/orphans, repeated table headers, headers/footers with live fields, print/PDF export.
- Publishing a release.

## 6. Decisions needed

1. **Approve the float-rail approach** in place of fixing the margin-injection hook.
2. **Step 0**: may I create `archive/canvas-engine` and commit the current working tree
   there before deleting? Without it, the uncommitted canvas work is lost for good.
3. **Depth of cleanup**: delete the whole canvas pipeline as listed, or keep it in the repo
   unexported?
