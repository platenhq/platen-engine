import React from 'react';
import { resolvePageDimensions, resolvePageMargins } from '../core/Geometry';
import { PageMargins } from '../core/Types';

export interface PageInfo {
  pageNumber: number;
  totalPages: number;
}

export interface PagedSheetProps {
  pageNumber?: number;
  totalPages?: number;
  width?: number;
  height?: number;
  margins?: Partial<PageMargins>;
  className?: string;
  style?: React.CSSProperties;
  renderHeader?: (info: PageInfo) => React.ReactNode;
  renderFooter?: (info: PageInfo) => React.ReactNode;
}

/**
 * A single sheet of paper with optional header and footer slots in its margins.
 * Purely decorative: document content is flowed over the sheets, not inside them.
 */
export const PagedSheet: React.FC<PagedSheetProps> = ({
  pageNumber = 1,
  totalPages = 1,
  width,
  height,
  margins,
  className,
  style,
  renderHeader,
  renderFooter,
}) => {
  const size = resolvePageDimensions(
    width !== undefined && height !== undefined ? { width, height } : undefined
  );
  const pageMargins = resolvePageMargins(margins);
  const info: PageInfo = { pageNumber, totalPages };

  const slotStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${pageMargins.left}px`,
    right: `${pageMargins.right}px`,
    overflow: 'hidden',
  };

  return (
    <div
      className={`PagedSheet ${className || ''}`.trim()}
      data-page-number={pageNumber}
      style={{
        position: 'relative',
        width: `${size.width}px`,
        height: `${size.height}px`,
        boxSizing: 'border-box',
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        contain: 'strict',
        ...style,
      }}
    >
      {renderHeader && (
        <div
          className="PageHeaderZone"
          style={{ ...slotStyle, top: 0, height: `${pageMargins.top}px` }}
        >
          {renderHeader(info)}
        </div>
      )}
      {renderFooter && (
        <div
          className="PageFooterZone"
          style={{ ...slotStyle, bottom: 0, height: `${pageMargins.bottom}px` }}
        >
          {renderFooter(info)}
        </div>
      )}
    </div>
  );
};
