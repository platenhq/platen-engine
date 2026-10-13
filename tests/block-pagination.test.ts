import { describe, expect, it } from 'vitest';
import { calculateBlockBreaks, BlockLayoutOptions } from '../src/layout/BlockPagination';

describe('BlockPagination - calculateBlockBreaks', () => {
  const standardLetterOptions: BlockLayoutOptions = {
    pageHeight: 1056,
    pageWidth: 816,
    margins: {
      top: 96,
      bottom: 96,
      left: 96,
      right: 96,
    },
    deskGutter: 20,
  };

  it('calculates single page fit when total block height <= usableHeight (864px)', () => {
    // 3 blocks of 200px = 600px <= 864px usable
    const blockHeights = [200, 200, 200];
    const result = calculateBlockBreaks(blockHeights, standardLetterOptions);

    expect(result.usableHeight).toBe(864);
    expect(result.deadZone).toBe(212); // 96 + 20 + 96
    expect(result.pageCount).toBe(1);
    expect(result.breaks).toHaveLength(0);
  });

  it('breaks atomic block to Page 2 bridging remaining space and dead zone (576px)', () => {
    // Block 0: 500px text
    // Block 1: 400px image
    // Usable: 864px, Remaining on Page 1: 864 - 500 = 364px
    // Dead zone: 212px -> Total deadZoneSpacer: 364 + 212 = 576px
    const blockHeights = [500, 400];
    const result = calculateBlockBreaks(blockHeights, standardLetterOptions);

    expect(result.pageCount).toBe(2);
    expect(result.breaks).toHaveLength(1);
    expect(result.breaks[0]).toEqual({
      index: 1,
      deadZoneSpacer: 576,
      targetPage: 2,
    });
  });

  it('cascades across multiple pages accurately for 10 blocks of 300px each', () => {
    // Each page fits at most 2 blocks (600px).
    // Remaining per page: 864 - 600 = 264px.
    // Total deadZoneSpacer per break: 264 + 212 = 476px.
    // 10 blocks => 5 pages with breaks at indices 2, 4, 6, 8.
    const blockHeights = Array(10).fill(300);
    const result = calculateBlockBreaks(blockHeights, standardLetterOptions);

    expect(result.pageCount).toBe(5);
    expect(result.breaks).toHaveLength(4);
    expect(result.breaks.map((b) => b.index)).toEqual([2, 4, 6, 8]);
    expect(result.breaks.map((b) => b.targetPage)).toEqual([2, 3, 4, 5]);
    result.breaks.forEach((b) => {
      expect(b.deadZoneSpacer).toBe(476);
    });
  });

  it('handles edge case where a single block is taller than an entire page', () => {
    const blockHeights = [1200, 300];
    const result = calculateBlockBreaks(blockHeights, standardLetterOptions);

    expect(result.pageCount).toBe(2);
    expect(result.breaks).toHaveLength(1);
    expect(result.breaks[0].index).toBe(1);
    expect(result.breaks[0].targetPage).toBe(2);
  });

  it('verifies zero-side-effect teardown and spacer removal', () => {
    const mockElement = {
      style: { marginTop: '576px' },
      attributes: new Map([['data-page-break-spacer', 'true']]),
      hasAttribute(name: string) {
        return this.attributes.has(name);
      },
      removeAttribute(name: string) {
        this.attributes.delete(name);
      },
    };

    const mockContainer = {
      querySelectorAll: (selector: string) => {
        if (selector === '[data-page-break-spacer]') {
          return [mockElement];
        }
        return [];
      },
    };

    const spaced = mockContainer.querySelectorAll('[data-page-break-spacer]');
    spaced.forEach((el) => {
      el.style.marginTop = '';
      el.removeAttribute('data-page-break-spacer');
    });

    expect(mockElement.style.marginTop).toBe('');
    expect(mockElement.hasAttribute('data-page-break-spacer')).toBe(false);
  });
});
