import { describe, expect, it, vi } from 'vitest';
import { TrackItem } from '../src/core/Types';
import { MicroCanvasRenderer } from '../src/renderer/MicroCanvas';

describe('MicroCanvasRenderer', () => {
  const renderer = new MicroCanvasRenderer();

  const mockTrack: TrackItem = {
    id: 'p1_track_0',
    paraId: 'p1',
    lineStart: 0,
    lineEnd: 1,
    x: 0,
    y: 0,
    width: 624,
    height: 48,
    isFirstSlice: true,
    isLastSlice: true,
    lines: [
      {
        text: 'First line of text',
        startIndex: 0,
        endIndex: 18,
        width: 150,
        height: 24,
        ascent: 18,
        runs: [{ text: 'First line of text', style: { fontSize: 16, color: '#000000' } }],
      },
      {
        text: 'Second line of text',
        startIndex: 19,
        endIndex: 38,
        width: 160,
        height: 24,
        ascent: 18,
        runs: [{ text: 'Second line of text', style: { fontSize: 16, color: '#000000' } }],
      },
    ],
  };

  function createMockCanvas(): HTMLCanvasElement {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      measureText: vi.fn().mockReturnValue({ width: 100 }),
      font: '',
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 1,
      textBaseline: 'alphabetic',
    };

    return {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
      getContext: vi.fn().mockReturnValue(mockCtx),
    } as unknown as HTMLCanvasElement;
  }

  it('scales internal canvas buffer with DPR while locking CSS style dimensions', () => {
    const canvas = createMockCanvas();
    const dpr = 2;

    renderer.renderTrack(canvas, mockTrack, { dpr });

    // Internal buffer must be scaled by DPR
    expect(canvas.width).toBe(mockTrack.width * dpr);
    expect(canvas.height).toBe(mockTrack.height * dpr);

    // CSS dimensions must match layout pixels
    expect(canvas.style.width).toBe(`${mockTrack.width}px`);
    expect(canvas.style.height).toBe(`${mockTrack.height}px`);
  });

  it('invokes context scale and draws each text run at the computed baseline', () => {
    const canvas = createMockCanvas();
    const dpr = 2;

    renderer.renderTrack(canvas, mockTrack, { dpr });

    const ctx = canvas.getContext('2d') as unknown as {
      scale: ReturnType<typeof vi.fn>;
      clearRect: ReturnType<typeof vi.fn>;
      fillText: ReturnType<typeof vi.fn>;
    };

    expect(ctx.scale).toHaveBeenCalledWith(dpr, dpr);
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, mockTrack.width, mockTrack.height);

    // Both lines must be drawn via fillText
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
    expect(ctx.fillText).toHaveBeenNthCalledWith(
      1,
      'First line of text',
      0,
      18 // line 1 ascent
    );
    expect(ctx.fillText).toHaveBeenNthCalledWith(
      2,
      'Second line of text',
      0,
      24 + 18 // line 1 height + line 2 ascent
    );
  });

  it('clears canvas when clear is invoked', () => {
    const canvas = createMockCanvas();
    canvas.width = 500;
    canvas.height = 100;

    renderer.clear(canvas);

    const ctx = canvas.getContext('2d') as unknown as {
      clearRect: ReturnType<typeof vi.fn>;
    };

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 500, 100);
  });
});
