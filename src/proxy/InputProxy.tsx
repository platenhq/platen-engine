import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { CaretCoordinates } from '../core/SelectionTypes';

export interface InputProxyHandles {
  focus: () => void;
  blur: () => void;
  clear: () => void;
  getElement: () => HTMLDivElement | null;
}

export interface InputProxyProps {
  caret: CaretCoordinates | null;
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
 * Invisible floating contenteditable proxy positioned directly over the caret.
 * Captures native keyboard keystrokes, mobile virtual keyboard input, and CJK IME composition.
 */
export const InputProxy = forwardRef<InputProxyHandles, InputProxyProps>(
  (
    {
      caret,
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
    const proxyRef = useRef<HTMLDivElement | null>(null);
    const isComposingRef = useRef(false);

    useImperativeHandle(ref, () => ({
      focus: () => proxyRef.current?.focus(),
      blur: () => proxyRef.current?.blur(),
      clear: () => {
        if (proxyRef.current) proxyRef.current.innerText = '';
      },
      getElement: () => proxyRef.current,
    }));

    useEffect(() => {
      if (autoFocus && proxyRef.current) {
        proxyRef.current.focus();
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
      if (proxyRef.current) {
        proxyRef.current.innerText = '';
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (isComposingRef.current) return;

      onKeyDown?.(e);

      // Fallback for environments where beforeinput delete isn't emitted
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

    const posX = caret ? caret.x : 0;
    const posY = caret ? caret.y : 0;
    const height = caret ? caret.height : 24;

    return (
      <div
        ref={proxyRef}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        tabIndex={0}
        aria-hidden="true"
        onBeforeInput={handleBeforeInput}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionUpdate={handleCompositionUpdate}
        onCompositionEnd={handleCompositionEnd}
        onFocus={onFocus}
        onBlur={onBlur}
        style={{
          position: 'absolute',
          left: `${posX}px`,
          top: `${posY}px`,
          width: '2px',
          height: `${height}px`,
          opacity: 0,
          zIndex: 100,
          pointerEvents: 'auto',
          outline: 'none',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          caretColor: 'transparent',
        }}
      />
    );
  }
);

InputProxy.displayName = 'InputProxy';
