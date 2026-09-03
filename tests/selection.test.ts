import { describe, expect, it } from 'vitest';
import { CaretPositioner } from '../src/core/CaretPositioner';
import { LayoutSlicer } from '../src/core/LayoutSlicer';
import { DocumentSelection } from '../src/core/SelectionTypes';
import { ParagraphBlock, TextStyle } from '../src/core/Types';

describe('SelectionEngine', () => {
  const defaultStyle: TextStyle = {
    fontFamily: 'Arial',
    fontSize: 16,
    lineHeight: 24,
  };

  const slicer = new LayoutSlicer();
  const positioner = new CaretPositioner();

  it('returns empty array for collapsed selection', () => {
    const blocks: ParagraphBlock[] = [
      {
        id: 'p1',
        runs: [{ text: 'Hello World' }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    const selection: DocumentSelection = {
      anchor: { paraId: 'p1', charOffset: 3 },
      head: { paraId: 'p1', charOffset: 3 },
      isCollapsed: true,
    };

    const rects = positioner.computeSelectionRects(pages, selection);
    expect(rects).toHaveLength(0);
  });

  it('generates a single highlight rect for a single-line selection span', () => {
    const blocks: ParagraphBlock[] = [
      {
        id: 'p1',
        runs: [{ text: 'Hello World of Typography' }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    const selection: DocumentSelection = {
      anchor: { paraId: 'p1', charOffset: 6 },
      head: { paraId: 'p1', charOffset: 11 }, // "World"
      isCollapsed: false,
    };

    const rects = positioner.computeSelectionRects(pages, selection);
    expect(rects).toHaveLength(1);
    expect(rects[0].width).toBeGreaterThan(0);
    expect(rects[0].height).toBe(24);
    expect(rects[0].paraId).toBe('p1');
    expect(rects[0].pageIndex).toBe(0);
  });

  it('generates multiple highlight rects for multi-line selection spanning across paragraphs', () => {
    const blocks: ParagraphBlock[] = [
      {
        id: 'p1',
        runs: [{ text: 'First paragraph sentence that is long enough.' }],
        defaultStyle,
      },
      {
        id: 'p2',
        runs: [{ text: 'Second paragraph sentence following it.' }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    const selection: DocumentSelection = {
      anchor: { paraId: 'p1', charOffset: 10 },
      head: { paraId: 'p2', charOffset: 15 },
      isCollapsed: false,
    };

    const rects = positioner.computeSelectionRects(pages, selection);
    expect(rects.length).toBeGreaterThanOrEqual(2);

    const p1Rect = rects.find((r) => r.paraId === 'p1');
    const p2Rect = rects.find((r) => r.paraId === 'p2');

    expect(p1Rect).toBeDefined();
    expect(p2Rect).toBeDefined();
  });
});
