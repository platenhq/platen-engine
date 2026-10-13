import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { calculatePagination } from '../src/core/PaginationMetrics';
import { PagedSheet, PageInfo } from '../src/components/PagedSheet';

describe('PaginationMetrics', () => {
  it('calculates single page for short content', () => {
    const result = calculatePagination({
      contentHeight: 400,
      pageHeight: 1056,
      pageWidth: 816,
      margins: { top: 96, bottom: 96, left: 96, right: 96 },
    });

    expect(result.usableHeight).toBe(864); // 1056 - 192
    expect(result.usableWidth).toBe(624); // 816 - 192
    expect(result.pageCount).toBe(1);
    expect(result.pageBreaks).toHaveLength(0);
  });

  it('calculates multiple pages and boundary break offsets for overflowing content', () => {
    // Usable height is 864px. 2000px requires ceil(2000 / 864) = 3 pages.
    const result = calculatePagination({
      contentHeight: 2000,
      pageHeight: 1056,
      pageWidth: 816,
      margins: { top: 96, bottom: 96, left: 96, right: 96 },
    });

    expect(result.pageCount).toBe(3);
    expect(result.pageBreaks).toEqual([864, 1728]);
  });

  it('handles zero or negative content height safely', () => {
    const result = calculatePagination({
      contentHeight: 0,
      pageHeight: 1056,
    });

    expect(result.pageCount).toBe(1);
    expect(result.pageBreaks).toHaveLength(0);
  });
});

describe('PagedSheet with Native Children', () => {
  it('renders native React children directly inside the printable Section', () => {
    const html = renderToStaticMarkup(
      <PagedSheet
        pageNumber={1}
        totalPages={3}
        width={816}
        height={1056}
        margins={{ top: 96, bottom: 96, left: 96, right: 96 }}
        renderHeader={(info: PageInfo) => (
          <div className="custom-header">
            Page {info.pageNumber} of {info.totalPages}
          </div>
        )}
        renderFooter={(info: PageInfo) => (
          <div className="custom-footer">Footer {info.pageNumber}</div>
        )}
      >
        <div className="native-editor-content">
          <p>Native Lexical / ProseMirror DOM node</p>
          <table className="native-table">
            <tbody>
              <tr>
                <td>Cell 1</td>
              </tr>
            </tbody>
          </table>
        </div>
      </PagedSheet>
    );

    expect(html).toContain('PagedSheet');
    expect(html).toContain('data-page-number="1"');
    expect(html).toContain('custom-header');
    expect(html).toContain('Page 1 of 3');
    expect(html).toContain('custom-footer');
    expect(html).toContain('Footer 1');
    expect(html).toContain('native-editor-content');
    expect(html).toContain('Native Lexical / ProseMirror DOM node');
    expect(html).toContain('native-table');
  });
});
