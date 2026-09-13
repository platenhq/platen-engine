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

  it('extracts from editorState.toJSON() without needing globalThis.$getRoot', () => {
    const mockEditor = {
      getEditorState: () => ({
        toJSON: () => ({
          root: {
            children: [
              {
                key: 'json_p1',
                type: 'paragraph',
                children: [{ text: 'Extracted via toJSON()', format: 0 }],
              },
            ],
          },
        }),
      }),
    };

    const blocks = adapter.extractParagraphBlocks(mockEditor);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('json_p1');
    expect(blocks[0].runs[0].text).toBe('Extracted via toJSON()');
  });

  it('extracts from live editor context using getRootFn option', () => {
    const mockRoot = {
      getChildren: () => [
        {
          getKey: () => 'live_p1',
          getType: () => 'paragraph',
          getChildren: () => [
            {
              getType: () => 'text',
              getTextContent: () => 'Live node text from getRootFn',
              getFormat: () => LEXICAL_FORMAT.BOLD,
              getStyle: () => '',
            },
          ],
        },
      ],
    };

    const customAdapter = new LexicalAdapter({
      getRootFn: () => mockRoot,
    });

    const mockEditor = {
      getEditorState: () => ({
        read: (fn: () => unknown) => fn(),
      }),
    };

    const blocks = customAdapter.extractParagraphBlocks(mockEditor);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('live_p1');
    expect(blocks[0].runs[0].text).toBe('Live node text from getRootFn');
    expect(blocks[0].runs[0].style?.fontWeight).toBe('bold');
  });

  it('extracts from editor context using _nodeMap.get("root") fallback', () => {
    const mockRoot = {
      getChildren: () => [
        {
          getKey: () => 'nodemap_p1',
          getType: () => 'paragraph',
          getChildren: () => [
            {
              getType: () => 'text',
              getTextContent: () => 'NodeMap fallback text',
              getFormat: () => 0,
            },
          ],
        },
      ],
    };

    const nodeMap = new Map([['root', mockRoot]]);
    const mockEditor = {
      _nodeMap: nodeMap,
      getEditorState: () => ({
        read: (fn: () => unknown) => fn(),
      }),
    };

    const blocks = adapter.extractParagraphBlocks(mockEditor);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('nodemap_p1');
    expect(blocks[0].runs[0].text).toBe('NodeMap fallback text');
  });

  it('extracts nested lists (unordered and ordered) with correct prefixes', () => {
    const serializedLists = {
      root: {
        children: [
          {
            key: 'ul_1',
            type: 'list',
            tag: 'ul',
            children: [
              {
                key: 'li_1',
                type: 'listitem',
                children: [{ text: 'Unordered item 1', format: 0 }],
              },
              {
                key: 'li_2',
                type: 'listitem',
                children: [{ text: 'Unordered item 2', format: 0 }],
              },
            ],
          },
          {
            key: 'ol_1',
            type: 'list',
            tag: 'ol',
            children: [
              {
                key: 'li_3',
                type: 'listitem',
                children: [{ text: 'First step', format: 0 }],
              },
              {
                key: 'li_4',
                type: 'listitem',
                children: [{ text: 'Second step', format: 0 }],
              },
            ],
          },
        ],
      },
    };

    const blocks = adapter.extractParagraphBlocks(serializedLists);
    expect(blocks).toHaveLength(4);

    // Bullet items
    expect(blocks[0].runs[0].text).toBe('• ');
    expect(blocks[0].runs[1].text).toBe('Unordered item 1');
    expect(blocks[1].runs[0].text).toBe('• ');
    expect(blocks[1].runs[1].text).toBe('Unordered item 2');

    // Numbered items
    expect(blocks[2].runs[0].text).toBe('1. ');
    expect(blocks[2].runs[1].text).toBe('First step');
    expect(blocks[3].runs[0].text).toBe('2. ');
    expect(blocks[3].runs[1].text).toBe('Second step');
  });

  it('extracts nested tables (rows -> cells -> paragraphs/text)', () => {
    const serializedTable = {
      root: {
        children: [
          {
            key: 'table_1',
            type: 'table',
            children: [
              {
                type: 'tablerow',
                children: [
                  {
                    key: 'c1',
                    type: 'tablecell',
                    children: [
                      {
                        key: 'c1_p',
                        type: 'paragraph',
                        children: [{ text: 'Cell 1 Header', format: LEXICAL_FORMAT.BOLD }],
                      },
                    ],
                  },
                  {
                    key: 'c2',
                    type: 'tablecell',
                    children: [
                      {
                        key: 'c2_p',
                        type: 'paragraph',
                        children: [{ text: 'Cell 2 Header', format: LEXICAL_FORMAT.BOLD }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tablerow',
                children: [
                  {
                    key: 'c3',
                    type: 'tablecell',
                    children: [{ text: 'Direct cell text', format: 0 }],
                  },
                ],
              },
            ],
          },
        ],
      },
    };

    const blocks = adapter.extractParagraphBlocks(serializedTable);
    expect(blocks).toHaveLength(3);
    expect(blocks[0].runs[0].text).toBe('Cell 1 Header');
    expect(blocks[1].runs[0].text).toBe('Cell 2 Header');
    expect(blocks[2].runs[0].text).toBe('Direct cell text');
  });

  it('extracts nested inline links within paragraphs', () => {
    const serializedWithLink = {
      root: {
        children: [
          {
            key: 'p_link',
            type: 'paragraph',
            children: [
              { text: 'Check out ', format: 0 },
              {
                type: 'link',
                children: [{ text: 'Platen Engine', format: LEXICAL_FORMAT.UNDERLINE }],
              },
              { text: ' for fast pagination.', format: 0 },
            ],
          },
        ],
      },
    };

    const blocks = adapter.extractParagraphBlocks(serializedWithLink);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].runs).toHaveLength(3);
    expect(blocks[0].runs[0].text).toBe('Check out ');
    expect(blocks[0].runs[1].text).toBe('Platen Engine');
    expect(blocks[0].runs[1].style?.underline).toBe(true);
    expect(blocks[0].runs[2].text).toBe(' for fast pagination.');
  });

  it('handles empty paragraphs with placeholder run', () => {
    const serializedEmpty = {
      root: {
        children: [
          {
            key: 'empty_p',
            type: 'paragraph',
            children: [],
          },
        ],
      },
    };

    const blocks = adapter.extractParagraphBlocks(serializedEmpty);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe('empty_p');
    expect(blocks[0].runs).toHaveLength(1);
    expect(blocks[0].runs[0].text).toBe(' ');
  });
});
