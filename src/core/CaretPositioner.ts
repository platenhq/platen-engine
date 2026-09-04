import { MetricEngine } from './MetricEngine';
import {
  CaretCoordinates,
  CaretPointResult,
  DocumentPosition,
  DocumentSelection,
  SelectionRect,
} from './SelectionTypes';
import { PageSlice, TextLine, TrackItem } from './Types';

/**
 * Bidirectional coordinate solver.
 * Maps between document character offsets and canvas (X, Y) pixel positions,
 * and generates precise selection highlight rectangles across multi-page tracks.
 */
export class CaretPositioner {
  private metricEngine: MetricEngine;

  constructor(metricEngine?: MetricEngine) {
    this.metricEngine = metricEngine || new MetricEngine();
  }

  /**
   * Resolves the visual (X, Y) pixel coordinates of a text character offset within a document.
   */
  public getCaretCoordinates(
    pages: PageSlice[],
    paraId: string,
    charOffset: number
  ): CaretCoordinates | null {
    for (const page of pages) {
      for (const track of page.tracks) {
        if (track.paraId !== paraId) continue;

        let lineYInTrack = 0;

        for (let l = 0; l < track.lines.length; l++) {
          const line = track.lines[l];
          const isLastLineInTrack = l === track.lines.length - 1;
          const isTargetLine =
            charOffset >= line.startIndex &&
            (charOffset < line.endIndex || (isLastLineInTrack && charOffset <= line.endIndex));

          if (isTargetLine) {
            const xOffsetInLine = this.measureSubstrWidth(line, line.startIndex, charOffset);
            return {
              pageIndex: page.pageIndex,
              trackId: track.id,
              paraId,
              charOffset,
              x: track.x + xOffsetInLine,
              y: track.y + lineYInTrack,
              height: line.height,
            };
          }

          lineYInTrack += line.height;
        }
      }
    }

    return null;
  }

  /**
   * Resolves the closest document position from a mouse click (X, Y) coordinate on a page.
   */
  public getCharacterOffsetAtPoint(
    pages: PageSlice[],
    pageIndex: number,
    clickX: number,
    clickY: number
  ): CaretPointResult | null {
    const page = pages[pageIndex];
    if (!page || page.tracks.length === 0) return null;

    // Find the track item containing or closest to clickY
    let targetTrack: TrackItem = page.tracks[0];
    let minTrackDist = Infinity;

    for (const track of page.tracks) {
      if (clickY >= track.y && clickY <= track.y + track.height) {
        targetTrack = track;
        break;
      }
      const dist = Math.min(
        Math.abs(clickY - track.y),
        Math.abs(clickY - (track.y + track.height))
      );
      if (dist < minTrackDist) {
        minTrackDist = dist;
        targetTrack = track;
      }
    }

    // Find the line in the track containing or closest to clickY
    let lineYInTrack = 0;
    let targetLine: TextLine = targetTrack.lines[0];
    let targetLineY = targetTrack.y;

    for (let l = 0; l < targetTrack.lines.length; l++) {
      const line = targetTrack.lines[l];
      const lineTop = targetTrack.y + lineYInTrack;
      const lineBottom = lineTop + line.height;

      if (clickY >= lineTop && clickY <= lineBottom) {
        targetLine = line;
        targetLineY = lineTop;
        break;
      }

      if (l === targetTrack.lines.length - 1) {
        targetLine = line;
        targetLineY = lineTop;
      }

      lineYInTrack += line.height;
    }

    // Resolve nearest character boundary on targetLine to clickX
    const relativeX = Math.max(0, clickX - targetTrack.x);
    let bestCharOffset = targetLine.startIndex;
    let bestX = 0;
    let minXDist = Infinity;

    for (let c = targetLine.startIndex; c <= targetLine.endIndex; c++) {
      const w = this.measureSubstrWidth(targetLine, targetLine.startIndex, c);
      const dist = Math.abs(relativeX - w);

      if (dist < minXDist) {
        minXDist = dist;
        bestCharOffset = c;
        bestX = w;
      }
    }

    return {
      pageIndex,
      trackId: targetTrack.id,
      paraId: targetTrack.paraId,
      charOffset: bestCharOffset,
      snappedX: targetTrack.x + bestX,
      snappedY: targetLineY,
      lineHeight: targetLine.height,
    };
  }

  /**
   * Computes bounding rectangles for an active selection range across pages and tracks.
   */
  public computeSelectionRects(pages: PageSlice[], selection: DocumentSelection): SelectionRect[] {
    if (selection.isCollapsed) return [];

    const { start, end } = this.normalizeSelection(pages, selection.anchor, selection.head);
    const rects: SelectionRect[] = [];
    let isInsideSelection = false;

    for (const page of pages) {
      for (const track of page.tracks) {
        let lineYInTrack = 0;

        for (const line of track.lines) {
          const lineStart = line.startIndex;
          const lineEnd = line.endIndex;

          const isStartLine =
            track.paraId === start.paraId &&
            start.charOffset <= lineEnd &&
            start.charOffset >= lineStart;
          const isEndLine =
            track.paraId === end.paraId && end.charOffset >= lineStart && end.charOffset <= lineEnd;

          if (isStartLine) {
            isInsideSelection = true;
          }

          if (isInsideSelection) {
            const selStartOffset =
              track.paraId === start.paraId ? Math.max(lineStart, start.charOffset) : lineStart;
            const selEndOffset =
              track.paraId === end.paraId ? Math.min(lineEnd, end.charOffset) : lineEnd;

            if (selEndOffset > selStartOffset) {
              const startX = this.measureSubstrWidth(line, lineStart, selStartOffset);
              const endX = this.measureSubstrWidth(line, lineStart, selEndOffset);
              const width = Math.max(2, endX - startX);

              rects.push({
                id: `sel_${page.pageIndex}_${track.id}_${lineStart}`,
                pageIndex: page.pageIndex,
                trackId: track.id,
                paraId: track.paraId,
                x: track.x + startX,
                y: track.y + lineYInTrack,
                width,
                height: line.height,
              });
            }
          }

          if (isEndLine) {
            isInsideSelection = false;
          }

          lineYInTrack += line.height;
        }
      }
    }

    return rects;
  }

  /**
   * Measures text substring width within a line's runs from startOffset to endOffset.
   */
  private measureSubstrWidth(line: TextLine, fromOffset: number, toOffset: number): number {
    if (toOffset <= fromOffset) return 0;

    let totalWidth = 0;
    let currentCharIndex = line.startIndex;

    for (const run of line.runs) {
      const runText = run.text;
      const runEnd = currentCharIndex + runText.length;

      const overlapStart = Math.max(fromOffset, currentCharIndex);
      const overlapEnd = Math.min(toOffset, runEnd);

      if (overlapEnd > overlapStart) {
        const sliceStart = overlapStart - currentCharIndex;
        const sliceEnd = overlapEnd - currentCharIndex;
        const subStr = runText.slice(sliceStart, sliceEnd);
        const fontString = this.metricEngine.getFontString(run.style as never);
        totalWidth += this.metricEngine.measureText(
          subStr,
          fontString,
          run.style?.letterSpacing || 0
        );
      }

      currentCharIndex = runEnd;
    }

    return Math.round(totalWidth * 2) / 2;
  }

  /**
   * Sorts anchor and head into chronological document order (start, end).
   */
  private normalizeSelection(
    pages: PageSlice[],
    anchor: DocumentPosition,
    head: DocumentPosition
  ): { start: DocumentPosition; end: DocumentPosition } {
    if (anchor.paraId === head.paraId) {
      return anchor.charOffset <= head.charOffset
        ? { start: anchor, end: head }
        : { start: head, end: anchor };
    }

    // Traverse document to find which paragraph appears first
    for (const page of pages) {
      for (const track of page.tracks) {
        if (track.paraId === anchor.paraId) {
          return { start: anchor, end: head };
        }
        if (track.paraId === head.paraId) {
          return { start: head, end: anchor };
        }
      }
    }

    return { start: anchor, end: head };
  }
}
