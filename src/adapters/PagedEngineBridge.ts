import { LayoutSlicer } from '../core/LayoutSlicer';
import { DocumentBlock, EngineOptions, PageSlice, TableColumnResizePayload } from '../core/Types';
import { EditorAdapter } from './Types';

export interface PagedEngineBridgeOptions {
  adapter?: EditorAdapter;
  slicer?: LayoutSlicer;
  engineOptions?: EngineOptions;
}

/**
 * Reactive Bridge connecting editor mutations to the pagination engine.
 * Schedules non-blocking layout recalculations with requestAnimationFrame batching.
 */
export class PagedEngineBridge {
  private adapter?: EditorAdapter;
  private slicer: LayoutSlicer;
  private engineOptions?: EngineOptions;
  private currentBlocks: DocumentBlock[] = [];
  private currentPages: PageSlice[] = [];
  private listeners: Set<(pages: PageSlice[]) => void> = new Set();
  private resizeListeners: Set<(payload: TableColumnResizePayload) => void> = new Set();
  private pendingRafId: number | null = null;
  private pendingTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(options: PagedEngineBridgeOptions = {}) {
    this.adapter = options.adapter;
    this.slicer = options.slicer || new LayoutSlicer();
    this.engineOptions = options.engineOptions;
  }

  /**
   * Attaches reactively to an editor instance (Lexical, ProseMirror, etc.).
   * Automatically extracts blocks on initial attachment and on subsequent changes,
   * batching layout recalculations.
   * Returns an unsubscribe/detach teardown function.
   */
  public attach(editor: any): () => void {
    if (!editor) return () => {};

    const update = () => {
      if (this.adapter) {
        const blocks = this.adapter.extractParagraphBlocks(editor);
        this.scheduleUpdate(blocks);
      }
    };

    // Initial update
    update();

    if (this.adapter && typeof this.adapter.subscribe === 'function') {
      return this.adapter.subscribe(editor, (blocks) => {
        this.scheduleUpdate(blocks);
      });
    }

    if (typeof editor.registerUpdateListener === 'function') {
      return editor.registerUpdateListener(() => update());
    }

    return () => {};
  }

  /**
   * Synchronously sets blocks, recalculates pagination, and notifies subscribers.
   */
  public setBlocks(blocks: DocumentBlock[]): PageSlice[] {
    this.cancelPendingSchedule();
    this.currentBlocks = blocks;
    this.currentPages = this.slicer.paginate(blocks, this.engineOptions);
    this.notifyListeners();
    return this.currentPages;
  }

  /**
   * Schedules layout recalculation on the next animation frame to batch rapid typing strokes.
   */
  public scheduleUpdate(blocks: DocumentBlock[]): void {
    this.currentBlocks = blocks;

    if (this.pendingRafId !== null || this.pendingTimeoutId !== null) {
      return;
    }

    if (typeof requestAnimationFrame === 'function') {
      this.pendingRafId = requestAnimationFrame(() => {
        this.pendingRafId = null;
        this.currentPages = this.slicer.paginate(this.currentBlocks, this.engineOptions);
        this.notifyListeners();
      });
    } else {
      this.pendingTimeoutId = setTimeout(() => {
        this.pendingTimeoutId = null;
        this.currentPages = this.slicer.paginate(this.currentBlocks, this.engineOptions);
        this.notifyListeners();
      }, 16);
    }
  }

  /**
   * Returns current paginated document layout slices.
   */
  public getPages(): PageSlice[] {
    return this.currentPages;
  }

  /**
   * Returns current active paragraph blocks.
   */
  public getBlocks(): DocumentBlock[] {
    return this.currentBlocks;
  }

  /**
   * Subscribes to layout changes.
   */
  public onLayoutChange(callback: (pages: PageSlice[]) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Subscribes to table column resize events.
   */
  public onTableColumnResize(callback: (payload: TableColumnResizePayload) => void): () => void {
    this.resizeListeners.add(callback);
    return () => {
      this.resizeListeners.delete(callback);
    };
  }

  /**
   * Emits a table column resize event across the bridge.
   */
  public emitTableColumnResize(payload: TableColumnResizePayload): void {
    for (const listener of this.resizeListeners) {
      listener(payload);
    }
  }

  /**
   * Generic emit method for event dispatch.
   */
  public emit(event: string, payload: any): void {
    if (event === 'table:column-resize' || event === 'tableColumnResize') {
      this.emitTableColumnResize(payload);
    }
  }

  /**
   * Updates slicing options (e.g. changing page format or margins).
   */
  public setEngineOptions(options: EngineOptions): void {
    this.engineOptions = options;
    if (this.currentBlocks.length > 0) {
      this.setBlocks(this.currentBlocks);
    }
  }

  /**
   * Disposes the bridge and clears all listeners and pending timers.
   */
  public destroy(): void {
    this.cancelPendingSchedule();
    this.listeners.clear();
    this.resizeListeners.clear();
    this.currentBlocks = [];
    this.currentPages = [];
  }

  private cancelPendingSchedule(): void {
    if (this.pendingRafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.pendingRafId);
      this.pendingRafId = null;
    }
    if (this.pendingTimeoutId !== null) {
      clearTimeout(this.pendingTimeoutId);
      this.pendingTimeoutId = null;
    }
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentPages);
    }
  }
}
