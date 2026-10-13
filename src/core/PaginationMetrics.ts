import { useEffect, useState, RefObject } from 'react';
import { PageMargins } from './Types';
import { DEFAULT_PAGE_MARGINS } from './Geometry';

export interface PaginationOptions {
  contentHeight: number;
  pageHeight: number;
  pageWidth?: number;
  margins?: Partial<PageMargins>;
}

export interface PaginationResult {
  pageCount: number;
  usableHeight: number;
  usableWidth: number;
  pageBreaks: number[];
}

/**
 * Pure non-destructive calculation of document pagination metrics.
 * Computes the required number of physical page sheets and page boundary breaks
 * based on the host editor's real rendered container height.
 */
export function calculatePagination(options: PaginationOptions): PaginationResult {
  const { contentHeight, pageHeight, pageWidth = 816, margins = {} } = options;

  const top = margins.top ?? DEFAULT_PAGE_MARGINS.top;
  const bottom = margins.bottom ?? DEFAULT_PAGE_MARGINS.bottom;
  const left = margins.left ?? DEFAULT_PAGE_MARGINS.left;
  const right = margins.right ?? DEFAULT_PAGE_MARGINS.right;

  const usableHeight = Math.max(100, pageHeight - top - bottom);
  const usableWidth = Math.max(100, pageWidth - left - right);

  const safeContentHeight = Math.max(0, contentHeight);
  const pageCount = Math.max(1, Math.ceil(safeContentHeight / usableHeight));

  const pageBreaks: number[] = [];
  for (let i = 1; i < pageCount; i++) {
    pageBreaks.push(i * usableHeight);
  }

  return {
    pageCount,
    usableHeight,
    usableWidth,
    pageBreaks,
  };
}

export interface UsePaginationOptions {
  pageHeight: number;
  pageWidth?: number;
  margins?: Partial<PageMargins>;
  debounceMs?: number;
}

/**
 * React hook observing the host editor element and dynamically calculating
 * pagination metrics without causing layout thrashing.
 */
export function usePagination(
  targetRef: RefObject<HTMLElement | null>,
  options: UsePaginationOptions
): PaginationResult {
  const { pageHeight, pageWidth = 816, margins, debounceMs = 100 } = options;

  const [result, setResult] = useState<PaginationResult>(() =>
    calculatePagination({
      contentHeight: 0,
      pageHeight,
      pageWidth,
      margins,
    })
  );

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;

    let timeoutId: ReturnType<typeof setTimeout>;

    const update = () => {
      const editable = el.querySelector<HTMLElement>('.editor-input') || el;
      const height = editable.scrollHeight || el.scrollHeight;

      setResult((prev) => {
        const next = calculatePagination({
          contentHeight: height,
          pageHeight,
          pageWidth,
          margins,
        });

        if (
          prev.pageCount === next.pageCount &&
          prev.usableHeight === next.usableHeight &&
          prev.usableWidth === next.usableWidth
        ) {
          return prev;
        }
        return next;
      });
    };

    update();

    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(update, debounceMs);
    });

    resizeObserver.observe(el);
    const editable = el.querySelector<HTMLElement>('.editor-input');
    if (editable) resizeObserver.observe(editable);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [targetRef, pageHeight, pageWidth, margins, debounceMs]);

  return result;
}
