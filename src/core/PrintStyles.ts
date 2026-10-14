import { PageGeometry } from './PageFlow';

export interface PrintStyleOptions {
  /**
   * Prints the document alone: everything else on the host page is hidden, and every
   * ancestor of the document is unclipped and unpadded so the first sheet starts exactly
   * at the top of the first printed page.
   */
  isolate?: boolean;
}

/**
 * Print stylesheet for a `PagedDocument`. Paper reproduces the screen: each sheet becomes
 * one printed page, with the same line breaks, margins, headers and footers. The paper is
 * the size of a sheet with no margin of its own, the gutters between sheets collapse, and
 * zoom is dropped. Sheets print white whatever the theme.
 */
export function buildPrintStyles(geometry: PageGeometry, options: PrintStyleOptions = {}): string {
  const { width, height } = geometry;

  const isolation = options.isolate
    ? 'html,body{height:auto!important;overflow:visible!important;background:#fff!important}' +
      'body :not(:has(.PagedDocument)):not(.PagedDocument):not(.PagedDocument *)' +
      '{display:none!important}' +
      'body :has(.PagedDocument){display:block!important;position:static!important;' +
      'overflow:visible!important;width:auto!important;height:auto!important;' +
      'min-height:0!important;max-height:none!important;margin:0!important;' +
      'padding:0!important;border:0!important;transform:none!important;' +
      'box-shadow:none!important;background:none!important}'
    : '';

  return (
    '@media print{' +
    `@page{size:${width}px ${height}px;margin:0}` +
    `.PagedDocument{width:${width}px!important;height:auto!important;` +
    'print-color-adjust:exact;-webkit-print-color-adjust:exact}' +
    '.PagedDocumentStage{position:relative!important;height:auto!important;' +
    'transform:none!important;--platen-gutter:0px!important}' +
    '.PagedDocument .PagedSheet{background:#fff!important;box-shadow:none!important;' +
    'border:0!important;break-inside:avoid}' +
    // The rail has already placed every line. Stop the print engine from moving lines
    // between pages itself, which would shift everything after them.
    '.PagedDocumentContent,.PagedDocumentContent *{widows:1!important;orphans:1!important;' +
    'break-before:auto!important;break-after:auto!important;break-inside:auto!important}' +
    isolation +
    '}'
  );
}
