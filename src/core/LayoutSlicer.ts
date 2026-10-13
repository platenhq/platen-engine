import { computeUsableBounds, resolvePageDimensions, resolvePageMargins } from './Geometry';
import { LineBreaker } from './LineBreaker';
import {
  DocumentBlock,
  EngineOptions,
  GraphicTrackItem,
  PageSlice,
  ParagraphBlock,
  ParagraphTrackItem,
  TableRowBlock,
  TableTrackItem,
  TextLine,
  TrackItem,
} from './Types';

/**
 * Headless multi-page layout and track distribution engine.
 * Converts semantic DocumentBlocks (Paragraphs, Tables, Images) into discrete PageSlices containing TrackItems.
 * Implements strict CSS-containment compatible absolute positioning, offscreen row measurements, and widow/orphan prevention.
 */
export class LayoutSlicer {
  private lineBreaker: LineBreaker;

  constructor(lineBreaker?: LineBreaker) {
    this.lineBreaker = lineBreaker || new LineBreaker();
  }

  /**
   * Partitions an array of DocumentBlocks into discrete PageSlices.
   */
  public paginate(blocks: DocumentBlock[], options?: EngineOptions): PageSlice[] {
    const dims = resolvePageDimensions(options?.pageSize);
    const margins = resolvePageMargins(options?.margins);
    const { usableWidth, usableHeight } = computeUsableBounds(dims, margins);

    const preventWidowsAndOrphans = options?.preventWidowsAndOrphans ?? true;
    const minLinesPerSlice = options?.minLinesPerSlice ?? 2;

    const pages: PageSlice[] = [];

    const createNewPage = (): PageSlice => {
      const pageIndex = pages.length;
      const newPage: PageSlice = {
        pageIndex,
        pageNumber: pageIndex + 1,
        width: dims.width,
        height: dims.height,
        margins,
        usableWidth,
        usableHeight,
        tracks: [],
      };
      pages.push(newPage);
      return newPage;
    };

    let currentPage = createNewPage();
    let currentY = 0; // vertical position inside usable area (0 to usableHeight)

    for (const block of blocks) {
      // -------------------------------------------------------------
      // CASE 1: TableBlock (Table row slicing across page boundaries)
      // -------------------------------------------------------------
      if (block.type === 'table') {
        const spaceBefore = block.spaceBefore ?? 12;
        const spaceAfter = block.spaceAfter ?? 12;

        if (currentY > 0 && spaceBefore > 0) {
          if (currentY + spaceBefore < usableHeight) {
            currentY += spaceBefore;
          } else {
            currentPage = createNewPage();
            currentY = 0;
          }
        }

        const cols = Math.max(1, block.columns);
        const columnWidths =
          block.columnWidths && block.columnWidths.length === cols
            ? block.columnWidths
            : Array(cols).fill(Math.floor(usableWidth / cols));

        const rowHeights = block.rows.map((r) => this.computeRowHeight(r, columnWidths));

        let rowCursor = 0;
        let sliceIndex = 0;

        while (rowCursor < block.rows.length) {
          const availableHeight = usableHeight - currentY;
          let rowsFitting = 0;
          let fittingHeight = 0;

          for (let r = rowCursor; r < block.rows.length; r++) {
            const rH = rowHeights[r];
            if (fittingHeight + rH <= availableHeight) {
              fittingHeight += rH;
              rowsFitting++;
            } else {
              break;
            }
          }

          if (rowsFitting === 0) {
            if (currentY > 0) {
              currentPage = createNewPage();
              currentY = 0;
              continue;
            } else {
              // Giant row taller than page: place at least 1 row to prevent infinite loop
              rowsFitting = 1;
              fittingHeight = rowHeights[rowCursor];
            }
          }

          const sliceRows = block.rows.slice(rowCursor, rowCursor + rowsFitting);
          const track: TableTrackItem = {
            type: 'table',
            id: `${block.id}_track_${sliceIndex}`,
            tableId: block.id,
            rows: sliceRows,
            columnWidths,
            x: 0,
            y: currentY,
            width: usableWidth,
            height: fittingHeight,
            startRowIndex: rowCursor,
            endRowIndex: rowCursor + rowsFitting - 1,
            isFirstSlice: sliceIndex === 0,
            isLastSlice: rowCursor + rowsFitting >= block.rows.length,
          };

          currentPage.tracks.push(track);
          currentY += fittingHeight;
          rowCursor += rowsFitting;
          sliceIndex++;

          if (rowCursor < block.rows.length) {
            currentPage = createNewPage();
            currentY = 0;
          }
        }

        currentY += spaceAfter;
        continue;
      }

      // -------------------------------------------------------------
      // CASE 2: ImageBlock (GraphicTrackItem placement & deferral)
      // -------------------------------------------------------------
      if (block.type === 'image') {
        const spaceBefore = block.spaceBefore ?? 12;
        const spaceAfter = block.spaceAfter ?? 12;

        let imgWidth = block.width;
        let imgHeight = block.height;
        if (imgWidth > usableWidth) {
          const ratio = usableWidth / imgWidth;
          imgWidth = usableWidth;
          imgHeight = Math.round(imgHeight * ratio);
        }

        if (currentY > 0 && currentY + imgHeight + spaceBefore > usableHeight) {
          currentPage = createNewPage();
          currentY = 0;
        } else if (currentY > 0) {
          currentY += spaceBefore;
        }

        const track: GraphicTrackItem = {
          type: 'image',
          id: `${block.id}_track_0`,
          imageId: block.id,
          src: block.src,
          altText: block.altText,
          x: 0,
          y: currentY,
          width: imgWidth,
          height: imgHeight,
          isFirstSlice: true,
          isLastSlice: true,
        };

        currentPage.tracks.push(track);
        currentY += imgHeight + spaceAfter;
        continue;
      }

      // -------------------------------------------------------------
      // CASE 3: ParagraphBlock (Line breaking & paragraph slicing)
      // -------------------------------------------------------------
      const paraBlock = block as ParagraphBlock;
      const lines = this.lineBreaker.breakParagraph(paraBlock, usableWidth);
      if (lines.length === 0) continue;

      const spaceBefore = paraBlock.spaceBefore ?? 0;
      const spaceAfter = paraBlock.spaceAfter ?? 0;

      // Apply spaceBefore only if not at the very top of a blank page
      if (currentY > 0 && spaceBefore > 0) {
        if (currentY + spaceBefore < usableHeight) {
          currentY += spaceBefore;
        } else {
          currentPage = createNewPage();
          currentY = 0;
        }
      }

      let lineCursor = 0;
      let sliceIndex = 0;

      while (lineCursor < lines.length) {
        const remainingLines = lines.length - lineCursor;
        const availableHeight = usableHeight - currentY;

        // Calculate how many lines can fit in availableHeight
        let linesFitting = 0;
        let fittingHeight = 0;

        for (let i = lineCursor; i < lines.length; i++) {
          const lineH = lines[i].height;
          if (fittingHeight + lineH <= availableHeight) {
            fittingHeight += lineH;
            linesFitting++;
          } else {
            break;
          }
        }

        // Case A: Everything fits on the current page
        if (linesFitting >= remainingLines) {
          const sliceLines = lines.slice(lineCursor, lineCursor + remainingLines);
          const trackHeight = this.sumLineHeights(sliceLines);

          const track: ParagraphTrackItem = {
            type: 'paragraph',
            id: `${paraBlock.id}_track_${sliceIndex}`,
            paraId: paraBlock.id,
            lineStart: lineCursor,
            lineEnd: lines.length - 1,
            lines: sliceLines,
            x: 0,
            y: currentY,
            width: usableWidth,
            height: trackHeight,
            isFirstSlice: sliceIndex === 0,
            isLastSlice: true,
          };

          currentPage.tracks.push(track);
          currentY += trackHeight + spaceAfter;
          lineCursor += remainingLines;
          break;
        }

        // Case B: None of the remaining lines fit on current page
        if (linesFitting === 0) {
          if (currentY > 0) {
            currentPage = createNewPage();
            currentY = 0;
            continue;
          } else {
            linesFitting = 1;
          }
        }

        // Case C: Partial lines fit -> Slicing across page boundary needed
        if (preventWidowsAndOrphans && remainingLines >= minLinesPerSlice) {
          const linesRemainingAfterFit = remainingLines - linesFitting;

          if (linesFitting < minLinesPerSlice) {
            if (currentY > 0) {
              currentPage = createNewPage();
              currentY = 0;
              continue;
            }
          } else if (linesRemainingAfterFit > 0 && linesRemainingAfterFit < minLinesPerSlice) {
            const deficit = minLinesPerSlice - linesRemainingAfterFit;
            const adjustedFitting = linesFitting - deficit;

            if (adjustedFitting >= minLinesPerSlice) {
              linesFitting = adjustedFitting;
            } else if (currentY > 0) {
              currentPage = createNewPage();
              currentY = 0;
              continue;
            }
          }
        }

        // Slice the lines into a ParagraphTrackItem on current page
        const sliceLines = lines.slice(lineCursor, lineCursor + linesFitting);
        const trackHeight = this.sumLineHeights(sliceLines);

        const track: ParagraphTrackItem = {
          type: 'paragraph',
          id: `${paraBlock.id}_track_${sliceIndex}`,
          paraId: paraBlock.id,
          lineStart: lineCursor,
          lineEnd: lineCursor + linesFitting - 1,
          lines: sliceLines,
          x: 0,
          y: currentY,
          width: usableWidth,
          height: trackHeight,
          isFirstSlice: sliceIndex === 0,
          isLastSlice: false,
        };

        currentPage.tracks.push(track);
        lineCursor += linesFitting;
        sliceIndex++;

        // Advance to a new page for the remaining lines
        currentPage = createNewPage();
        currentY = 0;
      }
    }

    // Ensure at least 1 page always exists
    if (pages.length === 0) {
      createNewPage();
    }

    return pages;
  }

  /**
   * Measures table row height offscreen based on cell padding and column widths.
   */
  private computeRowHeight(row: TableRowBlock, columnWidths: number[]): number {
    if (row.height && row.height > 0) return row.height;

    let maxCellContentHeight = 24; // baseline height for empty cell

    row.cells.forEach((cell, idx) => {
      const colWidth = columnWidths[idx] || (columnWidths.length > 0 ? columnWidths[0] : 100);
      const innerWidth = Math.max(30, colWidth - 16); // 16px padding (8px left + 8px right)
      let cellHeight = 0;

      for (const p of cell.blocks) {
        const lines = this.lineBreaker.breakParagraph(p, innerWidth);
        const pHeight = lines.reduce((sum, l) => sum + l.height, 0);
        cellHeight += Math.max(20, pHeight);
      }

      if (cellHeight > maxCellContentHeight) {
        maxCellContentHeight = cellHeight;
      }
    });

    return maxCellContentHeight + 14; // add row cell padding & borders
  }

  private sumLineHeights(lines: TextLine[]): number {
    return lines.reduce((acc, l) => acc + l.height, 0);
  }
}
