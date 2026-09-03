import React, { useEffect, useRef } from 'react';
import { PageSlice, TrackItem } from '../core/Types';
import { AccessibilityMesh } from '../renderer/AccessibilityMesh';
import { MicroCanvasRenderer } from '../renderer/MicroCanvas';

const sharedRenderer = new MicroCanvasRenderer();

export interface PagedSheetProps {
  page: PageSlice;
  dpr?: number;
  className?: string;
  style?: React.CSSProperties;
  renderHeader?: (page: PageSlice) => React.ReactNode;
  renderFooter?: (page: PageSlice) => React.ReactNode;
}

interface TrackItemViewProps {
  track: TrackItem;
  dpr?: number;
}

/**
 * Individual paragraph track component.
 * Features strict CSS containment (contain: size layout) and renders to its own micro-canvas.
 */
const TrackItemView: React.FC<TrackItemViewProps> = React.memo(({ track, dpr }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      sharedRenderer.renderTrack(canvasRef.current, track, { dpr });
    }
  }, [track, dpr]);

  const fullText = track.lines.map((l) => l.text).join(' ');

  return (
    <div
      className="ParagraphTrackItem"
      data-paraid={track.paraId}
      data-trackid={track.id}
      style={{
        position: 'absolute',
        left: `${track.x}px`,
        top: `${track.y}px`,
        width: `${track.width}px`,
        height: `${track.height}px`,
        contain: 'size layout',
      }}
    >
      <canvas
        ref={canvasRef}
        className="CanvasParagraph"
        style={{
          display: 'block',
          width: `${track.width}px`,
          height: `${track.height}px`,
        }}
      />
      <AccessibilityMesh paraId={track.paraId} text={fullText} />
    </div>
  );
});

TrackItemView.displayName = 'TrackItemView';

/**
 * Discrete physical paper sheet component.
 * Uses strict CSS containment (contain: strict;) to prevent cross-page layout recalculations.
 */
export const PagedSheet: React.FC<PagedSheetProps> = ({
  page,
  dpr,
  className,
  style,
  renderHeader,
  renderFooter,
}) => {
  return (
    <div
      className={`PagedSheet ${className || ''}`.trim()}
      data-page-number={page.pageNumber}
      style={{
        position: 'relative',
        width: `${page.width}px`,
        height: `${page.height}px`,
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        contain: 'strict',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Header Margin Zone */}
      {renderHeader && (
        <div
          className="PageHeaderZone"
          style={{
            position: 'absolute',
            top: 0,
            left: `${page.margins.left}px`,
            width: `${page.usableWidth}px`,
            height: `${page.margins.top}px`,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {renderHeader(page)}
        </div>
      )}

      {/* Usable Printable Section */}
      <div
        className="Section"
        style={{
          position: 'absolute',
          left: `${page.margins.left}px`,
          top: `${page.margins.top}px`,
          width: `${page.usableWidth}px`,
          height: `${page.usableHeight}px`,
          contain: 'size layout',
        }}
      >
        {page.tracks.map((track) => (
          <TrackItemView key={track.id} track={track} dpr={dpr} />
        ))}
      </div>

      {/* Footer Margin Zone */}
      {renderFooter && (
        <div
          className="PageFooterZone"
          style={{
            position: 'absolute',
            bottom: 0,
            left: `${page.margins.left}px`,
            width: `${page.usableWidth}px`,
            height: `${page.margins.bottom}px`,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {renderFooter(page)}
        </div>
      )}
    </div>
  );
};
