export type PageSizePreset = 'letter' | 'a4' | 'legal';

export interface PageDimensions {
  width: number;
  height: number;
}

export interface PageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface PageConfig {
  size: PageSizePreset | PageDimensions;
  margins: PageMargins;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number; // in px
  lineHeight: number; // line height in px
  fontWeight?: string | number;
  fontStyle?: 'normal' | 'italic' | 'oblique';
  color?: string;
  letterSpacing?: number;
  textDecoration?: string;
  underline?: boolean;
  strikethrough?: boolean;
}

export interface TextRun {
  text: string;
  style?: Partial<TextStyle>;
}

export interface TextLine {
  text: string;
  startIndex: number;
  endIndex: number;
  width: number;
  height: number;
  ascent: number;
  runs: TextRun[];
}

export interface ParagraphBlock {
  type?: 'paragraph';
  id: string; // paraid matching semantic AST node
  runs: TextRun[];
  defaultStyle?: TextStyle;
  align?: 'left' | 'center' | 'right' | 'justify';
  spaceBefore?: number;
  spaceAfter?: number;
}

export interface TableCellBlock {
  id: string;
  colSpan?: number;
  rowSpan?: number;
  width?: number;
  blocks: ParagraphBlock[];
  backgroundColor?: string;
}

export interface TableRowBlock {
  id: string;
  cells: TableCellBlock[];
  height?: number;
}

export interface TableBlock {
  type: 'table';
  id: string; // tableId matching Lexical TableNode
  columns: number;
  rows: TableRowBlock[];
  columnWidths?: number[];
  spaceBefore?: number;
  spaceAfter?: number;
}

export interface ImageBlock {
  type: 'image';
  id: string; // imageId matching Lexical ImageNode
  src: string;
  altText?: string;
  width: number;
  height: number;
  caption?: string;
  spaceBefore?: number;
  spaceAfter?: number;
}

export type DocumentBlock = ParagraphBlock | TableBlock | ImageBlock;

export interface ParagraphTrackItem {
  type?: 'paragraph';
  id: string; // unique track item ID (e.g. "p_100_track_0")
  paraId: string; // shared paraid across slices
  lineStart: number; // index of first line in block.lines
  lineEnd: number; // index of last line (inclusive)
  lines: TextLine[];
  x: number;
  y: number;
  width: number;
  height: number;
  isFirstSlice: boolean;
  isLastSlice: boolean;
}

export interface TableTrackItem {
  type: 'table';
  id: string;
  tableId: string;
  rows: TableRowBlock[];
  columnWidths: number[];
  x: number;
  y: number;
  width: number;
  height: number;
  startRowIndex: number;
  endRowIndex: number;
  isFirstSlice: boolean;
  isLastSlice: boolean;
}

export interface GraphicTrackItem {
  type: 'image';
  id: string;
  imageId: string;
  src: string;
  altText?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isFirstSlice: boolean;
  isLastSlice: boolean;
}

export type AnyTrackItem = ParagraphTrackItem | TableTrackItem | GraphicTrackItem;
export type TrackItem = ParagraphTrackItem | TableTrackItem | GraphicTrackItem;

export interface TableColumnResizePayload {
  tableId: string;
  colIndex: number;
  width: number;
}

export interface PageSlice {
  pageIndex: number; // 0-based
  pageNumber: number; // 1-based
  width: number;
  height: number;
  margins: PageMargins;
  usableWidth: number;
  usableHeight: number;
  tracks: TrackItem[];
}

export interface EngineOptions {
  pageSize?: PageSizePreset | PageDimensions;
  margins?: Partial<PageMargins>;
  preventWidowsAndOrphans?: boolean;
  minLinesPerSlice?: number;
  deskGutter?: number;
}
