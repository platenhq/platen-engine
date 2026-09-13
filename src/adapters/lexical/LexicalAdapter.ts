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
  /** Optional custom getter for $getRoot if lexical cannot be imported globally */
  getRootFn?: () => unknown;
}

/**
 * Universal Lexical AST Adapter.
 * Translates Lexical editor states and serialized AST trees into paged-engine ParagraphBlocks.
 */
export class LexicalAdapter implements EditorAdapter {
  private defaultFontFamily: string;
  private defaultFontSize: number;
  private defaultLineHeight: number;
  private getRootFn?: () => unknown;

  constructor(options: LexicalAdapterOptions = {}) {
    this.defaultFontFamily = options.defaultFontFamily || 'Arial';
    this.defaultFontSize = options.defaultFontSize || 16;
    this.defaultLineHeight = options.defaultLineHeight || 24;
    this.getRootFn = options.getRootFn;
  }

  /**
   * Extracts ParagraphBlocks from a Lexical Editor, EditorState, or Serialized AST JSON.
   */
  public extractParagraphBlocks(source: unknown): ParagraphBlock[] {
    if (!source || typeof source !== 'object') return [];

    // Case 1: Serialized Lexical AST object ({ root: { children: [...] } })
    const serialized = source as { root?: { children?: unknown[] } };
    if (serialized.root && Array.isArray(serialized.root.children)) {
      return this.flattenAndExtractNodes(serialized.root.children);
    }

    // Case 2: Direct array of serialized nodes
    if (Array.isArray(source)) {
      return this.flattenAndExtractNodes(source);
    }

    // Case 3: Lexical Editor instance with getEditorState()
    if (
      'getEditorState' in source &&
      typeof (source as { getEditorState: unknown }).getEditorState === 'function'
    ) {
      const editorState = (source as any).getEditorState();
      // If editorState has toJSON(), prioritize serialized AST extraction
      if (editorState && typeof editorState.toJSON === 'function') {
        const json = editorState.toJSON();
        if (json?.root && Array.isArray(json.root.children)) {
          return this.flattenAndExtractNodes(json.root.children);
        }
      }
      if (editorState && typeof editorState.read === 'function') {
        return editorState.read(() => this.extractFromLexicalContext(source));
      }
    }

    // Case 4: Lexical EditorState with toJSON() or read()
    if ('toJSON' in source && typeof (source as any).toJSON === 'function') {
      const json = (source as any).toJSON();
      if (json?.root && Array.isArray(json.root.children)) {
        return this.flattenAndExtractNodes(json.root.children);
      }
    }
    if ('read' in source && typeof (source as any).read === 'function') {
      return (source as any).read(() => this.extractFromLexicalContext(source));
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
   * Traverses Lexical active context via provided getRootFn, globalThis.$getRoot, or editor node map.
   */
  private extractFromLexicalContext(context: unknown): ParagraphBlock[] {
    let root: any = null;

    if (this.getRootFn) {
      root = this.getRootFn();
    } else if (typeof (globalThis as any).$getRoot === 'function') {
      root = (globalThis as any).$getRoot();
    } else if (context && typeof (context as any)._nodeMap?.get === 'function') {
      root = (context as any)._nodeMap.get('root');
    } else if (context && typeof (context as any).getRoot === 'function') {
      root = (context as any).getRoot();
    }

    if (root && typeof root.getChildren === 'function') {
      return this.flattenAndExtractLiveNodes(root.getChildren());
    }

    return [];
  }

  /**
   * Recursively extracts blocks from serialized Lexical JSON nodes, flattening
   * nested structures (lists, tables, callouts) into printable paragraph blocks.
   */
  private flattenAndExtractNodes(nodes: unknown[]): ParagraphBlock[] {
    const blocks: ParagraphBlock[] = [];

    const processNode = (node: any, prefix = '') => {
      if (!node || typeof node !== 'object') return;

      const type = node.type || 'paragraph';
      const tag = node.tag;
      const id = node.key || `block_${blocks.length}`;

      // Handle Lists: traverse each ListItemNode
      if (type === 'list') {
        const listTag = tag || node.listType || 'ul';
        const children = Array.isArray(node.children) ? node.children : [];
        children.forEach((itemNode: any, idx: number) => {
          const isOrdered = listTag === 'ol' || listTag === 'number';
          const itemPrefix = isOrdered ? `${idx + 1}. ` : '• ';
          processNode(itemNode, itemPrefix);
        });
        return;
      }

      // Handle Tables: traverse each row and cell
      if (type === 'table') {
        const rows = Array.isArray(node.children) ? node.children : [];
        for (const row of rows) {
          const cells = Array.isArray(row?.children) ? row.children : [];
          for (const cell of cells) {
            const cellChildren = Array.isArray(cell?.children) ? cell.children : [];
            const hasBlockChildren = cellChildren.some(
              (c: any) => c && (c.type === 'paragraph' || c.type === 'heading' || c.type === 'list')
            );
            if (hasBlockChildren) {
              for (const cellChild of cellChildren) {
                processNode(cellChild);
              }
            } else {
              processNode(cell);
            }
          }
        }
        return;
      }

      // Collect all text runs recursively
      const runs: TextRun[] = [];

      if (prefix) {
        runs.push({
          text: prefix,
          style: this.computeDefaultStyle(type, tag),
        });
      }

      const collectRuns = (childNode: any) => {
        if (!childNode || typeof childNode !== 'object') return;

        if (typeof childNode.text === 'string' && childNode.text.length > 0) {
          const style = this.buildTextStyleFromFormat(childNode.format || 0, childNode.style || '');
          runs.push({
            text: childNode.text,
            style,
          });
        } else if (Array.isArray(childNode.children)) {
          if (childNode.type === 'list') {
            processNode(childNode);
          } else {
            for (const nested of childNode.children) {
              collectRuns(nested);
            }
          }
        }
      };

      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          collectRuns(child);
        }
      }

      // Push block if runs exist or if it represents an empty paragraph/heading/listitem line
      if (
        runs.length > 0 ||
        type === 'paragraph' ||
        type === 'heading' ||
        type === 'listitem' ||
        type === 'quote'
      ) {
        blocks.push({
          id,
          runs:
            runs.length > 0 ? runs : [{ text: ' ', style: this.computeDefaultStyle(type, tag) }],
          defaultStyle: this.computeDefaultStyle(type, tag),
        });
      }
    };

    for (const node of nodes) {
      processNode(node);
    }

    return blocks;
  }

  /**
   * Recursively extracts blocks from live Lexical Node instances.
   */
  private flattenAndExtractLiveNodes(nodes: any[]): ParagraphBlock[] {
    const blocks: ParagraphBlock[] = [];

    const processLiveNode = (node: any, prefix = '') => {
      if (!node || typeof node !== 'object') return;

      const type = typeof node.getType === 'function' ? node.getType() : 'paragraph';
      const tag = typeof node.getTag === 'function' ? node.getTag() : undefined;
      const id = typeof node.getKey === 'function' ? node.getKey() : `block_${blocks.length}`;

      if (type === 'list') {
        const children = typeof node.getChildren === 'function' ? node.getChildren() : [];
        const isOrdered =
          tag === 'ol' ||
          (typeof node.getListType === 'function' && node.getListType() === 'number');
        children.forEach((child: any, idx: number) => {
          const itemPrefix = isOrdered ? `${idx + 1}. ` : '• ';
          processLiveNode(child, itemPrefix);
        });
        return;
      }

      if (type === 'table') {
        const rows = typeof node.getChildren === 'function' ? node.getChildren() : [];
        for (const row of rows) {
          const cells = typeof row.getChildren === 'function' ? row.getChildren() : [];
          for (const cell of cells) {
            const cellChildren = typeof cell.getChildren === 'function' ? cell.getChildren() : [];
            const hasBlockChildren = cellChildren.some(
              (c: any) =>
                c &&
                typeof c.getType === 'function' &&
                (c.getType() === 'paragraph' || c.getType() === 'heading' || c.getType() === 'list')
            );
            if (hasBlockChildren) {
              for (const cellChild of cellChildren) {
                processLiveNode(cellChild);
              }
            } else {
              processLiveNode(cell);
            }
          }
        }
        return;
      }

      const runs: TextRun[] = [];

      if (prefix) {
        runs.push({
          text: prefix,
          style: this.computeDefaultStyle(type, tag),
        });
      }

      const collectRuns = (childNode: any) => {
        if (!childNode || typeof childNode !== 'object') return;

        const childType = typeof childNode.getType === 'function' ? childNode.getType() : '';

        if (
          childType === 'text' ||
          (typeof childNode.getTextContent === 'function' && !childNode.getChildren)
        ) {
          const text = childNode.getTextContent();
          if (text) {
            const format = typeof childNode.getFormat === 'function' ? childNode.getFormat() : 0;
            const styleString =
              typeof childNode.getStyle === 'function' ? childNode.getStyle() : '';
            runs.push({
              text,
              style: this.buildTextStyleFromFormat(format, styleString),
            });
          }
        } else if (typeof childNode.getChildren === 'function') {
          if (childType === 'list') {
            processLiveNode(childNode);
          } else {
            for (const nested of childNode.getChildren()) {
              collectRuns(nested);
            }
          }
        }
      };

      if (typeof node.getChildren === 'function') {
        for (const child of node.getChildren()) {
          collectRuns(child);
        }
      }

      if (
        runs.length > 0 ||
        type === 'paragraph' ||
        type === 'heading' ||
        type === 'listitem' ||
        type === 'quote'
      ) {
        blocks.push({
          id,
          runs:
            runs.length > 0 ? runs : [{ text: ' ', style: this.computeDefaultStyle(type, tag) }],
          defaultStyle: this.computeDefaultStyle(type, tag),
        });
      }
    };

    for (const node of nodes) {
      processLiveNode(node);
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
