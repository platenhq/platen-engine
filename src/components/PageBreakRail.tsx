import React from 'react';
import { SpacerSegment } from '../core/PageFlow';

export interface PageBreakRailProps {
  /** Ascending, non-overlapping bands of the flow that no line may occupy. */
  segments: SpacerSegment[];
}

/**
 * Zero-height rail of full-width floats, one per page boundary. Lines of any following
 * content in the same block formatting context cannot sit beside a float, so the browser
 * moves them below it, onto the next page. The rail must precede the content in the DOM.
 */
export const PageBreakRail: React.FC<PageBreakRailProps> = ({ segments }) => {
  let previousBottom = 0;

  return (
    <div
      className="PageBreakRail"
      aria-hidden="true"
      contentEditable={false}
      suppressContentEditableWarning
      style={{ height: 0, userSelect: 'none', pointerEvents: 'none' }}
    >
      {segments.map(({ top, height }) => {
        const offset = top - previousBottom;
        previousBottom = top + height;

        return (
          <React.Fragment key={top}>
            {/* A float's margin box also excludes lines, so the spacer is positioned by a
                zero-width strut instead of a top margin. */}
            <div
              className="PageBreakStrut"
              style={{ float: 'left', clear: 'left', width: 0, height: `${offset}px` }}
            />
            <div
              className="PageBreakSpacer"
              style={{
                float: 'left',
                clear: 'left',
                // Wider than the column so no line finds room beside it.
                width: 'calc(100% + 2px)',
                marginLeft: '-1px',
                height: `${height}px`,
              }}
            />
          </React.Fragment>
        );
      })}
    </div>
  );
};
