import React from 'react';
import { SelectionRect } from '../core/SelectionTypes';

export interface SelectionOverlayProps {
  rects: SelectionRect[];
  color?: string;
  pageIndex?: number;
}

/**
 * Custom selection highlight renderer.
 * Draws semi-transparent highlight rectangles over text runs during mouse drag selections
 * without causing DOM text node splitting or layout shifts.
 */
export const SelectionOverlay: React.FC<SelectionOverlayProps> = ({
  rects,
  color = 'rgba(59, 130, 246, 0.28)',
  pageIndex,
}) => {
  if (!rects || rects.length === 0) return null;

  // If pageIndex is provided, render only the rects belonging to this page
  const filteredRects =
    pageIndex !== undefined ? rects.filter((r) => r.pageIndex === pageIndex) : rects;

  return (
    <div
      className="SelectionOverlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {filteredRects.map((rect) => (
        <div
          key={rect.id}
          className="SelectionHighlightRect"
          style={{
            position: 'absolute',
            left: `${rect.x}px`,
            top: `${rect.y}px`,
            width: `${rect.width}px`,
            height: `${rect.height}px`,
            backgroundColor: color,
            borderRadius: '1px',
            pointerEvents: 'none',
          }}
        />
      ))}
    </div>
  );
};
