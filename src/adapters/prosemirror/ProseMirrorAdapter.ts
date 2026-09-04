import { ParagraphBlock, TextRun, TextStyle } from '../../core/Types';
import { EditorAdapter } from '../Types';

export interface ProseMirrorAdapterOptions {
  defaultFontFamily?: string;
  defaultFontSize?: number;
  defaultLineHeight?: number;
}

/**
 * Universal ProseMirror & TipTap Document Adapter.
 * Translates ProseMirror document models and JSON schemas into paged-engine ParagraphBlocks.
 */
export class ProseMirrorAdapter implements EditorAdapter {
  private defaultFontFamily: string;
  private defaultFontSize: number;
  private defaultLineHeight: number;

  constructor(options: ProseMirrorAdapterOptions = {}) {
    this.defaultFontFamily = options.defaultFontFamily || 'Arial';
    this.defaultFontSize = options.defaultFontSize || 16;
    this.defaultLineHeight = options.defaultLineHeight || 24;
  }

  /**
   * Extracts ParagraphBlocks from a ProseMirror EditorView, State, doc Node, or serialized JSON.
   */
  public extractParagraphBlocks(source: unknown): ParagraphBlock[] {
    if (!source || typeof source !== 'object') return [];

    // Case 1: EditorView with state.doc
    if ('state' in source && typeof (source as { state: unknown }).state === 'object') {
      const state = (source as { state: { doc?: unknown } }).state;
      return this.extractFromDoc(state.doc);
    }

    // Case 2: EditorState with doc
    if ('doc' in source && (source as { doc?: unknown }).doc) {
      return this.extractFromDoc((source as { doc: unknown }).doc);
    }

    // Case 3: Direct ProseMirror doc Node or JSON schema
    return this.extractFromDoc(source);
  }

  /**
   * Subscribes to ProseMirror transaction dispatches.
   */
  public subscribe(
    view: { dispatchTransaction?: (tr: unknown) => void; state?: { doc?: unknown } },
    callback: (blocks: ParagraphBlock[]) => void
  ): () => void {
    if (!view || typeof view !== 'object') return () => {};

    // For ProseMirror, transactions can be intercepted or plugin views used
    // This allows manual dispatch hooks or plugin state subscriptions
    const originalDispatch = view.dispatchTransaction?.bind(view);
    if (originalDispatch) {
      view.dispatchTransaction = (tr: unknown) => {
        originalDispatch(tr);
        if (view.state?.doc) {
          const blocks = this.extractParagraphBlocks(view.state.doc);
          callback(blocks);
        }
      };

      return () => {
        view.dispatchTransaction = originalDispatch;
      };
    }

    return () => {};
  }

  private extractFromDoc(doc: unknown): ParagraphBlock[] {
    if (!doc || typeof doc !== 'object') return [];

    const blocks: ParagraphBlock[] = [];

    // Duck-type ProseMirror Node.forEach
    const duckDoc = doc as {
      forEach?: (callback: (node: unknown, offset: number, index: number) => void) => void;
      content?: unknown[] | { forEach?: (callback: (node: unknown) => void) => void };
    };

    if (typeof duckDoc.forEach === 'function') {
      let index = 0;
      duckDoc.forEach((childNode) => {
        const block = this.convertProseMirrorNode(childNode, `block_${index++}`);
        if (block) blocks.push(block);
      });
      return blocks;
    }

    // Serialized JSON with content array
    if (Array.isArray(duckDoc.content)) {
      for (let i = 0; i < duckDoc.content.length; i++) {
        const block = this.convertProseMirrorNode(duckDoc.content[i], `block_${i}`);
        if (block) blocks.push(block);
      }
      return blocks;
    }

    return blocks;
  }

  private convertProseMirrorNode(node: unknown, fallbackId: string): ParagraphBlock | null {
    if (!node || typeof node !== 'object') return null;

    const pmNode = node as {
      type?: { name: string } | string;
      attrs?: { id?: string; level?: number };
      content?: unknown[] | { forEach?: (callback: (child: unknown) => void) => void };
      forEach?: (callback: (child: unknown) => void) => void;
      text?: string;
      marks?: Array<{ type?: { name: string } | string; attrs?: Record<string, unknown> }>;
    };

    const typeName =
      typeof pmNode.type === 'string' ? pmNode.type : pmNode.type?.name || 'paragraph';
    const id = pmNode.attrs?.id || fallbackId;
    const runs: TextRun[] = [];

    const collectRun = (inlineNode: unknown) => {
      if (!inlineNode || typeof inlineNode !== 'object') return;
      const child = inlineNode as {
        text?: string;
        marks?: Array<{ type?: { name: string } | string; attrs?: Record<string, unknown> }>;
      };

      if (typeof child.text === 'string' && child.text.length > 0) {
        const style = this.buildTextStyleFromMarks(child.marks || []);
        runs.push({
          text: child.text,
          style,
        });
      }
    };

    if (typeof pmNode.forEach === 'function') {
      pmNode.forEach(collectRun);
    } else if (Array.isArray(pmNode.content)) {
      pmNode.content.forEach(collectRun);
    }

    const defaultStyle = this.computeDefaultStyle(typeName, pmNode.attrs?.level);

    return {
      id,
      runs,
      defaultStyle,
    };
  }

  private buildTextStyleFromMarks(
    marks: Array<{ type?: { name: string } | string; attrs?: Record<string, unknown> }>
  ): TextStyle {
    const style: TextStyle = {
      fontFamily: this.defaultFontFamily,
      fontSize: this.defaultFontSize,
      lineHeight: this.defaultLineHeight,
    };

    for (const mark of marks) {
      const markName = typeof mark.type === 'string' ? mark.type : mark.type?.name;

      if (markName === 'strong' || markName === 'bold') {
        style.fontWeight = 'bold';
      } else if (markName === 'em' || markName === 'italic') {
        style.fontStyle = 'italic';
      } else if (markName === 'underline') {
        style.underline = true;
      } else if (markName === 'strike' || markName === 'strikethrough') {
        style.strikethrough = true;
      }

      if (mark.attrs?.color && typeof mark.attrs.color === 'string') {
        style.color = mark.attrs.color;
      }
      if (mark.attrs?.fontFamily && typeof mark.attrs.fontFamily === 'string') {
        style.fontFamily = mark.attrs.fontFamily;
      }
      if (mark.attrs?.fontSize && typeof mark.attrs.fontSize === 'number') {
        style.fontSize = mark.attrs.fontSize;
        style.lineHeight = Math.round(mark.attrs.fontSize * 1.4);
      }
    }

    return style;
  }

  private computeDefaultStyle(type: string, level?: number): TextStyle {
    if (type === 'heading' && level) {
      if (level === 1) {
        return {
          fontFamily: this.defaultFontFamily,
          fontSize: 32,
          lineHeight: 40,
          fontWeight: 'bold',
        };
      }
      if (level === 2) {
        return {
          fontFamily: this.defaultFontFamily,
          fontSize: 24,
          lineHeight: 32,
          fontWeight: 'bold',
        };
      }
      if (level === 3) {
        return {
          fontFamily: this.defaultFontFamily,
          fontSize: 20,
          lineHeight: 28,
          fontWeight: 'bold',
        };
      }
    }

    if (type === 'blockquote') {
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
