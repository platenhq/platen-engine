import { describe, expect, it } from 'vitest';
import { ProseMirrorAdapter } from '../src/adapters/prosemirror/ProseMirrorAdapter';
import { LayoutSlicer } from '../src/core/LayoutSlicer';

describe('ProseMirrorAdapter', () => {
  const adapter = new ProseMirrorAdapter();
  const slicer = new LayoutSlicer();

  it('translates ProseMirror document JSON structure into ParagraphBlocks', () => {
    const pmDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { id: 'pm_h1', level: 1 },
          content: [
            {
              type: 'text',
              text: 'ProseMirror Heading',
              marks: [{ type: 'strong' }],
            },
          ],
        },
        {
          type: 'paragraph',
          attrs: { id: 'pm_p1' },
          content: [
            {
              type: 'text',
              text: 'Standard paragraph with ',
            },
            {
              type: 'text',
              text: 'emphasized text',
              marks: [{ type: 'em' }],
            },
            {
              type: 'text',
              text: ' and custom colored font.',
              marks: [
                {
                  type: 'textStyle',
                  attrs: { color: '#2563eb', fontSize: 18 },
                },
              ],
            },
          ],
        },
      ],
    };

    const blocks = adapter.extractParagraphBlocks(pmDoc);

    expect(blocks).toHaveLength(2);

    // Block 1
    expect(blocks[0].id).toBe('pm_h1');
    expect(blocks[0].defaultStyle?.fontSize).toBe(32);
    expect(blocks[0].runs[0].text).toBe('ProseMirror Heading');
    expect(blocks[0].runs[0].style?.fontWeight).toBe('bold');

    // Block 2
    expect(blocks[1].id).toBe('pm_p1');
    expect(blocks[1].runs).toHaveLength(3);
    expect(blocks[1].runs[1].style?.fontStyle).toBe('italic');
    expect(blocks[1].runs[2].style?.color).toBe('#2563eb');
    expect(blocks[1].runs[2].style?.fontSize).toBe(18);

    // Layout pagination check
    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0].tracks.length).toBe(2);
  });
});
