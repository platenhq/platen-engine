import React from 'react';
import { PageSlice } from '../core/Types';
import { PagedSheet } from './PagedSheet';

export interface PagedDeskProps {
  pages?: PageSlice[];
  zoom?: number;
  deskBackground?: string;
  deskGutter?: number;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
  renderHeader?: (page: PageSlice) => React.ReactNode;
  renderFooter?: (page: PageSlice) => React.ReactNode;
}

/**
 * Viewport container representing the desk surface behind discrete sheets.
 * Provides synchronized vertical scrolling, configurable inter-sheet gutters, and zoom handling.
 */
export const PagedDesk: React.FC<PagedDeskProps> = ({
  pages,
  zoom = 1.0,
  deskBackground = '#f0f2f5',
  deskGutter = 16,
  className,
  style,
  children,
  renderHeader,
  renderFooter,
}) => {
  // Apply zoom conditionally to prevent Chromium dimension calculation freezing
  const zoomStyle: React.CSSProperties =
    zoom !== 1.0
      ? {
          zoom,
        }
      : {};

  return (
    <div
      className={`PagedDesk ${className || ''}`.trim()}
      style={{
        backgroundColor: deskBackground,
        minHeight: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '32px 16px',
        boxSizing: 'border-box',
        overflowY: 'auto',
        overflowX: 'auto',
        ...style,
      }}
    >
      <div
        className="PagedDeskContent"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: `${deskGutter}px`,
          ...zoomStyle,
        }}
      >
        {pages &&
          pages.map((page) => (
            <PagedSheet
              key={page.pageIndex}
              page={page}
              renderHeader={renderHeader}
              renderFooter={renderFooter}
            />
          ))}
        {children}
      </div>
    </div>
  );
};
