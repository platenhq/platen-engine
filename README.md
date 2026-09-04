# Platen Engine (`@platen/engine`)

[![npm version](https://img.shields.io/npm/v/@platen/engine.svg?style=flat-square&color=blue)](https://www.npmjs.com/package/@platen/engine)
[![license](https://img.shields.io/badge/license-MIT-green.svg?style=flat-square)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![CI Status](https://img.shields.io/badge/CI-Passing-brightgreen?style=flat-square)](https://github.com/platenhq/platen-engine/actions)
[![Architecture](https://img.shields.io/badge/Architecture-Hybrid%20Micro--Canvas-orange?style=flat-square)](./ARCHITECTURE.md)

**A high-performance, framework-agnostic hybrid micro-canvas pagination engine for web editors.**  
Brings desktop-grade multi-page continuous pagination, deterministic line breaking, and subpixel typesetting to the browser without DOM flickering or collaborative CRDT mutation loops.

[Quick Start](#quick-start) • [The Architecture](#the-architecture) • [Why Platen?](#why-platen) • [Usage Examples](#core-usage-examples) • [Roadmap](#roadmap)

---

## The Name & Heritage

In traditional letterpress and mechanical typewriters, the **platen** is the precision-machined steel bed or cylindrical roller that presses the paper directly against inked movable type. It guarantees that every glyph strikes the page with uniform pressure, crisp geometry, and exact millimeter margins.

**Platen Engine** brings that same mechanical exactness to the modern web word processor.

---

## Why Platen?

Building a true, multi-page paginated document editor on the web is notoriously one of the hardest engineering problems in frontend software. The two historic approaches have fatal trade-offs:

```txt
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             THE PAGINATION TRILEMMA                              │
├──────────────────────────┬──────────────────────────┬────────────────────────────┤
│ Naive DOM Splitting      │ Monolithic Canvas        │ Platen Hybrid Micro-Canvas │
├──────────────────────────┼──────────────────────────┼────────────────────────────┤
│ • Violent DOM flickering │ • 100% custom input code │ • Zero DOM layout reflows  │
│ • Cascading reflow loops │ • Breaks IME composition │ • Native IME & mobile keys │
│ • Destroys CRDT & Undo   │ • Inaccessible to NVDA   │ • Native screen reader nav │
│ • Inconsistent fonts     │ • Giant GPU memory hog   │ • Zero CRDT mutation loops │
└──────────────────────────┴──────────────────────────┴────────────────────────────┘
```

1. **The DOM Reflow Paradox**: Browsers treat HTML elements as continuous flowing boxes. Slicing paragraphs across DOM containers during typing forces layout reflows (the _Cascading Sibling Shift_), triggering 60Hz flickering oscillations and breaking collaborative sync engines like Yjs or Liveblocks.
2. **The Monolithic Canvas Trap**: Rendering an entire multi-page document onto a single giant HTML5 Canvas (the Google Docs approach) requires rewriting caret blinking, mouse selection, virtual keyboards, Asian language IME (Input Method Editor), and accessibility from scratch in WebAssembly/C++.
3. **The Platen Solution (The Microsoft Word Online Model)**: Slices paragraphs into discrete **Micro-Canvas Track Items** positioned absolutely inside isolated physical sheet containers. CSS containment (`contain: strict;`) guarantees that typing on Page 1 can never trigger reflows on Page 2.

---

## The Architecture

Platen operates across a **6-Layer Hybrid Architecture**:

```txt
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PLATEN ENGINE 6-LAYER SYSTEM STACK                        │
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 1: Input & IME Capture Proxy                                          │
│  Transparent floating contenteditable element tracking the subpixel caret.   │
│  Captures native keystrokes, Japanese/Chinese/Korean IME, and mobile dictation│
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 2: Offscreen Metric Harness                                           │
│  Deterministic line-breaking solver using OffscreenCanvas and LRU kerning.   │
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 3: Clipboard Proxy Bridge                                             │
│  Intercepts copy/paste to transfer rich HTML, RTF, and plain text.           │
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 4: Accessibility Shadow Mirror                                        │
│  Hidden semantic HTML nodes (<p hidden paraid="...">) ensuring NVDA, JAWS,   │
│  and VoiceOver read headings, lists, and tables seamlessly.                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 5: Discrete Page Sheets & Micro-Canvas Tracks                         │
│  Physical page cards (Letter, A4) with strict CSS containment.               │
│  Each paragraph track item renders to its own isolated micro-canvas.         │
├──────────────────────────────────────────────────────────────────────────────┤
│  Layer 6: Page Adornment System                                              │
│  Pluggable header, footer, margin, and dynamic page numbering slots.         │
└──────────────────────────────────────────────────────────────────────────────┘
```

For the full architectural whitepaper, see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Quick Start

### Installation

```bash
npm install @platen/engine
```

> **Note**: `@platen/engine` is completely framework-agnostic. Optional React components and rich-text editor adapters (Meta Lexical, ProseMirror) are bundled with zero mandatory peer dependencies.

---

## Core Usage Examples

### 1. Headless Layout Slicing (Pure TypeScript)

Use the headless engine to compute deterministic page slices, line breaks, and paragraph tracks without mounting any DOM elements:

```typescript
import {
  LayoutSlicer,
  LineBreaker,
  MetricEngine,
  PAGE_SIZES,
  MARGIN_PRESETS,
  ParagraphBlock,
} from '@platen/engine';

// 1. Initialize metric harness and layout slicer
const metricEngine = new MetricEngine();
const lineBreaker = new LineBreaker(metricEngine);
const slicer = new LayoutSlicer({
  pageSize: PAGE_SIZES.LETTER, // 816 x 1056 px (96 DPI)
  margins: MARGIN_PRESETS.NORMAL, // 96px on all sides
  preventWidowsAndOrphans: true,
});

// 2. Define semantic paragraph blocks
const blocks: ParagraphBlock[] = [
  {
    id: 'para_1',
    runs: [
      { text: 'Platen Engine: ', style: { bold: true, fontSize: 18 } },
      {
        text: 'Deterministic continuous multi-page pagination for the web.',
        style: { fontSize: 16 },
      },
    ],
  },
];

// 3. Compute physical page slices
const pages = slicer.slice(blocks);

console.log(`Generated ${pages.length} physical page(s)`);
pages.forEach((page) => {
  console.log(`Page ${page.pageNumber}: ${page.tracks.length} paragraph track(s)`);
});
```

---

### 2. Rendering Multi-Page Sheets in React

Render discrete physical sheets inside an auto-centering desk container with CSS containment:

```tsx
import React from 'react';
import { PagedDesk, PagedSheet, PageSlice } from '@platen/engine';

interface DocumentViewerProps {
  pages: PageSlice[];
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ pages }) => {
  return (
    <PagedDesk zoom={1.0} deskBackground="#e5e7eb" deskGutter={24}>
      {pages.map((page) => (
        <PagedSheet
          key={page.pageNumber}
          page={page}
          renderHeader={(p) => (
            <div className="flex justify-between text-xs text-gray-400">
              <span>CONFIDENTIAL</span>
              <span>Section 1</span>
            </div>
          )}
          renderFooter={(p) => (
            <div className="text-center text-xs text-gray-400">
              Page {p.pageNumber} of {pages.length}
            </div>
          )}
        />
      ))}
    </PagedDesk>
  );
};
```

---

### 3. Reactive Lexical Integration

Connect Platen reactively to a **Meta Lexical** editor state with automatic `requestAnimationFrame` debouncing:

```typescript
import { LexicalEditor } from 'lexical';
import {
  LexicalAdapter,
  PagedEngineBridge,
  PAGE_SIZES,
  MARGIN_PRESETS,
  PageSlice,
} from '@platen/engine';

export function setupPagedLexical(
  editor: LexicalEditor,
  onPagesChange: (pages: PageSlice[]) => void
) {
  // 1. Initialize the Lexical AST adapter
  const adapter = new LexicalAdapter({
    defaultFontFamily: 'Inter, sans-serif',
    defaultFontSize: 16,
    defaultLineHeight: 24,
  });

  // 2. Initialize the reactive layout bridge
  const bridge = new PagedEngineBridge({
    adapter,
    pageSize: PAGE_SIZES.LETTER,
    margins: MARGIN_PRESETS.NORMAL,
  });

  // 3. Subscribe to multi-page layout recalculations
  const unsubscribeLayout = bridge.onLayoutChange((pages) => {
    onPagesChange(pages);
  });

  // 4. Attach reactive listener to Lexical editor mutations
  const detachEditor = bridge.attach(editor);

  return () => {
    unsubscribeLayout();
    detachEditor();
    bridge.destroy();
  };
}
```

---

### 4. Reactive ProseMirror / TipTap Integration

Connect Platen directly to **ProseMirror** documents:

```typescript
import { EditorState } from 'prosemirror-state';
import { ProseMirrorAdapter, LayoutSlicer, PAGE_SIZES, MARGIN_PRESETS } from '@platen/engine';

const adapter = new ProseMirrorAdapter();
const slicer = new LayoutSlicer({
  pageSize: PAGE_SIZES.A4,
  margins: MARGIN_PRESETS.MODERATE,
});

// Extract semantic paragraph blocks from ProseMirror doc
const blocks = adapter.extractParagraphBlocks(editorState.doc);

// Slice into multi-page layout
const pages = slicer.slice(blocks);
```

---

## Supported Page Geometries & Presets

Platen exports industry-standard paper formats ($96\text{ DPI}$ screen metrics):

| Paper Size | Width ($\text{px}$) | Height ($\text{px}$) | Dimensions ($\text{in} / \text{mm}$) |
| :--------- | :------------------ | :------------------- | :----------------------------------- |
| `LETTER`   | $816\text{px}$      | $1056\text{px}$      | $8.5 \times 11.0\text{ in}$          |
| `A4`       | $794\text{px}$      | $1123\text{px}$      | $210 \times 297\text{ mm}$           |
| `LEGAL`    | $816\text{px}$      | $1344\text{px}$      | $8.5 \times 14.0\text{ in}$          |

### Standard Margin Presets

- `NORMAL`: $96\text{px}$ ($1.0\text{ in}$) top, bottom, left, right.
- `NARROW`: $48\text{px}$ ($0.5\text{ in}$) top, bottom, left, right.
- `MODERATE`: Top/bottom $96\text{px}$ ($1.0\text{ in}$), left/right $72\text{px}$ ($0.75\text{ in}$).
- `WIDE`: Top/bottom $96\text{px}$ ($1.0\text{ in}$), left/right $192\text{px}$ ($2.0\text{ in}$).

---

## Verification & Quality Assurance

Platen Engine maintains strict verification standards:

- **100% Type Export Integrity**: Verified via `@arethetypeswrong/cli` across all modern module resolutions (`node10`, `node16-cjs`, `node16-esm`, `bundler`).
- **Zero Package Bloat**: Zero mandatory runtime dependencies; peer dependencies (`react`, `react-dom`) are optional.
- **Dual Bundle Distribution**: Pre-compiled CJS (`dist/index.js`) and ESM (`dist/index.mjs`) with `.d.ts` declaration maps generated via `tsup`.
- **Unit Test Coverage**: Automated test suites covering line breaking, coordinate positioning, micro-canvas rendering, selection overlays, and framework AST adapters.

```bash
# Run unit tests
npm test

# Type check
npm run typecheck

# Check export compatibility
npm run check:exports
```

---

## Roadmap

- [x] Sprint 1: Headless Layout Slicer & Deterministic Line Breaker
- [x] Sprint 2: Micro-Canvas Track System & Screen-Reader Shadow Mirrors
- [x] Sprint 3: Subpixel Caret Coordinate Solver & Cross-Sheet Selection Overlay
- [x] Sprint 4: Universal Meta Lexical & ProseMirror Framework Adapters
- [ ] Phase 5: Multi-page table row splitting with repeated header rows
- [ ] Phase 6: Interactive WYSIWYG Header & Footer Margin Adornments
- [ ] Phase 7: Dynamic Footnote & Sidenote Partitioning Solver
- [ ] Phase 8: Vector Print & Headless PDF Exporter

Read the complete engineering roadmap in [Section 12 of ARCHITECTURE.md](./ARCHITECTURE.md#12-advanced-roadmap--future-engineering-horizons).

---

## License

Licensed under the [MIT License](./LICENSE).
Copyright © 2026 Platen Authors (Trayshmhirk).
