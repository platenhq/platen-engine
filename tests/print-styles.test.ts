import { describe, expect, it } from 'vitest';
import { resolvePageGeometry } from '../src/core/PageFlow';
import { buildPrintStyles } from '../src/core/PrintStyles';

describe('PrintStyles', () => {
  it('makes the paper the size of a sheet with no margin of its own', () => {
    expect(buildPrintStyles(resolvePageGeometry())).toContain('@page{size:816px 1056px;margin:0}');
    expect(buildPrintStyles(resolvePageGeometry({ pageSize: 'a4' }))).toContain(
      '@page{size:794px 1123px;margin:0}'
    );
  });

  it('applies only when printing', () => {
    const css = buildPrintStyles(resolvePageGeometry());
    expect(css.startsWith('@media print{')).toBe(true);
    expect(css.endsWith('}')).toBe(true);
  });

  it('collapses gutters and drops zoom', () => {
    const css = buildPrintStyles(resolvePageGeometry());
    expect(css).toContain('--platen-gutter:0px!important');
    expect(css).toContain('transform:none!important');
  });

  it('prints sheets white without shadows, whatever the theme', () => {
    expect(buildPrintStyles(resolvePageGeometry())).toContain(
      '.PagedDocument .PagedSheet{background:#fff!important;box-shadow:none!important'
    );
  });

  it('stops the print engine from moving lines between pages', () => {
    const css = buildPrintStyles(resolvePageGeometry());
    expect(css).toContain('widows:1!important;orphans:1!important');
    expect(css).toContain('break-inside:auto!important');
  });

  it('isolates the document from the host page only on request', () => {
    expect(buildPrintStyles(resolvePageGeometry())).not.toContain(':has(.PagedDocument)');
    const css = buildPrintStyles(resolvePageGeometry(), { isolate: true });
    expect(css).toContain(
      'body :not(:has(.PagedDocument)):not(.PagedDocument):not(.PagedDocument *){display:none'
    );
    expect(css).toContain('body :has(.PagedDocument){display:block!important');
  });
});
