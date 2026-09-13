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

  it('attaches to an editor reactively and handles updates and teardown', async () => {
    let registeredCallback: (() => void) | null = null;
    let blockVersion = 1;

    const mockAdapter = {
      extractParagraphBlocks: vi.fn(() => [
        {
          id: `b_${blockVersion}`,
          runs: [{ text: `Content version ${blockVersion}` }],
        },
      ]),
      subscribe: vi.fn((editor: unknown, cb: (blocks: ParagraphBlock[]) => void) => {
        return (editor as any).registerUpdateListener(() => {
          cb(mockAdapter.extractParagraphBlocks());
        });
      }),
    };

    const mockEditor = {
      registerUpdateListener: vi.fn((cb: () => void) => {
        registeredCallback = cb;
        return () => {
          registeredCallback = null;
        };
      }),
    };

    const bridge = new PagedEngineBridge({ adapter: mockAdapter as any });
    const listener = vi.fn();
    bridge.onLayoutChange(listener);

    const detach = bridge.attach(mockEditor);

    // Initial update scheduled
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(listener).toHaveBeenCalledTimes(1);
    expect(bridge.getBlocks()[0].id).toBe('b_1');

    // Trigger editor change
    blockVersion = 2;
    registeredCallback!();
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(listener).toHaveBeenCalledTimes(2);
    expect(bridge.getBlocks()[0].id).toBe('b_2');

    // Detach and verify teardown
    detach();
    expect(registeredCallback).toBeNull();
  });
});
