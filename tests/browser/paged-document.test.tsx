import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { PagedDocument, PagedDocumentProps } from '../../src/components/PagedDocument';
import { pageForOffset, resolvePageGeometry } from '../../src/core/PageFlow';

const letter = resolvePageGeometry();
const WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor'.split(
  ' '
);

function words(count: number): string {
  return Array.from({ length: count }, (_, i) => WORDS[i % WORDS.length]).join(' ');
}

const editorStyle: React.CSSProperties = {
  font: '16px/24px Arial, sans-serif',
  outline: 'none',
};
const paragraphStyle: React.CSSProperties = { margin: '0 0 8px' };

let host: HTMLDivElement | null = null;
let root: Root | null = null;

function render(content: React.ReactNode, props: Partial<PagedDocumentProps> = {}): void {
  if (!host) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  }
  root!.render(
    <PagedDocument {...props}>
      <div className="wrapper">
        <div contentEditable suppressContentEditableWarning style={editorStyle}>
          {content}
        </div>
      </div>
    </PagedDocument>
  );
}

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

const sheetCount = () => document.querySelectorAll('.PagedSheet').length;

/** Resolves once the sheet count has stopped changing for several frames. */
async function settle(): Promise<number> {
  let stable = 0;
  let last = -1;
  while (stable < 6) {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    const count = sheetCount();
    stable = count === last ? stable + 1 : 0;
    last = count;
  }
  return last;
}

/** Client rects of every rendered line fragment, in flow coordinates. */
function lineRects(scale = 1): { top: number; bottom: number }[] {
  const flow = document.querySelector('.PagedDocumentContent')!;
  const origin = flow.getBoundingClientRect().top;
  const rects: { top: number; bottom: number }[] = [];
  const walker = document.createTreeWalker(flow, NodeFilter.SHOW_TEXT);
  const range = document.createRange();

  while (walker.nextNode()) {
    range.selectNodeContents(walker.currentNode);
    for (const rect of Array.from(range.getClientRects())) {
      rects.push({ top: (rect.top - origin) / scale, bottom: (rect.bottom - origin) / scale });
    }
  }
  for (const br of Array.from(flow.querySelectorAll('br'))) {
    const rect = br.getBoundingClientRect();
    rects.push({ top: (rect.top - origin) / scale, bottom: (rect.bottom - origin) / scale });
  }
  return rects;
}

function expectNoLineInDeadZone(rects: { top: number; bottom: number }[]): void {
  expect(rects.length).toBeGreaterThan(0);
  for (const rect of rects) {
    const { relativeY } = pageForOffset(rect.top, letter);
    expect(relativeY + (rect.bottom - rect.top)).toBeLessThanOrEqual(letter.usableHeight + 1);
  }
}

function pagesUsed(rects: { top: number }[]): Set<number> {
  return new Set(rects.map((rect) => pageForOffset(rect.top, letter).pageNumber));
}

describe('PagedDocument', () => {
  it('keeps a short document on one sheet', async () => {
    render(<p style={paragraphStyle}>{words(40)}</p>);
    expect(await settle()).toBe(1);
  });

  it('breaks a single long paragraph between lines across sheets', async () => {
    render(<p style={paragraphStyle}>{words(1500)}</p>);
    const sheets = await settle();
    const rects = lineRects();

    expect(sheets).toBeGreaterThanOrEqual(3);
    expectNoLineInDeadZone(rects);
    expect(pagesUsed(rects).size).toBe(sheets);
  });

  it('paginates a large pasted document', async () => {
    render(
      Array.from({ length: 300 }, (_, i) => (
        <p key={i} style={paragraphStyle}>
          {words(30 + (i % 7) * 25)}
        </p>
      ))
    );
    const sheets = await settle();
    const rects = lineRects();

    expect(sheets).toBeGreaterThan(20);
    expectNoLineInDeadZone(rects);
    expect(Math.max(...pagesUsed(rects))).toBe(sheets);
  });

  it('keeps empty lines out of the dead zone', async () => {
    render(
      Array.from({ length: 80 }, (_, i) => (
        <p key={i} style={{ margin: 0 }}>
          <br />
        </p>
      ))
    );
    await settle();
    expectNoLineInDeadZone(lineRects());
  });

  it('moves a table that does not fit to the next sheet whole', async () => {
    render(
      <>
        <div style={{ height: 600 }} />
        <table style={{ height: 400, width: '100%' }}>
          <tbody>
            <tr>
              <td>cell</td>
            </tr>
          </tbody>
        </table>
      </>
    );
    expect(await settle()).toBe(2);

    const flowTop = document.querySelector('.PagedDocumentContent')!.getBoundingClientRect().top;
    const tableTop = document.querySelector('table')!.getBoundingClientRect().top - flowTop;
    expect(tableTop).toBeGreaterThanOrEqual(letter.period);
    expect(tableTop).toBeLessThan(letter.period + 2);
  });

  it('converges when a table is taller than a page', async () => {
    render(
      <>
        <p style={paragraphStyle}>{words(40)}</p>
        <table style={{ height: 2000, width: '100%' }}>
          <tbody>
            <tr>
              <td>cell</td>
            </tr>
          </tbody>
        </table>
        <p className="after" style={paragraphStyle}>
          {words(400)}
        </p>
      </>
    );
    const sheets = await settle();
    expect(sheets).toBeLessThanOrEqual(5);

    const after = document.querySelector('.after')!;
    const origin = document.querySelector('.PagedDocumentContent')!.getBoundingClientRect().top;
    const range = document.createRange();
    range.selectNodeContents(after);
    expectNoLineInDeadZone(
      Array.from(range.getClientRects()).map((r) => ({
        top: r.top - origin,
        bottom: r.bottom - origin,
      }))
    );
  });

  it('breaks a long paragraph whose text sits in an inline wrapper', async () => {
    render(
      <p style={paragraphStyle}>
        <span>{words(1500)}</span>
      </p>
    );
    const sheets = await settle();
    const rects = lineRects();

    expect(sheets).toBeGreaterThanOrEqual(3);
    expectNoLineInDeadZone(rects);
    expect(pagesUsed(rects).size).toBe(sheets);
  });

  it('converges when a nested unbreakable block is taller than a page', async () => {
    render(
      <>
        <p style={paragraphStyle}>{words(40)}</p>
        <p style={paragraphStyle}>
          <span style={{ display: 'block' }}>
            <span style={{ display: 'flex', height: 2000 }} />
          </span>
        </p>
        <p className="after" style={paragraphStyle}>
          {words(400)}
        </p>
      </>
    );
    expect(await settle()).toBeLessThanOrEqual(5);

    const after = document.querySelector('.after')!;
    const origin = document.querySelector('.PagedDocumentContent')!.getBoundingClientRect().top;
    const range = document.createRange();
    range.selectNodeContents(after);
    expectNoLineInDeadZone(
      Array.from(range.getClientRects()).map((r) => ({
        top: r.top - origin,
        bottom: r.bottom - origin,
      }))
    );
  });

  it('converges when an inline image is taller than a page', async () => {
    render(
      <>
        <p style={paragraphStyle}>
          {words(40)}
          <img
            alt=""
            width={200}
            height={1500}
            src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="
          />
        </p>
        <p style={paragraphStyle}>{words(200)}</p>
      </>
    );
    expect(await settle()).toBeLessThanOrEqual(4);
  });

  it('is unaffected by re-renders with fresh option objects', async () => {
    const content = <p style={paragraphStyle}>{words(1500)}</p>;
    render(content, { margins: { top: 96, bottom: 96, left: 96, right: 96 } });
    const sheets = await settle();
    const spacers = Array.from(document.querySelectorAll('.PageBreakSpacer'));

    for (let i = 0; i < 20; i++) {
      render(content, { margins: { top: 96, bottom: 96, left: 96, right: 96 } });
    }

    expect(await settle()).toBe(sheets);
    expect(Array.from(document.querySelectorAll('.PageBreakSpacer'))).toEqual(spacers);
  });

  it('removes sheets when content is deleted', async () => {
    render(<p style={paragraphStyle}>{words(1500)}</p>);
    expect(await settle()).toBeGreaterThanOrEqual(3);

    render(<p style={paragraphStyle}>{words(20)}</p>);
    expect(await settle()).toBe(1);
  });

  it('paginates identically when zoomed', async () => {
    render(<p style={paragraphStyle}>{words(1500)}</p>);
    const sheets = await settle();

    render(<p style={paragraphStyle}>{words(1500)}</p>, { zoom: 0.5 });
    expect(await settle()).toBe(sheets);
    expectNoLineInDeadZone(lineRects(0.5));
  });

  it('reports the page count', async () => {
    const counts: number[] = [];
    render(<p style={paragraphStyle}>{words(1500)}</p>, {
      onPageCountChange: (count) => counts.push(count),
    });
    const sheets = await settle();
    expect(counts[counts.length - 1]).toBe(sheets);
  });
});
