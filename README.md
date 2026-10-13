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

### Layout requirements

- Every element between `PagedDocument` and the editable element must be a plain block: no
  `overflow`, `contain`, `float`, absolute positioning, and not a flex or grid item. In
  development the engine logs a warning naming the offending element.
- The editable content should have no padding of its own; `PagedDocument` applies the page
  margins.

### Styling blocks

- A block that forms its own formatting context (a table, or anything with
  `display: flow-root`) is moved to the next sheet whole. Give code blocks, callouts and
  other blocks with a background or border `display: flow-root`, otherwise their box paints
  across the gap while their lines flow around it.
- `PagedDocument` exposes `--platen-usable-width` and `--platen-usable-height`. Use them to
  cap media: `img { max-height: var(--platen-usable-height); }`.

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
- Widow and orphan control, repeated table headers and print/PDF output are not
  implemented yet.

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
