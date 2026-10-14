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

// Boxes whose lines and child blocks share the flow's formatting context.
const BREAKABLE_DISPLAYS = new Set(['block', 'list-item', 'inline', 'contents']);
const REPLACED_ELEMENTS = new Set(['IMG', 'VIDEO', 'CANVAS', 'IFRAME', 'SVG', 'OBJECT', 'EMBED']);

function isUnbreakable(element: Element): boolean {
  if (REPLACED_ELEMENTS.has(element.tagName.toUpperCase())) return true;
  const style = getComputedStyle(element);
  return (
    !BREAKABLE_DISPLAYS.has(style.display) ||
    style.overflowX !== 'visible' ||
    style.overflowY !== 'visible'
  );
}

/**
 * Blocks taller than a page that cannot flow around a spacer, in flow coordinates.
 * Such a block can sit at any depth, but only inside ancestors that are themselves taller
 * than a page, so the search descends through oversized breakable boxes only.
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

  const visit = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      const rect = child.getBoundingClientRect();
      if (!flowRect) {
        flowRect = flow.getBoundingClientRect();
        // Client rects are affected by ancestor transforms; flow offsets are not.
        scale = flow.offsetHeight > 0 ? flowRect.height / flow.offsetHeight || 1 : 1;
      }
      const height = rect.height / scale;
      if (height <= usableHeight) continue;

      if (isUnbreakable(child)) {
        const top = (rect.top - flowRect.top) / scale;
        spans.push({ top, bottom: top + height });
      } else {
        visit(child);
      }
    }
  };
  visit(content);

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

// Only the build flag is needed, so the library does not depend on Node type definitions.
declare const process: { env: { NODE_ENV?: string } };

/**
 * Bundlers replace `process.env.NODE_ENV` with a literal, so this works in the browser even
 * where no `process` object exists. Without a bundler it throws, and warnings stay off.
 */
function isDevelopmentBuild(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

const BLOCK_DISPLAYS = new Set(['block', 'list-item']);
const warnedSqueezed = new WeakSet<Element>();

/**
 * Warns about unbreakable blocks squeezed to zero width beside a page spacer. A block that
 * forms its own formatting context and has automatic width may be shrunk into the empty
 * sliver next to a spacer instead of being moved to the next page, and its content then
 * disappears. Each element is reported once.
 */
function warnAboutSqueezedBlocks(flow: HTMLElement, segments: SpacerSegment[]): void {
  if (segments.length === 0 || flow.offsetHeight === 0) return;
  const flowRect = flow.getBoundingClientRect();
  const scale = flowRect.height / flow.offsetHeight || 1;
  const walker = document.createTreeWalker(flow, NodeFilter.SHOW_ELEMENT);

  while (walker.nextNode()) {
    const el = walker.currentNode;
    if (!(el instanceof HTMLElement) || warnedSqueezed.has(el)) continue;
    if (el.offsetWidth > 0 || el.offsetHeight === 0) continue;
    const parent = el.parentElement;
    if (!parent || parent.offsetWidth === 0) continue;

    const style = getComputedStyle(el);
    const formsContext =
      !BLOCK_DISPLAYS.has(style.display) ||
      style.overflowX !== 'visible' ||
      style.overflowY !== 'visible';
    if (!formsContext || style.display === 'inline' || style.display === 'contents') continue;

    const rect = el.getBoundingClientRect();
    const top = (rect.top - flowRect.top) / scale;
    const bottom = top + el.offsetHeight;
    if (!segments.some((segment) => top < segment.top + segment.height && bottom > segment.top)) {
      continue;
    }

    warnedSqueezed.add(el);
    console.warn(
      '[@platen/engine] An unbreakable block was squeezed to zero width beside a page ' +
        'break, so its content is hidden. Give it width: 100% and box-sizing: border-box ' +
        'so it moves to the next page instead:',
      el
    );
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

    const isDevelopment = isDevelopmentBuild();
    if (isDevelopment) warnIfFlowIsIsolated(flow, contentSelector);
    let squeezeCheck: ReturnType<typeof setTimeout> | undefined;

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
            segment.top === segments[index].top &&
            segment.height === segments[index].height &&
            segment.gutter === segments[index].gutter
        )
          ? prev
          : { pageCount, segments }
      );

      if (isDevelopment) {
        // Checked once layout has settled, after the spacers for this update are in place.
        clearTimeout(squeezeCheck);
        squeezeCheck = setTimeout(() => warnAboutSqueezedBlocks(flow, segments), 300);
      }
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(flow);

    return () => {
      observer.disconnect();
      clearTimeout(squeezeCheck);
    };
  }, [flowRef, enabled, geometry, contentSelector, maxPages]);

  return { pageCount: layout.pageCount, segments: layout.segments, geometry };
}
