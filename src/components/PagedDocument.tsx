import React, { useEffect, useRef } from 'react';
import { getDocumentHeight, getSheetOffsets, PageFlowOptions } from '../core/PageFlow';
import { usePageFlow } from '../hooks/usePageFlow';
import { PageBreakRail } from './PageBreakRail';
import { PageInfo, PagedSheet } from './PagedSheet';

export interface PagedDocumentProps extends PageFlowOptions {
  /** The editor. Its content element must stay in the same formatting context as the rail. */
  children: React.ReactNode;
  zoom?: number;
  /** Selector for the element whose children are the document's top-level blocks. */
  contentSelector?: string;
  maxPages?: number;
  className?: string;
  sheetClassName?: string;
  sheetStyle?: React.CSSProperties;
  renderHeader?: (info: PageInfo) => React.ReactNode;
  renderFooter?: (info: PageInfo) => React.ReactNode;
  onPageCountChange?: (pageCount: number) => void;
}

const EMPTY_LINE_RULE =
  '.PagedDocumentContent :has(> br:only-child)::before' +
  '{content:"";display:inline-block;width:1px}';

/**
 * Paginates a natively editable document into discrete sheets without touching its DOM.
 * Sheets are painted behind the content; a `PageBreakRail` keeps every line of the content
 * out of the margins and gutters between them.
 */
export const PagedDocument: React.FC<PagedDocumentProps> = ({
  children,
  pageSize,
  margins,
  deskGutter,
  zoom = 1,
  contentSelector,
  maxPages,
  className,
  sheetClassName,
  sheetStyle,
  renderHeader,
  renderFooter,
  onPageCountChange,
}) => {
  const flowRef = useRef<HTMLDivElement | null>(null);
  const { pageCount, segments, geometry } = usePageFlow({
    flowRef,
    pageSize,
    margins,
    deskGutter,
    contentSelector,
    maxPages,
  });

  const onPageCountChangeRef = useRef(onPageCountChange);
  onPageCountChangeRef.current = onPageCountChange;
  useEffect(() => {
    onPageCountChangeRef.current?.(pageCount);
  }, [pageCount]);

  const { width, height, margins: pageMargins, usableWidth, usableHeight } = geometry;
  const documentHeight = getDocumentHeight(pageCount, geometry);
  const scale = zoom > 0 ? zoom : 1;

  return (
    <div
      className={`PagedDocument ${className || ''}`.trim()}
      style={{
        position: 'relative',
        width: `${width * scale}px`,
        height: `${documentHeight * scale}px`,
      }}
    >
      <div
        className="PagedDocumentStage"
        style={
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${width}px`,
            height: `${documentHeight}px`,
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
            '--platen-usable-width': `${usableWidth}px`,
            '--platen-usable-height': `${usableHeight}px`,
          } as React.CSSProperties
        }
      >
        {getSheetOffsets(pageCount, geometry).map((top, index) => (
          <PagedSheet
            key={index}
            pageNumber={index + 1}
            totalPages={pageCount}
            width={width}
            height={height}
            margins={pageMargins}
            className={sheetClassName}
            style={{ position: 'absolute', top: `${top}px`, left: 0, ...sheetStyle }}
            renderHeader={renderHeader}
            renderFooter={renderFooter}
          />
        ))}

        <div
          className="PagedDocumentFlow"
          style={{
            position: 'relative',
            display: 'flow-root',
            boxSizing: 'border-box',
            width: `${width}px`,
            padding: `${pageMargins.top}px ${pageMargins.right}px 0 ${pageMargins.left}px`,
          }}
        >
          {/* A line holding nothing but a break has no width, so it would fit beside a
              spacer. A 1px inline box gives it one. */}
          <style>{EMPTY_LINE_RULE}</style>
          <PageBreakRail segments={segments} />
          <div ref={flowRef} className="PagedDocumentContent">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
