import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export interface WACEditingElementHandles {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  getElement: () => HTMLDivElement | null;
}

export interface WACEditingElementProps {
  x: number;
  y: number;
  width?: number;
  height?: number;
  paraId?: string;
  initialText?: string;
  autoFocus?: boolean;
  onInsertText?: (text: string) => void;
  onDeleteBackward?: () => void;
  onDeleteForward?: () => void;
  onInsertParagraph?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onCompositionStart?: () => void;
  onCompositionUpdate?: (data: string) => void;
  onCompositionEnd?: (data: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
}

/**
 * Layer 1: WACViewPanel_EditingElement Proxy (Microsoft Word Online Architecture)
 * Floats an invisible, single-line contenteditable proxy directly over the active caret coordinate.
 * Captures native keyboard events, IME composition windows, virtual keyboards, and clipboard events.
 */
export const WACEditingElement = forwardRef<WACEditingElementHandles, WACEditingElementProps>(
  (
    {
      x,
      y,
      width = 120,
      height = 24,
      paraId,
      initialText = '',
      autoFocus = true,
      onInsertText,
      onDeleteBackward,
      onDeleteForward,
      onInsertParagraph,
      onKeyDown,
      onCompositionStart,
      onCompositionUpdate,
      onCompositionEnd,
      onFocus,
      onBlur,
    },
    ref
  ) => {
    const editRef = useRef<HTMLDivElement | null>(null);
    const isComposingRef = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => editRef.current?.focus(),
      blur: () => editRef.current?.blur(),
      clear: () => {
        if (editRef.current) editRef.current.innerText = '';
      },
      getElement: () => editRef.current,
    }));

    useEffect(() => {
      if (autoFocus && editRef.current) {
        editRef.current.focus();
      }
    }, [autoFocus]);

    const handleBeforeInput = (e: React.FormEvent<HTMLDivElement>) => {
      const nativeEvent = e.nativeEvent as InputEvent;
      const inputType = nativeEvent.inputType;

      if (isComposingRef.current) return;

      if (inputType === 'insertText' && nativeEvent.data) {
        e.preventDefault();
        onInsertText?.(nativeEvent.data);
      } else if (inputType === 'deleteContentBackward') {
        e.preventDefault();
        onDeleteBackward?.();
      } else if (inputType === 'deleteContentForward') {
        e.preventDefault();
        onDeleteForward?.();
      } else if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
        e.preventDefault();
        onInsertParagraph?.();
      }
    };

    const handleCompositionStart = () => {
      isComposingRef.current = true;
      onCompositionStart?.();
    };

    const handleCompositionUpdate = (e: React.CompositionEvent<HTMLDivElement>) => {
      onCompositionUpdate?.(e.data);
    };

    const handleCompositionEnd = (e: React.CompositionEvent<HTMLDivElement>) => {
      isComposingRef.current = false;
      onCompositionEnd?.(e.data);
      if (editRef.current) {
        editRef.current.innerText = '';
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isComposingRef.current) return;

      onKeyDown?.(e);

      if (!e.defaultPrevented) {
        if (e.key === 'Backspace') {
          e.preventDefault();
          onDeleteBackward?.();
        } else if (e.key === 'Delete') {
          e.preventDefault();
          onDeleteForward?.();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          onInsertParagraph?.();
        }
      }
    };

    return (
      <div
        id="WACViewPanel_EditingElement_WrappingDiv"
        style={{
          position: 'absolute',
          left: `${x}px`,
          top: `${y}px`,
          width: `${width}px`,
          height: `${height}px`,
          display: 'block',
          zIndex: 50,
          opacity: 0,
          pointerEvents: 'auto',
          visibility: 'visible',
          overflow: 'hidden',
        }}
      >
        <div
          id="WACViewPanel_EditingElement"
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck
          tabIndex={0}
          role="textbox"
          aria-label="Document editing surface"
          aria-multiline="true"
          onBeforeInput={handleBeforeInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionUpdate={handleCompositionUpdate}
          onCompositionEnd={handleCompositionEnd}
          onFocus={onFocus}
          onBlur={onBlur}
          style={{
            width: '100%',
            height: '100%',
            outline: 'none',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            caretColor: 'transparent',
          }}
        >
          <p className="Paragraph" data-paraid={paraId}>
            {initialText || '\u00A0'}
          </p>
        </div>
      </div>
    );
  }
);

WACEditingElement.displayName = 'WACEditingElement';
