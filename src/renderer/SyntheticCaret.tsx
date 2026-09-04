import React from 'react';
import { CaretCoordinates } from '../core/SelectionTypes';

export interface SyntheticCaretProps {
  caret: CaretCoordinates | null;
  color?: string;
  width?: number;
  visible?: boolean;
}

/**
 * Subpixel blinking cursor component.
 * Positioned over the active character insertion point with high-precision coordinate alignment.
 */
export const SyntheticCaret: React.FC<SyntheticCaretProps> = ({
  caret,
  color = '#1a73e8',
  width = 2,
  visible = true,
}) => {
  if (!caret || !visible) return null;

  return (
    <>
      <style>{`
        @keyframes pagedCaretBlink {
          0%, 49.9% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        .SyntheticCaret {
          animation: pagedCaretBlink 1.06s infinite;
        }
      `}</style>
      <div
        className="SyntheticCaret"
        data-caret-paraid={caret.paraId}
        data-caret-offset={caret.charOffset}
        style={{
          position: 'absolute',
          left: `${caret.x}px`,
          top: `${caret.y}px`,
          width: `${width}px`,
          height: `${caret.height}px`,
          backgroundColor: color,
          pointerEvents: 'none',
          zIndex: 10,
          transform: 'translateX(-50%)',
        }}
      />
    </>
  );
};
