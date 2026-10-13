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
