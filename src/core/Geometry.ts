import { PageDimensions, PageMargins, PageSizePreset } from './Types';

/**
 * Standard page size presets in CSS pixels (at standard 96 DPI).
 */
export const PAGE_SIZE_PRESETS: Record<PageSizePreset, PageDimensions> = {
  // 8.5 x 11 inches @ 96 DPI
  letter: {
    width: 816,
    height: 1056,
  },
  // 210 x 297 mm @ 96 DPI
  a4: {
    width: 794,
    height: 1123,
  },
  // 8.5 x 14 inches @ 96 DPI
  legal: {
    width: 816,
    height: 1344,
  },
};

/**
 * Standard default margins (1 inch = 96px).
 */
export const DEFAULT_PAGE_MARGINS: PageMargins = {
  top: 96,
  bottom: 96,
  left: 96,
  right: 96,
};

/**
 * Resolves preset name or custom page dimension object.
 */
export function resolvePageDimensions(size: PageSizePreset | PageDimensions = 'letter'): PageDimensions {
  if (typeof size === 'string') {
    const preset = PAGE_SIZE_PRESETS[size.toLowerCase() as PageSizePreset];
    if (!preset) {
      return PAGE_SIZE_PRESETS.letter;
    }
    return preset;
  }
  return {
    width: Math.max(100, size.width),
    height: Math.max(100, size.height),
  };
}

/**
 * Merges partial margins with default 96px margins.
 */
export function resolvePageMargins(margins?: Partial<PageMargins>): PageMargins {
  return {
    top: margins?.top ?? DEFAULT_PAGE_MARGINS.top,
    bottom: margins?.bottom ?? DEFAULT_PAGE_MARGINS.bottom,
    left: margins?.left ?? DEFAULT_PAGE_MARGINS.left,
    right: margins?.right ?? DEFAULT_PAGE_MARGINS.right,
  };
}

/**
 * Calculates the usable printable area inside margins.
 */
export function computeUsableBounds(
  dims: PageDimensions,
  margins: PageMargins
): { usableWidth: number; usableHeight: number } {
  const usableWidth = Math.max(0, dims.width - (margins.left + margins.right));
  const usableHeight = Math.max(0, dims.height - (margins.top + margins.bottom));
  return { usableWidth, usableHeight };
}
