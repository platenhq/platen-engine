export interface BlockLayoutOptions {
  pageHeight: number;
  pageWidth: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  deskGutter: number;
}

export interface BlockBreakItem {
  index: number;
  elementId?: string;
  deadZoneSpacer: number;
  targetPage: number;
}

export interface BlockPaginationResult {
  pageCount: number;
  breaks: BlockBreakItem[];
  usableHeight: number;
  deadZone: number;
}

/**
 * Calculates page breaks and dead-zone spacing based on top-level block heights.
 * Ensures atomic blocks (images, tables, callouts, paragraphs) never straddle margins or desk gutters.
 */
export function calculateBlockBreaks(
  blockHeights: number[],
  options: BlockLayoutOptions
): BlockPaginationResult {
  const { pageHeight, margins, deskGutter } = options;

  const usableHeight = Math.max(100, pageHeight - margins.top - margins.bottom);
  const deadZone = margins.bottom + deskGutter + margins.top;

  const breaks: BlockBreakItem[] = [];
  let currentPage = 1;
  let currentAccumulatedHeight = 0;

  for (let i = 0; i < blockHeights.length; i++) {
    const h = blockHeights[i];
    if (h <= 0) continue;

    if (currentAccumulatedHeight + h <= usableHeight) {
      currentAccumulatedHeight += h;
    } else {
      if (currentAccumulatedHeight > 0) {
        // Overflow detected: bridge remaining space on currentPage + deadZone
        const remainingOnCurrentPage = usableHeight - currentAccumulatedHeight;
        const deadZoneSpacer = remainingOnCurrentPage + deadZone;
        currentPage += 1;
        breaks.push({
          index: i,
          deadZoneSpacer,
          targetPage: currentPage,
        });
        currentAccumulatedHeight = h;
      } else {
        // Edge case: single block taller than entire usable page height
        currentAccumulatedHeight = h;
      }
    }
  }

  return {
    pageCount: currentPage,
    breaks,
    usableHeight,
    deadZone,
  };
}
