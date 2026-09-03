import { ParagraphBlock } from '../core/Types';

/**
 * Universal contract for rich-text editor adapters.
 * Translates editor-specific ASTs/nodes into engine ParagraphBlock representations.
 */
export interface EditorAdapter<TEditor = unknown, TState = unknown> {
  /**
   * Extracts an array of ParagraphBlocks from an editor instance or serialized state.
   */
  extractParagraphBlocks(source: TEditor | TState): ParagraphBlock[];

  /**
   * Subscribes to editor mutation events and fires callback with updated ParagraphBlocks.
   * Returns an unsubscribe teardown function.
   */
  subscribe(editor: TEditor, callback: (blocks: ParagraphBlock[]) => void): () => void;
}
