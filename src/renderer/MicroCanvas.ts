import { TextStyle, TrackItem } from '../core/Types';

export interface MicroCanvasRenderOptions {
  dpr?: number;
}

/**
 * Framework-agnostic canvas text rasterizer.
 * Renders individual TrackItems onto discrete micro-canvas elements with High-DPI scaling.
 */
export class MicroCanvasRenderer {
  /**
   * Renders a TrackItem onto a target HTMLCanvasElement.
   */
  public renderTrack(
    canvas: HTMLCanvasElement,
    track: TrackItem,
    options?: MicroCanvasRenderOptions
  ): void {
    const dpr = options?.dpr ?? (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);

    // Compute pixel dimensions scaled for high-density displays
    const pixelWidth = Math.max(1, Math.round(track.width * dpr));
    const pixelHeight = Math.max(1, Math.round(track.height * dpr));

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    // Lock display bounds to exact CSS layout pixels
    canvas.style.width = `${track.width}px`;
    canvas.style.height = `${track.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, track.width, track.height);

    let currentLineY = 0;

    for (const line of track.lines) {
      const baselineY = currentLineY + line.ascent;
      let currentRunX = 0;

      for (const run of line.runs) {
        if (!run.text) continue;

        const fontString = this.formatFontString(run.style);
        ctx.font = fontString;
        ctx.fillStyle = run.style?.color || '#1a1a1a';
        ctx.textBaseline = 'alphabetic';

        ctx.fillText(run.text, currentRunX, baselineY);

        const runWidth = ctx.measureText(run.text).width;

        // Render text decoration if present (e.g. underline, line-through)
        const fontStyle = run.style as TextStyle & { textDecoration?: string };
        if (fontStyle?.textDecoration) {
          const decoration = fontStyle.textDecoration;
          ctx.strokeStyle = run.style?.color || '#1a1a1a';
          ctx.lineWidth = Math.max(1, (run.style?.fontSize || 16) / 16);

          if (decoration.includes('underline')) {
            const underlineY = baselineY + Math.max(2, (run.style?.fontSize || 16) * 0.15);
            ctx.beginPath();
            ctx.moveTo(currentRunX, underlineY);
            ctx.lineTo(currentRunX + runWidth, underlineY);
            ctx.stroke();
          }

          if (decoration.includes('line-through')) {
            const strikeY = baselineY - (run.style?.fontSize || 16) * 0.3;
            ctx.beginPath();
            ctx.moveTo(currentRunX, strikeY);
            ctx.lineTo(currentRunX + runWidth, strikeY);
            ctx.stroke();
          }
        }

        currentRunX += runWidth;
      }

      currentLineY += line.height;
    }

    ctx.restore();
  }

  /**
   * Clears the micro-canvas surface.
   */
  public clear(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  private formatFontString(style?: Partial<TextStyle>): string {
    const fontStyle = style?.fontStyle || 'normal';
    const fontWeight = style?.fontWeight || 'normal';
    const fontSize = `${style?.fontSize || 16}px`;
    const fontFamily = style?.fontFamily || 'Arial, sans-serif';
    return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`.trim();
  }
}
