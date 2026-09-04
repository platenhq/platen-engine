import React, { forwardRef, useImperativeHandle, useRef } from 'react';

export interface ClipboardProxyHandles {
  prepareCopyData: (plainText: string, htmlText?: string) => void;
  getElement: () => HTMLDivElement | null;
}

export interface ClipboardProxyProps {
  onCopy?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onCut?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onPaste?: (data: { plainText: string; htmlText?: string }) => void;
}

/**
 * Invisible clipboard proxy bridge.
 * Facilitates native OS clipboard copy, cut, and paste interactions for canvas-rendered selections.
 */
export const ClipboardProxy = forwardRef<ClipboardProxyHandles, ClipboardProxyProps>(
  ({ onCopy, onCut, onPaste }, ref) => {
    const clipboardRef = useRef<HTMLDivElement | null>(null);

    useImperativeHandle(ref, () => ({
      prepareCopyData: (plainText: string, htmlText?: string) => {
        if (!clipboardRef.current) return;
        if (htmlText) {
          clipboardRef.current.innerHTML = htmlText;
        } else {
          clipboardRef.current.innerText = plainText;
        }

        // Select the hidden content so native Ctrl+C copies it
        const sel = window.getSelection();
        if (sel) {
          const range = document.createRange();
          range.selectNodeContents(clipboardRef.current);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      },
      getElement: () => clipboardRef.current,
    }));

    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
      e.preventDefault();
      const plainText = e.clipboardData.getData('text/plain');
      const htmlText = e.clipboardData.getData('text/html');
      onPaste?.({ plainText, htmlText: htmlText || undefined });
    };

    return (
      <div
        ref={clipboardRef}
        contentEditable
        suppressContentEditableWarning
        tabIndex={-1}
        aria-hidden="true"
        onCopy={onCopy}
        onCut={onCut}
        onPaste={handlePaste}
        style={{
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          zIndex: -2147483648,
        }}
      />
    );
  }
);

ClipboardProxy.displayName = 'ClipboardProxy';
