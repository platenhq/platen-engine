import React, { useEffect, useRef, useState } from 'react';
import {
  GraphicTrackItem,
  PageMargins,
  PageSlice,
  ParagraphTrackItem,
  TableColumnResizePayload,
  TableRowBlock,
  TableTrackItem,
  TrackItem,
} from '../core/Types';
import { AccessibilityMesh } from '../renderer/AccessibilityMesh';
import { MicroCanvasRenderer } from '../renderer/MicroCanvas';

const sharedRenderer = new MicroCanvasRenderer();

export interface PageInfo {
  pageNumber: number;
  totalPages: number;
}

export interface PagedSheetProps {
  pageNumber?: number;
  totalPages?: number;
  width?: number;
  height?: number;
  margins?: PageMargins;
  page?: PageSlice;
  dpr?: number;
  className?: string;
  style?: React.CSSProperties;
  renderHeader?: ((info: PageInfo) => React.ReactNode) | ((page: PageSlice) => React.ReactNode);
  renderFooter?: ((info: PageInfo) => React.ReactNode) | ((page: PageSlice) => React.ReactNode);
  children?: React.ReactNode;
  onTableColumnResize?: (payload: TableColumnResizePayload) => void;
}

// ---------------------------------------------------------------------------
// 1. Paragraph Track View (Canvas + Accessibility Mesh)
// ---------------------------------------------------------------------------
const ParagraphTrackView: React.FC<{ track: ParagraphTrackItem; dpr?: number }> = React.memo(
  ({ track, dpr }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
      if (canvasRef.current) {
        sharedRenderer.renderTrack(canvasRef.current, track, { dpr });
      }
    }, [track, dpr]);

    const fullText = track.lines ? track.lines.map((l) => l.text).join(' ') : '';

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
  }
);

ParagraphTrackView.displayName = 'ParagraphTrackView';

// ---------------------------------------------------------------------------
// 2. Table Column Resize Grabber
// ---------------------------------------------------------------------------
const TableColumnResizeHandle: React.FC<{
  tableId: string;
  colIndex: number;
  left: number;
  height: number;
  currentWidth: number;
  onResize?: (payload: TableColumnResizePayload) => void;
}> = ({ tableId, colIndex, left, height, currentWidth, onResize }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(currentWidth);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(30, startWidthRef.current + delta);
      onResize?.({ tableId, colIndex, width: newWidth });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      className="ColumnGrabber"
      onMouseDown={handleMouseDown}
      title="Drag to resize column"
      style={{
        position: 'absolute',
        top: 0,
        left: `${left - 4}px`,
        width: '8px',
        height: `${height}px`,
        cursor: 'col-resize',
        zIndex: 10,
        backgroundColor: isDragging ? '#3b82f6' : 'transparent',
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// 3. Table Track View (DOM Table + Cell Tracks + Resize Grabbers)
// ---------------------------------------------------------------------------
const TableTrackView: React.FC<{
  track: TableTrackItem;
  onTableColumnResize?: (payload: TableColumnResizePayload) => void;
}> = React.memo(({ track, onTableColumnResize }) => {
  let cumulativeLeft = 0;
  const colBoundaries = track.columnWidths.map((w, idx) => {
    cumulativeLeft += w;
    return { colIndex: idx, left: cumulativeLeft, width: w };
  });

  return (
    <div
      className="TableContainer Ltr"
      data-tableid={track.tableId}
      data-trackid={track.id}
      style={{
        position: 'absolute',
        left: `${track.x}px`,
        top: `${track.y}px`,
        width: `${track.width}px`,
        minHeight: `${track.height}px`,
        contain: 'layout',
      }}
    >
      <table
        className="Table Ltr TableWordWrap"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          border: '1px solid #d1d5db',
        }}
      >
        <colgroup>
          {track.columnWidths.map((w, idx) => (
            <col key={idx} style={{ width: `${w}px` }} />
          ))}
        </colgroup>
        <tbody>
          {track.rows.map((row: TableRowBlock) => (
            <tr
              key={row.id}
              style={{
                minHeight: row.height ? `${row.height}px` : undefined,
              }}
            >
              {row.cells.map((cell) => (
                <td
                  key={cell.id}
                  colSpan={cell.colSpan}
                  rowSpan={cell.rowSpan}
                  data-cellid={cell.id}
                  style={{
                    border: '1px solid #d1d5db',
                    padding: '6px 8px',
                    verticalAlign: 'top',
                    position: 'relative',
                    backgroundColor: cell.backgroundColor || 'transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  <div className="CellContainer">
                    {cell.blocks.map((p) => (
                      <div
                        key={p.id}
                        className="CellParagraph"
                        data-paraid={p.id}
                        style={{
                          minHeight: '20px',
                          lineHeight: '1.5',
                          color: '#111827',
                          fontFamily: p.runs[0]?.style?.fontFamily || 'Calibri, Arial, sans-serif',
                          fontSize: p.runs[0]?.style?.fontSize
                            ? `${p.runs[0].style.fontSize}px`
                            : '15px',
                          textAlign: p.align || 'left',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {p.runs.map((r, rIdx) => (
                          <span
                            key={rIdx}
                            style={{
                              fontWeight: r.style?.fontWeight || 'normal',
                              fontStyle: r.style?.fontStyle || 'normal',
                              textDecoration: r.style?.underline
                                ? 'underline'
                                : r.style?.strikethrough
                                  ? 'line-through'
                                  : r.style?.textDecoration || 'none',
                              color: r.style?.color || 'inherit',
                            }}
                          >
                            {r.text}
                          </span>
                        ))}
                        {p.runs.length === 0 && <br />}
                      </div>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Draggable Column Grabbers on borders (all but the rightmost border) */}
      {colBoundaries.slice(0, -1).map((b) => (
        <TableColumnResizeHandle
          key={b.colIndex}
          tableId={track.tableId}
          colIndex={b.colIndex}
          left={b.left}
          height={track.height}
          currentWidth={b.width}
          onResize={onTableColumnResize}
        />
      ))}
    </div>
  );
});

TableTrackView.displayName = 'TableTrackView';

// ---------------------------------------------------------------------------
// 4. Graphic Track View (Authentic Image DOM Element)
// ---------------------------------------------------------------------------
const GraphicTrackView: React.FC<{ track: GraphicTrackItem }> = React.memo(({ track }) => {
  return (
    <div
      className="GraphicTrackItem"
      data-imageid={track.imageId}
      data-trackid={track.id}
      style={{
        position: 'absolute',
        left: `${track.x}px`,
        top: `${track.y}px`,
        width: `${track.width}px`,
        height: `${track.height}px`,
        userSelect: 'none',
        contain: 'size layout',
      }}
    >
      <img
        src={track.src}
        alt={track.altText || ''}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        }}
        draggable={false}
      />
    </div>
  );
});

GraphicTrackView.displayName = 'GraphicTrackView';

// ---------------------------------------------------------------------------
// 5. Unified Track Item Dispatcher
// ---------------------------------------------------------------------------
interface TrackItemViewProps {
  track: TrackItem;
  dpr?: number;
  onTableColumnResize?: (payload: TableColumnResizePayload) => void;
}

const TrackItemView: React.FC<TrackItemViewProps> = React.memo(
  ({ track, dpr, onTableColumnResize }) => {
    if (track.type === 'table') {
      return <TableTrackView track={track} onTableColumnResize={onTableColumnResize} />;
    }

    if (track.type === 'image') {
      return <GraphicTrackView track={track} />;
    }

    return <ParagraphTrackView track={track} dpr={dpr} />;
  }
);

TrackItemView.displayName = 'TrackItemView';

// ---------------------------------------------------------------------------
// 6. Discrete Physical Paper Sheet Component
// ---------------------------------------------------------------------------
export const PagedSheet: React.FC<PagedSheetProps> = ({
  pageNumber,
  totalPages,
  width,
  height,
  margins,
  page,
  dpr,
  className,
  style,
  renderHeader,
  renderFooter,
  children,
  onTableColumnResize,
}) => {
  const actualPageNumber = pageNumber ?? page?.pageNumber ?? 1;
  const actualTotalPages = totalPages ?? 1;
  const actualWidth = width ?? page?.width ?? 816;
  const actualHeight = height ?? page?.height ?? 1056;
  const actualMargins: PageMargins = margins ??
    page?.margins ?? {
      top: 96,
      bottom: 96,
      left: 96,
      right: 96,
    };
  const usableWidth = page?.usableWidth ?? actualWidth - actualMargins.left - actualMargins.right;
  const usableHeight =
    page?.usableHeight ?? actualHeight - actualMargins.top - actualMargins.bottom;
  const pageInfo: PageInfo = { pageNumber: actualPageNumber, totalPages: actualTotalPages };

  return (
    <div
      className={`PagedSheet ${className || ''}`.trim()}
      data-page-number={actualPageNumber}
      style={{
        position: 'relative',
        width: `${actualWidth}px`,
        height: `${actualHeight}px`,
        backgroundColor: '#ffffff',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        contain: children ? 'none' : 'strict',
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
            left: `${actualMargins.left}px`,
            width: `${usableWidth}px`,
            height: `${actualMargins.top}px`,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {(renderHeader as any)(page || pageInfo)}
        </div>
      )}

      {/* Usable Printable Section */}
      <div
        className="Section"
        style={{
          position: 'absolute',
          left: `${actualMargins.left}px`,
          top: `${actualMargins.top}px`,
          width: `${usableWidth}px`,
          height: `${usableHeight}px`,
          contain: children ? 'none' : 'size layout',
        }}
      >
        {children !== undefined
          ? children
          : page
            ? page.tracks.map((track) => (
                <TrackItemView
                  key={track.id}
                  track={track}
                  dpr={dpr}
                  onTableColumnResize={onTableColumnResize}
                />
              ))
            : null}
      </div>

      {/* Footer Margin Zone */}
      {renderFooter && (
        <div
          className="PageFooterZone"
          style={{
            position: 'absolute',
            bottom: 0,
            left: `${actualMargins.left}px`,
            width: `${usableWidth}px`,
            height: `${actualMargins.bottom}px`,
            overflow: 'hidden',
            pointerEvents: 'none',
          }}
        >
          {(renderFooter as any)(page || pageInfo)}
        </div>
      )}
    </div>
  );
};
