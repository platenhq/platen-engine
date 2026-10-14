# Platen Engine (`@platen/engine`)

[![npm version](https://img.shields.io/npm/v/@platen/engine.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@platen/engine)
[![license](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](./LICENSE)

**Multi-page pagination for native `contenteditable` editors.**
Wrap your editor in one component and its content flows across discrete paper sheets, with
page breaks between lines, including in the middle of a paragraph. The engine never touches
the editor's DOM or document model, so the caret, selection, IME, spellcheck, undo and
real-time collaboration keep working exactly as they did.

Built for Lexical; works with any editor that renders ordinary block elements.

---

## The name

On a letterpress or typewriter, the **platen** is the surface that presses paper against
type so every line lands at an exact position on the page.

---

## How it works

A paragraph is one box to the browser, so it cannot be split across two page elements
without splitting the document itself. Platen does not split anything. Instead:

1. Sheets are painted **behind** the editor as plain decorative boxes.
2. A zero-height **rail** sits just before the editor content. It holds one invisible,
   full-width float for every band between two printable areas (bottom margin + gutter +
   top margin).
3. A line of text cannot sit beside a full-width float, so the browser's own line layout
   moves each line that would land in such a band to the top of the next sheet.

The only thing the engine computes is how many sheets are needed, from the content height.
See [ARCHITECTURE.md](./ARCHITECTURE.md) for details.

---

## Installation

```bash
npm install @platen/engine
```

React 18 or 19 is a peer dependency.

---

## Usage

```tsx
import { PagedDesk, PagedDocument } from '@platen/engine';

export function WordProcessor() {
  return (
    <PagedDesk>
      <PagedDocument
        pageSize="letter" // 'letter' | 'a4' | 'legal' | { width, height }
        margins={{ top: 96, bottom: 96, left: 96, right: 96 }}
        deskGutter={20}
        zoom={1}
        renderFooter={({ pageNumber, totalPages }) => (
          <span>
            Page {pageNumber} of {totalPages}
          </span>
        )}
      >
        {/* Your editor, e.g. Lexical's <RichTextPlugin contentEditable={...} /> */}
        <MyEditor />
      </PagedDocument>
    </PagedDesk>
  );
}
```

### `PagedDocument` props

| Prop                           | Default                    | Purpose                                               |
| :----------------------------- | :------------------------- | :---------------------------------------------------- |
| `pageSize`                     | `'letter'`                 | Preset name or `{ width, height }` in CSS pixels      |
| `margins`                      | 96px on every side         | Page margins; any side may be omitted                 |
| `deskGutter`                   | `20`                       | Gap between sheets                                    |
| `zoom`                         | `1`                        | Scale factor; page breaks do not move when it changes |
| `contentSelector`              | `[contenteditable="true"]` | Element whose children are the top-level blocks       |
| `maxPages`                     | `1000`                     | Upper bound on rendered sheets                        |
| `renderHeader`, `renderFooter` |                            | Rendered in each sheet's top and bottom margin        |
| `sheetClassName`, `sheetStyle` |                            | Styling for each sheet                                |
| `onPageCountChange`            |                            | Called when the number of sheets changes              |
| `printIsolated`                | `true`                     | Print the document alone, hiding the rest of the page |

### Layout requirements

- Every element between `PagedDocument` and the editable element must be a plain block: no
  `overflow`, `contain`, `float`, absolute positioning, and not a flex or grid item. In
  development the engine logs a warning naming the offending element.
- The editable content should have no padding of its own; `PagedDocument` applies the page
  margins.

### Styling blocks

- A block that forms its own formatting context is moved to the next sheet whole. To make
  a block unbreakable (code blocks, callouts, image wrappers and anything else with a
  background or border), give it all three of:

  ```css
  display: flow-root;
  width: 100%;
  box-sizing: border-box;
  ```

  The explicit width is required. A `flow-root` block with automatic width that does not
  fit above a page boundary is squeezed to zero width instead of being moved, and its
  content disappears. Without `flow-root` at all, the block's box paints across the gap
  while its lines flow around it.

- `PagedDocument` exposes `--platen-usable-width` and `--platen-usable-height`. Use them to
  cap media: `img { max-height: var(--platen-usable-height); }`.

### Printing and PDF

`PagedDocument` ships its own print styles, and paper reproduces the screen: each sheet
becomes one printed page with the same line breaks, margins, headers and footers. Use the
print dialog's "Save as PDF" for a PDF.

- The paper is the size of a sheet, with no printer margin of its own. The sheet's margins
  are already part of the layout. In the print dialog, leave margins on "Default" and
  scale on 100%.
- Sheets print white without shadows, whatever theme is active. Text and other content
  print in the colours they have on screen, so a host with a dark theme should switch to
  its light theme while printing (for example on the `beforeprint` event).
- `printIsolated` (on by default) hides everything else on the page and removes clipping,
  padding and scrolling from the document's ancestors, so the first sheet starts exactly
  at the top of the first printed page. Printed pages only line up with sheets when that
  holds, so turn it off only if the host takes care of it.
- An unbreakable block taller than a page is cut at the page edge when printed.

### Lower-level API

`usePageFlow`, `PageBreakRail` and `PagedSheet` are exported for custom layouts, along with
the pure helpers `resolvePageGeometry`, `computePageCount`, `getSpacerSegments`,
`getSheetOffsets`, `getDocumentHeight` and `pageForOffset`.

---

## Page presets

| Preset   | Size at 96 DPI | Physical size |
| :------- | :------------- | :------------ |
| `letter` | 816 x 1056     | 8.5 x 11 in   |
| `a4`     | 794 x 1123     | 210 x 297 mm  |
| `legal`  | 816 x 1344     | 8.5 x 14 in   |

---

## Known limits

- An unbreakable block taller than a page (a very long table) runs across the gap between
  sheets. Row-level table splitting is not implemented yet.
- Widow and orphan control and repeated table headers are not implemented on screen yet.

---

## Development

```bash
npm test              # unit tests (Node)
npm run test:browser  # layout tests in headless Chromium
npm run typecheck
npm run build
npm run check:exports
```

The browser tests need Chromium once: `npx playwright install chromium`.

---

## License

[MIT](./LICENSE)
