import React from 'react';

export interface PagedDeskProps {
  deskBackground?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

/**
 * Scrollable desk surface that centres a `PagedDocument` and shows through the gutters
 * between its sheets.
 */
export const PagedDesk: React.FC<PagedDeskProps> = ({
  deskBackground = '#f0f2f5',
  className,
  style,
  children,
}) => (
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
      overflow: 'auto',
      ...style,
    }}
  >
    {children}
  </div>
);
