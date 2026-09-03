import { computeUsableBounds, resolvePageDimensions, resolvePageMargins } from './Geometry';
import { LineBreaker } from './LineBreaker';
import { EngineOptions, PageSlice, ParagraphBlock, TextLine, TrackItem } from './Types';

/**
 * Headless multi-page layout and track distribution engine.
 * Converts semantic ParagraphBlocks into discrete PageSlices containing TrackItems.
 * Implements strict CSS-containment compatible absolute positioning and widow/orphan prevention.
 */
export class LayoutSlicer {
  private lineBreaker: LineBreaker;

  constructor(lineBreaker?: LineBreaker) {
    this.lineBreaker = lineBreaker || new LineBreaker();
  }

  /**
   * Partitions an array of ParagraphBlocks into discrete PageSlices.
   */
  public paginate(blocks: ParagraphBlock[], options?: EngineOptions): PageSlice[] {
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
      const lines = this.lineBreaker.breakParagraph(block, usableWidth);
      if (lines.length === 0) continue;

      const spaceBefore = block.spaceBefore ?? 0;
      const spaceAfter = block.spaceAfter ?? 0;

      // Apply spaceBefore only if not at the very top of a blank page
      if (currentY > 0 && spaceBefore > 0) {
        if (currentY + spaceBefore < usableHeight) {
          currentY += spaceBefore;
        } else {
          // If spacing overflows, move to next page
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

          const track: TrackItem = {
            id: `${block.id}_track_${sliceIndex}`,
            paraId: block.id,
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
          // If page already has content, advance to next page
          if (currentY > 0) {
            currentPage = createNewPage();
            currentY = 0;
            continue;
          } else {
            // Page is fresh (currentY === 0) but line is taller than usableHeight!
            // We must place at least 1 line to avoid infinite loop
            linesFitting = 1;
          }
        }

        // Case C: Partial lines fit -> Slicing across page boundary needed
        // Apply Widow and Orphan prevention rules
        if (preventWidowsAndOrphans && remainingLines >= minLinesPerSlice) {
          const linesRemainingAfterFit = remainingLines - linesFitting;

          // Check for Orphan: fewer than minLinesPerSlice on current page
          if (linesFitting < minLinesPerSlice) {
            if (currentY > 0) {
              // Push the entire remaining block to the next page
              currentPage = createNewPage();
              currentY = 0;
              continue;
            }
            // If already at top of page, allow linesFitting as-is to avoid deadlock
          }
          // Check for Widow: fewer than minLinesPerSlice left for next page
          else if (linesRemainingAfterFit > 0 && linesRemainingAfterFit < minLinesPerSlice) {
            // Steal lines from current page to satisfy next page threshold
            const deficit = minLinesPerSlice - linesRemainingAfterFit;
            const adjustedFitting = linesFitting - deficit;

            if (adjustedFitting >= minLinesPerSlice) {
              linesFitting = adjustedFitting;
            } else if (currentY > 0) {
              // If taking lines causes an orphan on current page, defer entire block
              currentPage = createNewPage();
              currentY = 0;
              continue;
            }
          }
        }

        // Slice the lines into a TrackItem on current page
        const sliceLines = lines.slice(lineCursor, lineCursor + linesFitting);
        const trackHeight = this.sumLineHeights(sliceLines);

        const track: TrackItem = {
          id: `${block.id}_track_${sliceIndex}`,
          paraId: block.id,
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

  private sumLineHeights(lines: TextLine[]): number {
    return lines.reduce((acc, l) => acc + l.height, 0);
  }
}
