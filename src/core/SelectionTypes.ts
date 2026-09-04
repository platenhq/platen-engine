export interface DocumentPosition {
  paraId: string;
  charOffset: number;
}

export interface DocumentSelection {
  anchor: DocumentPosition;
  head: DocumentPosition;
  isCollapsed: boolean;
}

export interface CaretCoordinates {
  pageIndex: number;
  trackId: string;
  paraId: string;
  charOffset: number;
  x: number;
  y: number;
  height: number;
}

export interface CaretPointResult {
  pageIndex: number;
  trackId: string;
  paraId: string;
  charOffset: number;
  snappedX: number;
  snappedY: number;
  lineHeight: number;
}

export interface SelectionRect {
  id: string;
  pageIndex: number;
  trackId: string;
  paraId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
