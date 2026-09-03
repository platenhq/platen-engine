import { describe, expect, it, vi } from 'vitest';
import { LEXICAL_FORMAT, LexicalAdapter } from '../src/adapters/lexical/LexicalAdapter';
import { LayoutSlicer } from '../src/core/LayoutSlicer';

describe('LexicalAdapter', () => {
  const adapter = new LexicalAdapter();
  const slicer = new LayoutSlicer();

  it('translates serialized Lexical AST with formatting bitmasks into ParagraphBlocks', () => {
    const serializedLexical = {
      root: {
        children: [
          {
            key: 'p1',
            type: 'heading',
            tag: 'h1',
            children: [
              {
                text: 'Document Title',
                format: LEXICAL_FORMAT.BOLD,
              },
            ],
          },
          {
            key: 'p2',
            type: 'paragraph',
            children: [
              {
                text: 'Normal text, ',
                format: 0,
              },
              {
                text: 'bold text, ',
                format: LEXICAL_FORMAT.BOLD,
              },
              {
                text: 'italic underline text.',
                format: LEXICAL_FORMAT.ITALIC | LEXICAL_FORMAT.UNDERLINE,
              },
            ],
          },
        ],
      },
    };

    const blocks = adapter.extractParagraphBlocks(serializedLexical);

    expect(blocks).toHaveLength(2);

    // Block 1: H1 Heading
    expect(blocks[0].id).toBe('p1');
    expect(blocks[0].defaultStyle?.fontSize).toBe(32);
    expect(blocks[0].runs[0].text).toBe('Document Title');
    expect(blocks[0].runs[0].style?.fontWeight).toBe('bold');

    // Block 2: Multi-run Paragraph
    expect(blocks[1].id).toBe('p2');
    expect(blocks[1].runs).toHaveLength(3);
    expect(blocks[1].runs[1].style?.fontWeight).toBe('bold');
    expect(blocks[1].runs[2].style?.fontStyle).toBe('italic');
    expect(blocks[1].runs[2].style?.underline).toBe(true);

    // Verify it paginates cleanly through LayoutSlicer
    const pages = slicer.paginate(blocks, { pageSize: 'letter' });
    expect(pages.length).toBeGreaterThanOrEqual(1);
    expect(pages[0].tracks.length).toBe(2);
  });

  it('parses inline CSS declarations from Lexical text nodes', () => {
    const serialized = {
      root: {
        children: [
          {
            key: 'styled_p',
            type: 'paragraph',
            children: [
              {
                text: 'Colored and sized text',
                format: 0,
                style: 'font-size: 22px; color: #ff0000; font-family: Georgia;',
              },
            ],
          },
        ],
      },
    };

    const blocks = adapter.extractParagraphBlocks(serialized);
    expect(blocks).toHaveLength(1);
    const run = blocks[0].runs[0];
    expect(run.style?.fontSize).toBe(22);
    expect(run.style?.color).toBe('#ff0000');
    expect(run.style?.fontFamily).toBe('Georgia');
  });

  it('subscribes to editor update listeners', () => {
    const callback = vi.fn();
    let registeredListener: ((payload: { editorState: unknown }) => void) | null = null;

    const mockEditor = {
      registerUpdateListener: (listener: (payload: { editorState: unknown }) => void) => {
        registeredListener = listener;
        return () => {
          registeredListener = null;
        };
      },
    };

    const unsubscribe = adapter.subscribe(mockEditor, callback);
    expect(registeredListener).not.toBeNull();

    // Trigger state change
    registeredListener!({
      editorState: {
        root: {
          children: [
            {
              key: 'p_event',
              type: 'paragraph',
              children: [{ text: 'Live update text', format: 0 }],
            },
          ],
        },
      },
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 'p_event' })])
    );

    unsubscribe();
  });
});
