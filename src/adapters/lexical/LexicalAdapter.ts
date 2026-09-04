import { ParagraphBlock, TextRun, TextStyle } from '../../core/Types';
import { EditorAdapter } from '../Types';

// Lexical Text Format Flags (Bitmasks)
export const LEXICAL_FORMAT = {
  BOLD: 1,
  ITALIC: 2,
  STRIKETHROUGH: 4,
  UNDERLINE: 8,
  CODE: 16,
  SUBSCRIPT: 32,
  SUPERSCRIPT: 64,
} as const;

export interface LexicalAdapterOptions {
  defaultFontFamily?: string;
  defaultFontSize?: number;
  defaultLineHeight?: number;
}

/**
 * Universal Lexical AST Adapter.
 * Translates Lexical editor states and serialized AST trees into paged-engine ParagraphBlocks.
 */
export class LexicalAdapter implements EditorAdapter {
  private defaultFontFamily: string;
  private defaultFontSize: number;
  private defaultLineHeight: number;

  constructor(options: LexicalAdapterOptions = {}) {
    this.defaultFontFamily = options.defaultFontFamily || 'Arial';
    this.defaultFontSize = options.defaultFontSize || 16;
    this.defaultLineHeight = options.defaultLineHeight || 24;
  }

  /**
   * Extracts ParagraphBlocks from a Lexical Editor, EditorState, or Serialized AST JSON.
   */
  public extractParagraphBlocks(source: unknown): ParagraphBlock[] {
    if (!source || typeof source !== 'object') return [];

    // Case 1: Lexical Editor instance with getEditorState()
    if (
      'getEditorState' in source &&
      typeof (source as { getEditorState: unknown }).getEditorState === 'function'
    ) {
      const editorState = (
        source as {
          getEditorState: () => { read: (fn: () => ParagraphBlock[]) => ParagraphBlock[] };
        }
      ).getEditorState();
      return editorState.read(() => this.extractFromLexicalContext(source));
    }

    // Case 2: Lexical EditorState with read()
    if ('read' in source && typeof (source as { read: unknown }).read === 'function') {
      return (source as { read: (fn: () => ParagraphBlock[]) => ParagraphBlock[] }).read(() =>
        this.extractFromLexicalContext(source)
      );
    }

    // Case 3: Serialized Lexical AST object ({ root: { children: [...] } })
    const serialized = source as { root?: { children?: unknown[] } };
    if (serialized.root && Array.isArray(serialized.root.children)) {
      return this.extractFromSerializedNodes(serialized.root.children);
    }

    // Case 4: Direct array of nodes
    if (Array.isArray(source)) {
      return this.extractFromSerializedNodes(source);
    }

    return [];
  }

  /**
   * Subscribes to Lexical editor state update events.
   */
  public subscribe(
    editor: {
      registerUpdateListener?: (
        listener: (payload: { editorState: unknown }) => void
      ) => () => void;
    },
    callback: (blocks: ParagraphBlock[]) => void
  ): () => void {
    if (typeof editor.registerUpdateListener === 'function') {
      return editor.registerUpdateListener(({ editorState }) => {
        const blocks = this.extractParagraphBlocks(editorState);
        callback(blocks);
      });
    }

    return () => {};
  }

  /**
   * Traverses Lexical active context via $getRoot or node traversal.
   */
  private extractFromLexicalContext(context: unknown): ParagraphBlock[] {
    const root =
      typeof (globalThis as unknown as { $getRoot?: () => { getChildren: () => unknown[] } })
        .$getRoot === 'function'
        ? (globalThis as unknown as { $getRoot: () => { getChildren: () => unknown[] } }).$getRoot()
        : (context as { getRoot?: () => { getChildren: () => unknown[] } }).getRoot?.();

    if (root && typeof root.getChildren === 'function') {
      return this.extractFromLiveNodes(root.getChildren());
    }

    return [];
  }

  /**
   * Maps live Lexical Node instances.
   */
  private extractFromLiveNodes(nodes: unknown[]): ParagraphBlock[] {
    const blocks: ParagraphBlock[] = [];

    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;

      const duckNode = node as {
        getKey?: () => string;
        getType?: () => string;
        getTag?: () => string;
        getChildren?: () => unknown[];
        getTextContent?: () => string;
      };

      const id = duckNode.getKey ? duckNode.getKey() : `block_${blocks.length}`;
      const type = duckNode.getType ? duckNode.getType() : 'paragraph';
      const tag = duckNode.getTag ? duckNode.getTag() : undefined;

      const children = duckNode.getChildren ? duckNode.getChildren() : [];
      const runs = this.extractRunsFromLiveChildren(children);

      const defaultStyle = this.computeDefaultStyle(type, tag);

      blocks.push({
        id,
        runs,
        defaultStyle,
      });
    }

    return blocks;
  }

  private extractRunsFromLiveChildren(children: unknown[]): TextRun[] {
    const runs: TextRun[] = [];

    for (const child of children) {
      if (!child || typeof child !== 'object') continue;

      const textNode = child as {
        getTextContent?: () => string;
        getFormat?: () => number;
        getStyle?: () => string;
      };

      const text = textNode.getTextContent ? textNode.getTextContent() : '';
      if (!text) continue;

      const format = textNode.getFormat ? textNode.getFormat() : 0;
      const styleString = textNode.getStyle ? textNode.getStyle() : '';

      const style = this.buildTextStyleFromFormat(format, styleString);

      runs.push({
        text,
        style,
      });
    }

    return runs;
  }

  /**
   * Maps serialized Lexical JSON AST nodes.
   */
  private extractFromSerializedNodes(nodes: unknown[]): ParagraphBlock[] {
    const blocks: ParagraphBlock[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i] as {
        key?: string;
        type?: string;
        tag?: string;
        children?: unknown[];
      };

      if (!node || typeof node !== 'object') continue;

      const id = node.key || `block_${i}`;
      const type = node.type || 'paragraph';
      const tag = node.tag;
      const children = Array.isArray(node.children) ? node.children : [];

      const runs: TextRun[] = [];

      for (const child of children) {
        const textChild = child as {
          text?: string;
          format?: number;
          style?: string;
        };

        if (typeof textChild.text === 'string' && textChild.text.length > 0) {
          const style = this.buildTextStyleFromFormat(textChild.format || 0, textChild.style || '');
          runs.push({
            text: textChild.text,
            style,
          });
        }
      }

      blocks.push({
        id,
        runs,
        defaultStyle: this.computeDefaultStyle(type, tag),
      });
    }

    return blocks;
  }

  /**
   * Translates Lexical bitmask format flags and inline CSS styles into TextStyle.
   */
  private buildTextStyleFromFormat(format: number, inlineStyle: string): TextStyle {
    const style: TextStyle = {
      fontFamily: this.defaultFontFamily,
      fontSize: this.defaultFontSize,
      lineHeight: this.defaultLineHeight,
    };

    if (format & LEXICAL_FORMAT.BOLD) {
      style.fontWeight = 'bold';
    }
    if (format & LEXICAL_FORMAT.ITALIC) {
      style.fontStyle = 'italic';
    }
    if (format & LEXICAL_FORMAT.UNDERLINE) {
      style.underline = true;
    }
    if (format & LEXICAL_FORMAT.STRIKETHROUGH) {
      style.strikethrough = true;
    }

    // Parse inline style declarations if present
    if (inlineStyle) {
      const declarations = inlineStyle.split(';');
      for (const decl of declarations) {
        const [prop, val] = decl.split(':').map((s) => s?.trim());
        if (!prop || !val) continue;

        if (prop === 'font-size') {
          const size = parseFloat(val);
          if (!isNaN(size) && size > 0) {
            style.fontSize = size;
            style.lineHeight = Math.round(size * 1.4);
          }
        } else if (prop === 'font-family') {
          style.fontFamily = val.replace(/['"]/g, '');
        } else if (prop === 'color') {
          style.color = val;
        }
      }
    }

    return style;
  }

  private computeDefaultStyle(type: string, tag?: string): TextStyle {
    if (type === 'heading' || tag) {
      const hTag = (tag || '').toLowerCase();
      if (hTag === 'h1') {
        return {
          fontFamily: this.defaultFontFamily,
          fontSize: 32,
          lineHeight: 40,
          fontWeight: 'bold',
        };
      }
      if (hTag === 'h2') {
        return {
          fontFamily: this.defaultFontFamily,
          fontSize: 24,
          lineHeight: 32,
          fontWeight: 'bold',
        };
      }
      if (hTag === 'h3') {
        return {
          fontFamily: this.defaultFontFamily,
          fontSize: 20,
          lineHeight: 28,
          fontWeight: 'bold',
        };
      }
    }

    if (type === 'quote') {
      return {
        fontFamily: this.defaultFontFamily,
        fontSize: this.defaultFontSize,
        lineHeight: this.defaultLineHeight,
        fontStyle: 'italic',
        color: '#4b5563',
      };
    }

    return {
      fontFamily: this.defaultFontFamily,
      fontSize: this.defaultFontSize,
      lineHeight: this.defaultLineHeight,
    };
  }
}
