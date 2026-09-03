import { describe, expect, it } from 'vitest';
import { CaretPositioner } from '../src/core/CaretPositioner';
import { LayoutSlicer } from '../src/core/LayoutSlicer';
import { ParagraphBlock, TextStyle } from '../src/core/Types';

describe('CaretPositioner', () => {
  const defaultStyle: TextStyle = {
    fontFamily: 'Arial',
    fontSize: 16,
    lineHeight: 24,
  };

  const slicer = new LayoutSlicer();
  const positioner = new CaretPositioner();

  it('maps character offset 0 to x:0 and the first line y position', () => {
    const blocks: ParagraphBlock[] = [
      {
        id: 'p1',
        runs: [{ text: 'Hello World' }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    const coords = positioner.getCaretCoordinates(pages, 'p1', 0);

    expect(coords).not.toBeNull();
    expect(coords?.pageIndex).toBe(0);
    expect(coords?.x).toBe(0);
    expect(coords?.y).toBe(0);
    expect(coords?.height).toBe(24);
  });

  it('maps middle character offsets to positive x values', () => {
    const blocks: ParagraphBlock[] = [
      {
        id: 'p1',
        runs: [{ text: 'Hello World' }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    const coordsStart = positioner.getCaretCoordinates(pages, 'p1', 0);
    const coordsMid = positioner.getCaretCoordinates(pages, 'p1', 5);

    expect(coordsMid).not.toBeNull();
    expect(coordsMid!.x).toBeGreaterThan(coordsStart!.x);
    expect(coordsMid!.y).toBe(coordsStart!.y);
  });

  it('resolves caret coordinates onto page 2 when paragraph is sliced across page boundary', () => {
    // Generate enough text to spill over Letter page usable height (864px = 36 lines)
    const longSentences = Array.from(
      { length: 50 },
      (_, i) => `Sentence number ${i + 1} with sufficient length to wrap cleanly.`
    ).join(' ');

    const blocks: ParagraphBlock[] = [
      {
        id: 'p_split',
        runs: [{ text: longSentences }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    expect(pages.length).toBeGreaterThanOrEqual(2);

    // Get character offset from the first line on Page 2
    const page2Track = pages[1].tracks.find((t) => t.paraId === 'p_split');
    expect(page2Track).toBeDefined();

    const page2StartChar = page2Track!.lines[0].startIndex;
    const coords = positioner.getCaretCoordinates(pages, 'p_split', page2StartChar);

    expect(coords).not.toBeNull();
    expect(coords?.pageIndex).toBe(1);
    expect(coords?.x).toBe(0);
    expect(coords?.y).toBe(0);
  });

  it('resolves nearest character offset from a click point on a page', () => {
    const blocks: ParagraphBlock[] = [
      {
        id: 'p1',
        runs: [{ text: 'The quick brown fox jumps over the lazy dog.' }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });

    // Click near the beginning
    const clickStart = positioner.getCharacterOffsetAtPoint(pages, 0, 5, 10);
    expect(clickStart).not.toBeNull();
    expect(clickStart?.charOffset).toBe(0);

    // Click further to the right
    const clickMid = positioner.getCharacterOffsetAtPoint(pages, 0, 150, 10);
    expect(clickMid).not.toBeNull();
    expect(clickMid!.charOffset).toBeGreaterThan(0);
  });
});
