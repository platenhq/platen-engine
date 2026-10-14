import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { commands } from 'vitest/browser';
import { PagedDocument, PagedDocumentProps } from '../../src/components/PagedDocument';
import { PageFlowOptions, pageForOffset, resolvePageGeometry } from '../../src/core/PageFlow';

declare module 'vitest/browser' {
  interface BrowserCommands {
    printToPdf: () => Promise<{ pages: string[]; size: { width: number; height: number } }>;
  }
}

/** Numbered words, so any word identifies its position in the document. */
function numberedWords(from: number, count: number): string {
  return Array.from({ length: count }, (_, i) => `w${from + i}`).join(' ');
}

/** Paragraphs of varying length holding `total` numbered words between them. */
function paragraphs(total: number): React.ReactNode {
  const nodes: React.ReactNode[] = [];
  for (let from = 0, index = 0; from < total; index++) {
    const count = Math.min(total - from, 20 + (index % 6) * 35);
    nodes.push(
      <p key={index} style={{ margin: '0 0 8px' }}>
        {numberedWords(from, count)}
      </p>
    );
    from += count;
  }
  return nodes;
}

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function render(
  content: React.ReactNode,
  props: Partial<PagedDocumentProps> = {},
  wrap: (doc: React.ReactElement) => React.ReactElement = (doc) => doc
): void {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  root.render(
    wrap(
      <PagedDocument
        renderFooter={({ pageNumber, totalPages }) => (
          <span>
            Sheet {pageNumber} of {totalPages}
          </span>
        )}
        {...props}
      >
        <div
          contentEditable
          suppressContentEditableWarning
          style={{ font: '16px/24px Arial, sans-serif' }}
        >
          {content}
        </div>
      </PagedDocument>
    )
  );
}

/** An application shell: a toolbar above a fixed-height, clipped, padded, scrolling viewport. */
const appShell = (doc: React.ReactElement) => (
  <div style={{ display: 'flex', flexDirection: 'column', height: 400, overflow: 'hidden' }}>
    <div style={{ height: 60, background: '#ccc' }}>toolbar</div>
    <div style={{ flex: 1, overflow: 'auto', padding: 32, background: '#111' }}>{doc}</div>
  </div>
);

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

async function settle(): Promise<number> {
  let stable = 0;
  let last = -1;
  while (stable < 6) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const count = document.querySelectorAll('.PagedSheet').length;
    stable = count === last ? stable + 1 : 0;
    last = count;
  }
  return last;
}

/** The first and last numbered word on each screen sheet. */
function screenPages(options: PageFlowOptions = {}, scale = 1): [number, number][] {
  const geometry = resolvePageGeometry(options);
  const flow = document.querySelector('.PagedDocumentContent')!;
  const origin = flow.getBoundingClientRect().top;
  const pages: [number, number][] = [];
  const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
  const range = document.createRange();

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    for (const match of node.data.matchAll(/w(\d+)/g)) {
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      const top = (range.getBoundingClientRect().top - origin) / scale;
      const page = pageForOffset(top, geometry).pageNumber - 1;
      const word = Number(match[1]);
      pages[page] = pages[page] ? [pages[page][0], word] : [word, word];
    }
  }
  return pages;
}

/** The first and last numbered word on each printed page. */
function printedPages(pages: string[]): [number, number][] {
  return pages.map((text) => {
    const found = Array.from(text.matchAll(/w(\d+)/g), (match) => Number(match[1]));
    return [found[0], found[found.length - 1]];
  });
}

describe('PagedDocument printing', () => {
  it('prints each sheet as one page with the same words on it', async () => {
    render(<p style={{ margin: 0 }}>{numberedWords(0, 2500)}</p>);
    const sheets = await settle();
    const pdf = await commands.printToPdf();

    expect(sheets).toBeGreaterThanOrEqual(4);
    // 816 x 1056 CSS pixels is 612 x 792 PDF points.
    expect(pdf.size).toEqual({ width: 612, height: 792 });
    expect(pdf.pages).toHaveLength(sheets);
    expect(printedPages(pdf.pages)).toEqual(screenPages());
  });

  it('keeps page breaks across many paragraphs', async () => {
    render(paragraphs(6000));
    const sheets = await settle();
    const pdf = await commands.printToPdf();

    expect(sheets).toBeGreaterThanOrEqual(8);
    expect(printedPages(pdf.pages)).toEqual(screenPages());
  });

  it('keeps page breaks on A4 with custom margins, whatever the zoom', async () => {
    const options: PageFlowOptions = {
      pageSize: 'a4',
      margins: { top: 48, bottom: 72, left: 144, right: 72 },
      deskGutter: 36,
    };
    render(paragraphs(4000), { ...options, zoom: 0.5 });
    await settle();
    const pdf = await commands.printToPdf();

    expect(pdf.size.width).toBeCloseTo(595.5, 0);
    expect(pdf.size.height).toBeCloseTo(842.25, 0);
    expect(printedPages(pdf.pages)).toEqual(screenPages(options, 0.5));
  });

  it('prints each sheet footer on its own page', async () => {
    render(paragraphs(3000));
    const sheets = await settle();
    const pdf = await commands.printToPdf();

    pdf.pages.forEach((text, index) => {
      expect(text).toContain(`Sheet ${index + 1} of ${sheets}`);
    });
  });

  it('prints only the document from inside a clipped application shell', async () => {
    render(paragraphs(3000), {}, appShell);
    const sheets = await settle();
    const pdf = await commands.printToPdf();

    expect(pdf.pages).toHaveLength(sheets);
    expect(printedPages(pdf.pages)).toEqual(screenPages());
    expect(pdf.pages.join(' ')).not.toContain('toolbar');
  });

  it('prints a short document on a single page', async () => {
    render(<p style={{ margin: 0 }}>{numberedWords(0, 40)}</p>);
    await settle();
    expect((await commands.printToPdf()).pages).toHaveLength(1);
  });
});
