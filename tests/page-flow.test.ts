import { describe, expect, it } from 'vitest';
import {
  computePageCount,
  getDocumentHeight,
  getPageBoundary,
  getSheetOffsets,
  getSpacerSegments,
  pageForOffset,
  resolvePageGeometry,
} from '../src/core/PageFlow';

describe('PageFlow', () => {
  const letter = resolvePageGeometry();

  it('resolves US Letter geometry with 1 inch margins and a 20px gutter', () => {
    expect(letter).toMatchObject({
      width: 816,
      height: 1056,
      usableWidth: 624,
      usableHeight: 864,
      deskGutter: 20,
      deadZone: 212,
      period: 1076,
    });
  });

  it('resolves presets, custom sizes and partial margins', () => {
    const a4 = resolvePageGeometry({ pageSize: 'a4', margins: { top: 48 }, deskGutter: 0 });
    expect(a4.usableHeight).toBe(1123 - 48 - 96);
    expect(a4.deadZone).toBe(96 + 0 + 48);

    const custom = resolvePageGeometry({ pageSize: { width: 500, height: 700 } });
    expect(custom.usableWidth).toBe(308);
    expect(custom.usableHeight).toBe(508);
  });

  it('never yields a zero period when margins exceed the page', () => {
    const tiny = resolvePageGeometry({ pageSize: { width: 100, height: 100 } });
    expect(tiny.usableHeight).toBe(1);
    expect(computePageCount(0, tiny)).toBe(1);
  });

  it('counts pages at exact boundaries', () => {
    expect(computePageCount(0, letter)).toBe(1);
    expect(computePageCount(864, letter)).toBe(1);
    expect(computePageCount(865, letter)).toBe(2);
    expect(computePageCount(1076, letter)).toBe(2);
    expect(computePageCount(1940, letter)).toBe(2);
    expect(computePageCount(1941, letter)).toBe(3);
    expect(computePageCount(getPageBoundary(10, letter), letter)).toBe(10);
  });

  it('treats invalid heights as an empty document', () => {
    expect(computePageCount(-50, letter)).toBe(1);
    expect(computePageCount(Number.NaN, letter)).toBe(1);
  });

  it('places one spacer per dead zone and one over the last bottom margin', () => {
    expect(getSpacerSegments(1, letter)).toEqual([{ top: 864, height: 96, gutter: 0 }]);
    expect(getSpacerSegments(3, letter)).toEqual([
      { top: 864, height: 212, gutter: 20 },
      { top: 1940, height: 212, gutter: 20 },
      { top: 3016, height: 96, gutter: 0 },
    ]);
  });

  it('opens dead zones covered by an oversized unbreakable block', () => {
    // A 2000px block at the top of page 2 covers one dead zone and ends inside the next.
    const spans = [{ top: 1076, bottom: 3076 }];
    expect(getSpacerSegments(4, letter, spans)).toEqual([
      { top: 864, height: 212, gutter: 20 },
      { top: 3076, height: 152, gutter: 0 },
      { top: 4092, height: 96, gutter: 0 },
    ]);
  });

  it('keeps the dead zone a block starts directly below', () => {
    const spans = [{ top: 1076, bottom: 1500 }];
    expect(getSpacerSegments(2, letter, spans)).toEqual([
      { top: 864, height: 212, gutter: 20 },
      { top: 1940, height: 96, gutter: 0 },
    ]);
  });

  it('stacks sheets one gutter apart', () => {
    expect(getSheetOffsets(3, letter)).toEqual([0, 1076, 2152]);
    expect(getDocumentHeight(1, letter)).toBe(1056);
    expect(getDocumentHeight(3, letter)).toBe(3 * 1056 + 2 * 20);
  });

  it('maps flow offsets to pages', () => {
    expect(pageForOffset(0, letter)).toEqual({ pageNumber: 1, relativeY: 0 });
    expect(pageForOffset(863, letter)).toEqual({ pageNumber: 1, relativeY: 863 });
    expect(pageForOffset(1076, letter)).toEqual({ pageNumber: 2, relativeY: 0 });
    expect(pageForOffset(2152 + 10, letter)).toEqual({ pageNumber: 3, relativeY: 10 });
  });
});
