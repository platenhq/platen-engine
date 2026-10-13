import { computeUsableBounds, resolvePageDimensions, resolvePageMargins } from './Geometry';
import { PageDimensions, PageMargins, PageSizePreset } from './Types';

export interface PageFlowOptions {
  pageSize?: PageSizePreset | PageDimensions;
  margins?: Partial<PageMargins>;
  deskGutter?: number;
}

/**
 * Resolved sheet geometry for a flowed document. All vertical offsets used by the
 * page flow are measured from the top of the first page's printable area.
 */
export interface PageGeometry {
  width: number;
  height: number;
  margins: PageMargins;
  usableWidth: number;
  usableHeight: number;
  deskGutter: number;
  /** Bottom margin + desk gutter + top margin: the band no content may occupy. */
  deadZone: number;
  /** Distance between the printable tops of two consecutive pages. */
  period: number;
}

/** A vertical extent, in flow coordinates, of a block that cannot be broken. */
export interface FlowSpan {
  top: number;
  bottom: number;
}

export const DEFAULT_DESK_GUTTER = 20;

export function resolvePageGeometry(options: PageFlowOptions = {}): PageGeometry {
  const { width, height } = resolvePageDimensions(options.pageSize);
  const margins = resolvePageMargins(options.margins);
  const bounds = computeUsableBounds({ width, height }, margins);
  const usableHeight = Math.max(1, bounds.usableHeight);
  const deskGutter = Math.max(0, options.deskGutter ?? DEFAULT_DESK_GUTTER);
  const deadZone = margins.bottom + deskGutter + margins.top;

  return {
    width,
    height,
    margins,
    usableWidth: bounds.usableWidth,
    usableHeight,
    deskGutter,
    deadZone,
    period: usableHeight + deadZone,
  };
}

/**
 * Number of sheets needed for content of the given flowed height, where the height
 * already includes every dead zone the content has been pushed across.
 */
export function computePageCount(contentHeight: number, geometry: PageGeometry): number {
  const height = Number.isFinite(contentHeight) ? Math.max(0, contentHeight) : 0;
  return Math.max(1, Math.ceil((height + geometry.deadZone) / geometry.period));
}

/** Flow offset at which the printable area of a 1-indexed page ends. */
export function getPageBoundary(pageNumber: number, geometry: PageGeometry): number {
  return pageNumber * geometry.period - geometry.deadZone;
}

/** A band of the flow, in flow coordinates, that no line may occupy. */
export interface SpacerSegment {
  top: number;
  height: number;
}

/**
 * Spacers for a document of `pageCount` pages: one per dead zone, plus the bottom margin
 * of the last page so content reaching it is pushed before the page count updates.
 * The parts of a dead zone covered by an oversized unbreakable block are left open: such
 * a block can never fit between two spacers, so it would otherwise be pushed down forever.
 */
export function getSpacerSegments(
  pageCount: number,
  geometry: PageGeometry,
  oversizedSpans: FlowSpan[] = []
): SpacerSegment[] {
  const count = Math.max(1, pageCount);
  const spans = [...oversizedSpans].sort((a, b) => a.top - b.top);
  const segments: SpacerSegment[] = [];

  for (let page = 1; page <= count; page++) {
    const zoneTop = getPageBoundary(page, geometry);
    const zoneBottom = zoneTop + (page === count ? geometry.margins.bottom : geometry.deadZone);
    let cursor = zoneTop;

    for (const span of spans) {
      if (span.bottom <= cursor + 1 || span.top >= zoneBottom - 1) continue;
      if (span.top > cursor + 1) segments.push({ top: cursor, height: span.top - cursor });
      cursor = Math.max(cursor, span.bottom);
    }
    if (zoneBottom > cursor + 1) segments.push({ top: cursor, height: zoneBottom - cursor });
  }
  return segments;
}

/** Top offset of each sheet relative to the top of the first sheet. */
export function getSheetOffsets(pageCount: number, geometry: PageGeometry): number[] {
  return Array.from(
    { length: Math.max(1, pageCount) },
    (_, index) => index * (geometry.height + geometry.deskGutter)
  );
}

/** Total height of a stack of `pageCount` sheets including the gutters between them. */
export function getDocumentHeight(pageCount: number, geometry: PageGeometry): number {
  const count = Math.max(1, pageCount);
  return count * geometry.height + (count - 1) * geometry.deskGutter;
}

/**
 * Maps a flow offset to its page. Offsets inside a dead zone resolve to the page above
 * it, with `relativeY` exceeding that page's usable height.
 */
export function pageForOffset(
  offsetY: number,
  geometry: PageGeometry
): { pageNumber: number; relativeY: number } {
  const y = Math.max(0, offsetY);
  const pageNumber = Math.floor(y / geometry.period) + 1;
  return { pageNumber, relativeY: y - (pageNumber - 1) * geometry.period };
}
