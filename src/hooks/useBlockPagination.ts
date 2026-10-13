import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BlockBreakItem,
  BlockLayoutOptions,
  BlockPaginationResult,
  calculateBlockBreaks,
} from '../layout/BlockPagination';

export interface UseBlockPaginationOptions extends BlockLayoutOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  debounceMs?: number;
  enabled?: boolean;
}

export interface UseBlockPaginationReturn {
  pageCount: number;
  breaks: BlockBreakItem[];
  applySpacers: () => void;
  clearSpacers: () => void;
}

/**
 * React hook that coordinates DOM element heights and injects non-destructive
 * dead-zone spacers on top-level block children to ensure clean sheet alignment.
 */
export function useBlockPagination(options: UseBlockPaginationOptions): UseBlockPaginationReturn {
  const {
    containerRef,
    pageHeight,
    pageWidth,
    margins,
    deskGutter,
    debounceMs = 30,
    enabled = true,
  } = options;

  const [pagination, setPagination] = useState<BlockPaginationResult>({
    pageCount: 1,
    breaks: [],
    usableHeight: Math.max(100, pageHeight - margins.top - margins.bottom),
    deadZone: margins.bottom + deskGutter + margins.top,
  });

  const clearSpacers = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const spaced = container.querySelectorAll<HTMLElement>('[data-page-break-spacer]');
    spaced.forEach((el) => {
      el.style.marginTop = '';
      el.removeAttribute('data-page-break-spacer');
    });
  }, [containerRef]);

  const applySpacers = useCallback(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      clearSpacers();
      return;
    }

    const children = Array.from(container.children) as HTMLElement[];
    if (children.length === 0) {
      setPagination({
        pageCount: 1,
        breaks: [],
        usableHeight: Math.max(100, pageHeight - margins.top - margins.bottom),
        deadZone: margins.bottom + deskGutter + margins.top,
      });
      return;
    }

    // Reset spacers temporarily to measure natural element heights
    children.forEach((el) => {
      if (el.hasAttribute('data-page-break-spacer')) {
        el.style.marginTop = '';
        el.removeAttribute('data-page-break-spacer');
      }
    });

    const heights = children.map((c) => c.offsetHeight);
    const result = calculateBlockBreaks(heights, {
      pageHeight,
      pageWidth,
      margins,
      deskGutter,
    });

    // Inject exact dead-zone spacers
    result.breaks.forEach((b) => {
      const child = children[b.index];
      if (child) {
        child.style.marginTop = `${b.deadZoneSpacer}px`;
        child.setAttribute('data-page-break-spacer', 'true');
      }
    });

    setPagination(result);
  }, [containerRef, enabled, pageHeight, pageWidth, margins, deskGutter, clearSpacers]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) {
      clearSpacers();
      return;
    }

    const scheduleUpdate = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        applySpacers();
      }, debounceMs);
    };

    scheduleUpdate();

    const observer = new ResizeObserver(() => {
      scheduleUpdate();
    });

    observer.observe(container);
    Array.from(container.children).forEach((child) => observer.observe(child));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observer.disconnect();
      clearSpacers();
    };
  }, [containerRef, enabled, debounceMs, applySpacers, clearSpacers]);

  return {
    pageCount: pagination.pageCount,
    breaks: pagination.breaks,
    applySpacers,
    clearSpacers,
  };
}
