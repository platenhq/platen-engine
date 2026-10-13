# Paged Engine Architecture Specification: Block-Aware Pagination & Dead-Zone Breaks

> **Target Repository**: `platenhq/platen-engine` (`@platen/engine`)  
> **Host Consumer**: `platenhq/platen` (`docs-editor`)  
> **Status**: APPROVED ARCHITECTURAL SPECIFICATION  
> **Goal**: Implement high-fidelity, block-aware multi-sheet pagination in `@platen/engine` that ensures content lives strictly within printable page sections, prevents atomic blocks (images, tables) from being sliced across margins or desk gutters, and preserves 100% of native host editor capabilities (typing, carets, resizable tables, interactive images, checklists, and Liveblocks collaboration).

---

## 1. Architectural Mandate & Root Problem

### The Anti-Pattern to Eliminate

In initial hybrid attempts, the host editor rendered `PagedSheet` components as empty visual cards in the background with `pointer-events-none`, and floated the host editor's entire continuous `<ContentEditable>` DOM in a single `absolute top-0` overlay.

This caused severe layout defects:

1. **The content did not live inside the pages**: It was a standard single-page webpage dumping text across page boundaries.
2. **Atomic blocks were sliced in half**: When an image or table straddled the boundary between Page 1 and Page 2, it was cut directly through the 96px bottom margin of Page 1, the 20px physical desk gutter, and the 96px top margin of Page 2.
3. **Headers and footers were obstructed**: Content bled directly over "Page 1 of N" and "Platen Document | Draft".

### The Microsoft Word Online Blueprint

In Microsoft Word Online:

- Content is strictly constrained to the printable section of each page card (`usableWidth × usableHeight`).
- When an atomic block (image, callout, table row) cannot fit in the remaining height of Page $N$, it does not get sliced across margins and gutters; it is pushed in its entirety to the top of Page $N+1$.
- Dead zones between pages (Bottom Margin + Desk Gutter + Top Margin) are strictly respected.

---

## 2. Geometry & Dead-Zone Mathematics

For a standard Letter document at standard 96 DPI:

| Dimension                            | Calculation                                                     | Value              |
| :----------------------------------- | :-------------------------------------------------------------- | :----------------- |
| **Page Width**                       | Fixed CSS pixels                                                | $816\text{px}$     |
| **Page Height**                      | Fixed CSS pixels                                                | $1056\text{px}$    |
| **Top Margin (`paddingY`)**          | Standard 1 inch                                                 | $96\text{px}$      |
| **Bottom Margin (`paddingY`)**       | Standard 1 inch                                                 | $96\text{px}$      |
| **Left / Right Margin (`paddingX`)** | Standard 1 inch                                                 | $96\text{px}$      |
| **Usable Width**                     | $816 - 96 \times 2$                                             | $624\text{px}$     |
| **Usable Height**                    | $1056 - 96 \times 2$                                            | $864\text{px}$     |
| **Desk Gutter**                      | Space between paper cards                                       | $20\text{px}$      |
| **Inter-Page Dead Zone**             | $\text{Margin Bottom} + \text{Desk Gutter} + \text{Margin Top}$ | **$212\text{px}$** |

### Page Section Coordinate Offsets

Each page's usable content area begins at a specific vertical offset down the desk:

- **Page 1 Usable Top**: $y = 0\text{px}$ (relative to content layer start)
- **Page 1 Usable Bottom**: $y = 864\text{px}$
- **Inter-Page Dead Zone**: $y \in [864\text{px}, 1076\text{px}]$ (Margin Bottom 96px + Gutter 20px + Margin Top 96px = 212px)
- **Page 2 Usable Top**: $y = 1076\text{px}$ ($864\text{px} + 212\text{px}$)
- **Page 2 Usable Bottom**: $y = 1940\text{px}$ ($1076\text{px} + 864\text{px}$)
- **Page $N$ Usable Top**: $(N - 1) \times (\text{usableHeight} + \text{deadZone})$

#### The Spacer Bridging Equation (Why `deadZoneSpacer` is NOT a constant 212px)

When an overflowing block is pushed from Page $N$ to Page $N+1$, injecting **only** the `deadZone` ($212\text{px}$) causes it to land inside Page $N+1$'s header zone because it ignores the unused space at the bottom of Page $N$!

**Concrete Example**:

- Page 1 contains blocks totaling $659\text{px}$.
- Remaining unused space at bottom of Page 1: $864\text{px} - 659\text{px} = 205\text{px}$.
- **Flawed approach (`deadZone` only = 212px)**: Block starts at $659 + 212 = 871\text{px}$. Because Page 2's printable area starts at $1076\text{px}$, $871\text{px}$ lands directly in Page 2's header zone, covering header text.
- **Correct approach (`remaining + deadZone`)**:
  $$\text{deadZoneSpacer} = (864\text{px} - 659\text{px}) + 212\text{px} = 205\text{px} + 212\text{px} = 417\text{px}$$
  Block starts at $659 + 417 = 1076\text{px}$ — landing pixel-perfect on Page 2's first printable pixel!

---

## 3. Required Deliverables for `@platen/engine`

### Module 1: Block-Aware Break Solver (`src/layout/BlockPagination.ts`)

Export a pure function that calculates page breaks based on actual block bounding boxes:

```ts
export interface BlockLayoutOptions {
  pageHeight: number; // e.g. 1056
  pageWidth: number; // e.g. 816
  margins: {
    top: number; // e.g. 96
    bottom: number; // e.g. 96
    left: number; // e.g. 96
    right: number; // e.g. 96
  };
  deskGutter: number; // e.g. 20
}

export interface BlockBreakItem {
  index: number; // Index of top-level child element
  elementId?: string; // ID or data-key if present
  deadZoneSpacer: number; // (usableHeight - currentAccumulatedHeight) + deadZone
  targetPage: number; // The page this block moves to (e.g. 2)
}

export interface BlockPaginationResult {
  pageCount: number;
  breaks: BlockBreakItem[];
  usableHeight: number;
  deadZone: number;
}

export function calculateBlockBreaks(
  blockHeights: number[],
  options: BlockLayoutOptions
): BlockPaginationResult;
```

#### Solver Algorithm Requirements:

1. Initialize `currentPage = 1`, `currentAccumulatedHeight = 0`.
   - Calculate `usableHeight = options.pageHeight - (options.margins.top + options.margins.bottom)`.
   - Calculate `deadZone = options.margins.bottom + options.deskGutter + options.margins.top`.
2. For each block `i` with height `H`:
   - If `currentAccumulatedHeight + H <= usableHeight`:
     - Block fits on `currentPage`.
     - `currentAccumulatedHeight += H`.
   - If `currentAccumulatedHeight + H > usableHeight`:
     - If `currentAccumulatedHeight > 0`:
       - Block overflows current page!
       - **CRITICAL ARITHMETIC FORMULA**: Calculate the unused space remaining at the bottom of the current page:
         `const remainingOnCurrentPage = usableHeight - currentAccumulatedHeight;`
       - Calculate total spacer to reach the start of the next page's printable area:
         `const deadZoneSpacer = remainingOnCurrentPage + deadZone;`
       - Push a `BlockBreakItem`:
         `{ index: i, deadZoneSpacer, targetPage: currentPage + 1 }`
       - Advance `currentPage += 1`.
       - Reset `currentAccumulatedHeight = H`.
     - If `currentAccumulatedHeight === 0` (single atomic block is taller than `usableHeight`):
       - The block takes the entire page, and excess flows to next page.
3. Total `pageCount = currentPage`.

---

### Module 2: DOM Break Coordinator Hook (`src/hooks/useBlockPagination.ts`)

Provide a React hook for host editors that automatically measures children and applies non-destructive spacer styling:

```tsx
export interface UseBlockPaginationOptions extends BlockLayoutOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  debounceMs?: number; // default 30ms
  enabled?: boolean; // default true
}

export function useBlockPagination(options: UseBlockPaginationOptions): {
  pageCount: number;
  breaks: BlockBreakItem[];
  applySpacers: () => void;
  clearSpacers: () => void;
};
```

#### Hook Behavior:

1. Measures the top-level block children of `containerRef` using `ResizeObserver` or `getBoundingClientRect()`.
2. Computes `BlockPaginationResult` using `calculateBlockBreaks`.
3. Sets `data-page-break-spacer="true"` and `style.marginTop = `${item.deadZoneSpacer}px`` on the specific child elements that need to break to the next page.
4. On unmount or when `enabled === false` (switching to continuous pageless mode), `clearSpacers()` removes all injected `marginTop` and restored natural DOM layout.

---

### Module 3: Native `PagedSheet` Usable Section Bounds

Ensure `PagedSheet` continues to render:

1. Physical paper card (`actualWidth × actualHeight`, shadow, border, background color).
2. Header zone: height `margins.top`, strictly contained.
3. Usable Section: `top: margins.top, left: margins.left, width: usableWidth, height: usableHeight`.
4. Footer zone: height `margins.bottom`, strictly contained.
5. If `children` is provided to `PagedSheet`, it mounts inside the `Section`. If `children` is hoisted over the deck via the coordinator hook, the paper deck aligns 1:1 with the computed `pageCount` and `deskGutter`.

---

## 4. Verification Test Cases for `@platen/engine`

The engine repository must add and pass the following tests in `tests/block-pagination.test.ts`:

1. **Single Page Fit**:
   - 3 blocks of height $200\text{px}$ each ($600\text{px}$ total).
   - Usable height $864\text{px}$.
   - Result: `pageCount: 1`, `breaks: []`.

2. **Atomic Image Overflow**:
   - Block 1 (Text): $500\text{px}$
   - Block 2 (Image): $400\text{px}$
   - Usable height: $864\text{px}$
   - Remaining on Page 1: $864 - 500 = 364\text{px}$
   - Dead zone: $212\text{px}$
   - Total spacer to reach Page 2 top: $364 + 212 = 576\text{px}$
   - Result:
     - Block 2 breaks to Page 2.
     - `breaks`: `[{ index: 1, deadZoneSpacer: 576, targetPage: 2 }]`.
     - `pageCount: 2`.

3. **Multi-Page Cascade**:
   - 10 blocks of height $300\text{px}$ each.
   - Usable height: $864\text{px}$.
   - Each page fits 2 blocks ($600\text{px}$ total).
   - Remaining unused space per page: $864 - 600 = 264\text{px}$.
   - Spacer per page break: $264 + 212 = 476\text{px}$.
   - Result: Accurately breaks into pages of 2 blocks each, resulting in `pageCount: 5` and 4 break items at indices `2, 4, 6, 8` each with `deadZoneSpacer: 476`.

4. **Zero-Side-Effect Teardown**:
   - Verifies that calling `clearSpacers()` resets all inline styles.

---

## 5. Build and Export Requirements

1. Export `calculateBlockBreaks`, `useBlockPagination`, `PagedSheet`, and `PagedDesk` in `src/index.ts`.
2. Run `npm test`: all test suites must pass.
3. Run `npm run build`: compile clean TypeScript types (`dist/index.d.ts`) and ESM/CJS bundles (`dist/index.js`, `dist/index.mjs`) with 0 errors.
