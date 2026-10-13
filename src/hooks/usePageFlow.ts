import { RefObject, useEffect, useMemo, useState } from 'react';
import {
  computePageCount,
  FlowSpan,
  getSpacerSegments,
  PageFlowOptions,
  PageGeometry,
  resolvePageGeometry,
  SpacerSegment,
} from '../core/PageFlow';
import { PageDimensions } from '../core/Types';

export const DEFAULT_CONTENT_SELECTOR = '[contenteditable="true"]';
export const DEFAULT_MAX_PAGES = 1000;

export interface UsePageFlowOptions extends PageFlowOptions {
  /** Element wrapping the flowed content. Its height drives the page count. */
  flowRef: RefObject<HTMLElement | null>;
  /** Element inside `flowRef` whose children are the document's top-level blocks. */
  contentSelector?: string;
  maxPages?: number;
  enabled?: boolean;
}

export interface PageFlowState {
  pageCount: number;
  /** Spacers to hand to `PageBreakRail`. */
  segments: SpacerSegment[];
  geometry: PageGeometry;
}

interface FlowLayout {
  pageCount: number;
  segments: SpacerSegment[];
}

const SINGLE_PAGE: FlowLayout = { pageCount: 1, segments: [] };

const BREAKABLE_DISPLAYS = new Set(['block', 'list-item']);

function isUnbreakable(element: HTMLElement): boolean {
  const style = getComputedStyle(element);
  return (
    !BREAKABLE_DISPLAYS.has(style.display) ||
    style.overflowX !== 'visible' ||
    style.overflowY !== 'visible'
  );
}

/**
 * Top-level blocks taller than a page that cannot flow around a spacer, in flow coordinates.
 */
function findOversizedSpans(
  flow: HTMLElement,
  contentSelector: string,
  usableHeight: number
): FlowSpan[] {
  const content = flow.querySelector<HTMLElement>(contentSelector) ?? flow;
  const spans: FlowSpan[] = [];
  let flowRect: DOMRect | null = null;
  let scale = 1;

  for (const child of Array.from(content.children) as HTMLElement[]) {
    if (child.offsetHeight <= usableHeight || !isUnbreakable(child)) continue;

    if (!flowRect) {
      flowRect = flow.getBoundingClientRect();
      // Client rects are affected by ancestor transforms; flow offsets are not.
      scale = flow.offsetHeight > 0 ? flowRect.height / flow.offsetHeight || 1 : 1;
    }
    const rect = child.getBoundingClientRect();
    const top = (rect.top - flowRect.top) / scale;
    spans.push({ top, bottom: top + child.offsetHeight });
  }

  return spans;
}

function warnIfFlowIsIsolated(flow: HTMLElement, contentSelector: string): void {
  const content = flow.querySelector<HTMLElement>(contentSelector);
  for (let el = content; el && el !== flow; el = el.parentElement) {
    const style = getComputedStyle(el);
    const parentDisplay = el.parentElement ? getComputedStyle(el.parentElement).display : '';
    if (
      style.display !== 'block' ||
      style.overflowX !== 'visible' ||
      style.overflowY !== 'visible' ||
      style.contain !== 'none' ||
      style.float !== 'none' ||
      style.position === 'absolute' ||
      style.position === 'fixed' ||
      /flex|grid/.test(parentDisplay)
    ) {
      console.warn(
        '[@platen/engine] An element between the page flow and the editor content creates ' +
          'its own formatting context, so page breaks will not apply inside it:',
        el
      );
      return;
    }
  }
}

/**
 * Observes flowed content and derives the page count and the spacers for
 * `PageBreakRail`. Never writes to the observed DOM.
 */
export function usePageFlow(options: UsePageFlowOptions): PageFlowState {
  const {
    flowRef,
    pageSize,
    margins,
    deskGutter,
    contentSelector = DEFAULT_CONTENT_SELECTOR,
    maxPages = DEFAULT_MAX_PAGES,
    enabled = true,
  } = options;

  // Depend on primitive values so callers may pass fresh option objects on every render.
  const preset = typeof pageSize === 'string' ? pageSize : undefined;
  const customWidth = typeof pageSize === 'object' ? pageSize.width : undefined;
  const customHeight = typeof pageSize === 'object' ? pageSize.height : undefined;
  const { top, bottom, left, right } = margins ?? {};

  const geometry = useMemo(() => {
    const size: PageFlowOptions['pageSize'] =
      customWidth !== undefined && customHeight !== undefined
        ? ({ width: customWidth, height: customHeight } satisfies PageDimensions)
        : preset;
    return resolvePageGeometry({
      pageSize: size,
      margins: { top, bottom, left, right },
      deskGutter,
    });
  }, [preset, customWidth, customHeight, top, bottom, left, right, deskGutter]);

  const [layout, setLayout] = useState<FlowLayout>(SINGLE_PAGE);

  useEffect(() => {
    const flow = flowRef.current;
    if (!flow || !enabled || typeof ResizeObserver === 'undefined') {
      setLayout(SINGLE_PAGE);
      return;
    }

    if (typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production') {
      warnIfFlowIsIsolated(flow, contentSelector);
    }

    const update = () => {
      const pageCount = Math.min(
        Math.max(1, maxPages),
        computePageCount(flow.offsetHeight, geometry)
      );
      const segments = getSpacerSegments(
        pageCount,
        geometry,
        findOversizedSpans(flow, contentSelector, geometry.usableHeight)
      );

      setLayout((prev) =>
        prev.pageCount === pageCount &&
        prev.segments.length === segments.length &&
        prev.segments.every(
          (segment, index) =>
            segment.top === segments[index].top && segment.height === segments[index].height
        )
          ? prev
          : { pageCount, segments }
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(flow);

    return () => observer.disconnect();
  }, [flowRef, enabled, geometry, contentSelector, maxPages]);

  return { pageCount: layout.pageCount, segments: layout.segments, geometry };
}
