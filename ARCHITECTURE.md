# Architecture

## The problem

Print pagination needs content to occupy fixed boxes with gaps between them. The browser
lays a document out as one continuous flow, and a paragraph is a single box that cannot be
rendered partly in one page element and partly in another.

The usual ways around this each cost something essential:

| Approach                               | What breaks                                            |
| :------------------------------------- | :----------------------------------------------------- |
| Split nodes into page containers       | Undo, caret position and real-time collaboration       |
| Push blocks down with injected margins | Cannot break inside a paragraph; prone to layout loops |
| Render text to canvas                  | Caret, selection, IME, spellcheck and accessibility    |
|                                        | must all be rebuilt by hand                            |

## The float rail

Platen keeps the editor as a single native `contenteditable` flow and changes only the
space that flow is allowed to occupy.

```txt
PagedDocument
├── sheets              absolutely positioned, decorative, behind the content
└── flow                one block formatting context, padded by the page margins
    ├── rail            height 0; holds the floats
    │   ├── strut       zero-width float, as tall as one printable area
    │   ├── spacer      full-width float, as tall as one dead zone
    │   ├── strut
    │   ├── spacer
    │   └── ...
    └── content         the editor
```

- A **dead zone** is the band between two printable areas: bottom margin + desk gutter +
  top margin.
- Each **spacer** is a float covering one dead zone. Line boxes may not overlap a float in
  their formatting context, and none fits beside a full-width one, so the browser places
  each line either above the spacer or below it. That is a page break between two lines.
- Each **strut** positions the next spacer. A top margin cannot be used for this, because a
  float's margin box excludes lines too.
- Blocks that form their own formatting context (tables, `flow-root` blocks) cannot overlap
  a float either, so they move below the spacer whole.

The rail is a sibling of the editor, not part of it. The editor's DOM and document model are
never read for content and never written.

## Page count

All vertical positions are measured from the top of the first printable area.

```txt
period    = usableHeight + deadZone
pageCount = max(1, ceil((contentHeight + deadZone) / period))
```

`contentHeight` is the height of the content wrapper, which already includes every dead
zone the content has been pushed across. One `ResizeObserver` on that wrapper recomputes the
count; state changes only when the result differs.

The count cannot oscillate: a spacer exists only once content has reached it, and adding a
spacer can only make the content taller.

The last sheet's bottom margin also carries a spacer. Content that grows into it is pushed
by the browser in the same frame, before the count updates and the next sheet appears.

## Oversized unbreakable blocks

A block that cannot flow around a spacer and is taller than a printable area would never
fit between two spacers, and would be pushed down forever. The hook finds such blocks among
the content's top-level children and leaves the parts of the dead zones they cover open, so
the block runs across the gap and pagination resumes after it.

## Empty lines

A line containing only a line break has no width, so it would fit beside a spacer. A scoped
style rule gives such lines a 1px inline box.

## Zoom

Zoom is a CSS transform on the stage, with the outer box sized to the scaled result. Layout
happens at 100%, so page breaks are identical at every zoom level.

## Modules

| Module                         | Role                                                 |
| :----------------------------- | :--------------------------------------------------- |
| `core/Geometry.ts`             | Page size presets and margin defaults                |
| `core/PageFlow.ts`             | Pure geometry: page count, spacers, sheet offsets    |
| `hooks/usePageFlow.ts`         | Observes content height, yields page count & spacers |
| `components/PageBreakRail.tsx` | Renders struts and spacers                           |
| `components/PagedSheet.tsx`    | One decorative sheet with header and footer slots    |
| `components/PagedDocument.tsx` | Composes sheets, rail, content and zoom              |
| `components/PagedDesk.tsx`     | Scrollable desk surface                              |

## Testing

Pure geometry is unit tested in Node. Layout behaviour is tested in headless Chromium,
because only a real layout engine can show where lines land: mid-paragraph breaks, a large
paste, empty lines, whole and oversized tables, re-render stability, content removal and
zoom.

## History

Earlier versions (up to 0.1.3) implemented a canvas pipeline with its own text measurement,
line breaking and synthetic caret. That design is preserved on the `archive/canvas-engine`
branch.
