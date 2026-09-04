import { describe, expect, it } from 'vitest';
import { LayoutSlicer } from '../src/core/LayoutSlicer';
import { ParagraphBlock, TextStyle } from '../src/core/Types';

describe('LayoutSlicer', () => {
  const defaultStyle: TextStyle = {
    fontFamily: 'Arial',
    fontSize: 16,
    lineHeight: 24,
  };

  const slicer = new LayoutSlicer();

  it('allocates small paragraphs onto a single page', () => {
    const blocks: ParagraphBlock[] = [
      {
        id: 'p1',
        runs: [{ text: 'First paragraph heading' }],
        defaultStyle: { ...defaultStyle, fontSize: 24, lineHeight: 32 },
        spaceAfter: 16,
      },
      {
        id: 'p2',
        runs: [{ text: 'Second short paragraph of text.' }],
        defaultStyle,
        spaceAfter: 16,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    expect(pages).toHaveLength(1);
    expect(pages[0].tracks).toHaveLength(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].tracks[0].paraId).toBe('p1');
    expect(pages[0].tracks[1].paraId).toBe('p2');
    expect(pages[0].tracks[1].y).toBeGreaterThan(pages[0].tracks[0].y);
  });

  it('slices a large paragraph across page boundaries sharing the same paraId (Single Large Paragraph Paradox)', () => {
    // Usable height on Letter (1056 - 192) = 864px.
    // At lineHeight = 24, 864px accommodates exactly 36 lines.
    // 50 lines will definitely overflow Page 1 into Page 2.
    const longSentences = Array.from(
      { length: 50 },
      (_, i) => `Line item sentence number ${i + 1} with enough length to wrap cleanly.`
    ).join(' ');

    const blocks: ParagraphBlock[] = [
      {
        id: 'large_p_100',
        runs: [{ text: longSentences }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, { pageSize: 'letter' });

    expect(pages.length).toBeGreaterThanOrEqual(2);

    // Verify Page 1 slice
    const trackPage1 = pages[0].tracks.find((t) => t.paraId === 'large_p_100');
    expect(trackPage1).toBeDefined();
    expect(trackPage1?.isFirstSlice).toBe(true);
    expect(trackPage1?.isLastSlice).toBe(false);

    // Verify Page 2 slice
    const trackPage2 = pages[1].tracks.find((t) => t.paraId === 'large_p_100');
    expect(trackPage2).toBeDefined();
    expect(trackPage2?.isFirstSlice).toBe(false);

    // Check line sequence continuity
    expect(trackPage2!.lineStart).toBe(trackPage1!.lineEnd + 1);
  });

  it('prevents orphans and widows according to minimum line thresholds', () => {
    // Construct a scenario near the page boundary
    const sentence =
      'Typesetting quality requires avoiding single isolated lines at the top or bottom of pages.';
    const blocks: ParagraphBlock[] = [
      // Fill most of page 1 with a tall spacer block
      {
        id: 'filler',
        runs: [{ text: Array.from({ length: 34 }, () => sentence).join(' ') }],
        defaultStyle,
      },
      // 3-line paragraph arriving near bottom
      {
        id: 'three_liner',
        runs: [{ text: 'First line. Second line. Third line. Fourth line.' }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, {
      pageSize: 'letter',
      preventWidowsAndOrphans: true,
      minLinesPerSlice: 2,
    });

    // Check all slices across all pages to ensure no slice has exactly 1 line if the block has >= 2 lines
    for (const page of pages) {
      for (const track of page.tracks) {
        if (!track.isFirstSlice || !track.isLastSlice) {
          expect(track.lines.length).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('supports A4 and custom margins correctly', () => {
    const blocks: ParagraphBlock[] = [
      {
        id: 'a4_p',
        runs: [{ text: 'Document in A4 format with 48px margins.' }],
        defaultStyle,
      },
    ];

    const pages = slicer.paginate(blocks, {
      pageSize: 'a4',
      margins: { top: 48, bottom: 48, left: 48, right: 48 },
    });

    expect(pages[0].width).toBe(794);
    expect(pages[0].height).toBe(1123);
    expect(pages[0].usableWidth).toBe(794 - 96);
    expect(pages[0].usableHeight).toBe(1123 - 96);
  });
});
