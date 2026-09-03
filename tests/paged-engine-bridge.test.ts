import { describe, expect, it, vi } from 'vitest';
import { PagedEngineBridge } from '../src/adapters/PagedEngineBridge';
import { ParagraphBlock } from '../src/core/Types';

describe('PagedEngineBridge', () => {
  const sampleBlocks: ParagraphBlock[] = [
    {
      id: 'b1',
      runs: [{ text: 'First block paragraph for bridge testing.' }],
    },
  ];

  it('synchronously sets blocks and emits layout update to listeners', () => {
    const bridge = new PagedEngineBridge();
    const listener = vi.fn();

    const unsubscribe = bridge.onLayoutChange(listener);
    const pages = bridge.setBlocks(sampleBlocks);

    expect(pages).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(pages);

    expect(bridge.getPages()).toBe(pages);
    expect(bridge.getBlocks()).toBe(sampleBlocks);

    unsubscribe();
  });

  it('schedules async updates and cleans up on destroy', async () => {
    const bridge = new PagedEngineBridge();
    const listener = vi.fn();

    bridge.onLayoutChange(listener);
    bridge.scheduleUpdate(sampleBlocks);

    // Wait for microtask / timeout tick
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(listener).toHaveBeenCalledTimes(1);

    bridge.destroy();
    expect(bridge.getPages()).toHaveLength(0);
  });
});
