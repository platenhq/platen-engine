import { TextStyle } from './Types';

export interface TextMetricsResult {
  width: number;
  height: number;
  ascent: number;
  descent: number;
}

/**
 * Headless font measurement engine.
 * Employs OffscreenCanvas where available, with deterministic fallback for Node / headless test environments.
 * Results are cached and normalized to 0.5px subpixel grids.
 */
export class MetricEngine {
  private canvas?: OffscreenCanvas;
  private ctx?: OffscreenCanvasRenderingContext2D | null;
  private cache = new Map<string, number>();

  constructor() {
    if (typeof OffscreenCanvas !== 'undefined') {
      try {
        this.canvas = new OffscreenCanvas(1000, 100);
        this.ctx = this.canvas.getContext('2d');
      } catch {
        this.canvas = undefined;
        this.ctx = undefined;
      }
    }
  }

  /**
   * Formats a CSS font shorthand string from a TextStyle.
   */
  public getFontString(style: TextStyle): string {
    const fontStyle = style.fontStyle || 'normal';
    const fontWeight = style.fontWeight || 'normal';
    const fontSize = `${style.fontSize}px`;
    const fontFamily = style.fontFamily || 'Arial, sans-serif';
    return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`.trim();
  }

  /**
   * Measures text width in pixels for a given font string, cached and rounded to 0.5px.
   */
  public measureText(text: string, fontString: string, letterSpacing = 0): number {
    if (!text || text.length === 0) {
      return 0;
    }

    const cacheKey = `${fontString}|ls:${letterSpacing}|${text}`;
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }

    let rawWidth: number;

    if (this.ctx) {
      this.ctx.font = fontString;
      // letterSpacing support on CanvasRenderingContext2D is experimental in some browsers
      if ('letterSpacing' in this.ctx && letterSpacing !== 0) {
        (this.ctx as unknown as { letterSpacing: string }).letterSpacing = `${letterSpacing}px`;
      }
      rawWidth = this.ctx.measureText(text).width;
    } else {
      // Deterministic fallback for Node / unit test environments
      rawWidth = this.fallbackMeasureText(text, fontString);
    }

    if (letterSpacing !== 0 && (!this.ctx || !('letterSpacing' in this.ctx))) {
      rawWidth += (text.length - 1) * letterSpacing;
    }

    // Subpixel normalization (0.5px grid rounding)
    const normalized = Math.round(rawWidth * 2) / 2;
    this.cache.set(cacheKey, normalized);
    return normalized;
  }

  /**
   * Computes full vertical & horizontal metrics for a text run.
   */
  public getRunMetrics(text: string, style: TextStyle): TextMetricsResult {
    const fontString = this.getFontString(style);
    const width = this.measureText(text, fontString, style.letterSpacing || 0);

    const fontSize = style.fontSize;
    const lineHeight = style.lineHeight || Math.round(fontSize * 1.3);
    const ascent = Math.round(fontSize * 0.8 * 2) / 2;
    const descent = Math.round((lineHeight - ascent) * 2) / 2;

    return {
      width,
      height: lineHeight,
      ascent,
      descent,
    };
  }

  /**
   * Clear the measurement cache to free memory.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Deterministic character-width estimation for environments without native canvas (e.g. Node test runner).
   */
  private fallbackMeasureText(text: string, fontString: string): number {
    // Extract font size
    const sizeMatch = fontString.match(/(\d+(?:\.\d+)?)px/);
    const fontSize = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
    const isBold = /bold|[6-9]00/i.test(fontString);

    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      let charRatio = 0.55; // default average width ratio relative to font size

      if (/[ilI1.,:;!'|` ]/.test(char)) {
        charRatio = 0.28;
      } else if (/[mwMW@#%&]/.test(char)) {
        charRatio = 0.85;
      } else if (/[A-Z]/.test(char)) {
        charRatio = 0.68;
      } else if (/[0-9]/.test(char)) {
        charRatio = 0.56;
      }

      if (isBold) {
        charRatio *= 1.08;
      }

      totalWidth += charRatio * fontSize;
    }

    return totalWidth;
  }
}
