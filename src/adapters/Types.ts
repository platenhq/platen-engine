import { DocumentBlock } from '../core/Types';

/**
 * Universal contract for rich-text editor adapters.
 * Translates editor-specific ASTs/nodes into engine DocumentBlock representations.
 */
export interface EditorAdapter<TEditor = unknown, TState = unknown> {
  /**
   * Extracts an array of DocumentBlocks from an editor instance or serialized state.
   */
  extractParagraphBlocks(source: TEditor | TState): DocumentBlock[];

  /**
   * Subscribes to editor mutation events and fires callback with updated DocumentBlocks.
   * Returns an unsubscribe teardown function.
   */
  subscribe(editor: TEditor, callback: (blocks: DocumentBlock[]) => void): () => void;
}
