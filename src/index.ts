// Core Types & Interfaces
export * from './core/Types';
export * from './core/SelectionTypes';

// Geometry & Margin Presets
export * from './core/Geometry';

// Font Measurement Engine
export * from './core/MetricEngine';

// Word Wrapping & Segmentation
export * from './core/LineBreaker';

// Layout & Track Slicing Engine
export * from './core/LayoutSlicer';
export * from './core/PaginationMetrics';
export * from './layout/BlockPagination';
export * from './hooks/useBlockPagination';

// Caret & Selection Coordinate Solver
export * from './core/CaretPositioner';

// Micro-Canvas Rasterizer
export * from './renderer/MicroCanvas';

// Accessibility & Screen Reader Mesh
export * from './renderer/AccessibilityMesh';

// Synthetic Caret & Selection Highlight Overlay
export * from './renderer/SyntheticCaret';
export * from './renderer/SelectionOverlay';

// Native Input & Clipboard Proxies (including Microsoft Word Online WACEditingElement)
export * from './proxy/InputProxy';
export * from './proxy/ClipboardProxy';
export * from './proxy/WACEditingElement';

// React Sheet & Desk Components
export * from './components/PagedSheet';
export * from './components/PagedDesk';

// Framework Adapters & Reactive Bridge
export * from './adapters/Types';
export * from './adapters/lexical/LexicalAdapter';
export * from './adapters/prosemirror/ProseMirrorAdapter';
export * from './adapters/PagedEngineBridge';
