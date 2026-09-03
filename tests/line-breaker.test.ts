import { describe, expect, it } from 'vitest';
import { LineBreaker } from '../src/core/LineBreaker';
import { MetricEngine } from '../src/core/MetricEngine';
import { ParagraphBlock, TextStyle } from '../src/core/Types';

describe('LineBreaker', () => {
  const defaultStyle: TextStyle = {
    fontFamily: 'Arial',
    fontSize: 16,
    lineHeight: 24,
  };

  const lineBreaker = new LineBreaker(new MetricEngine());

  it('handles empty paragraphs with a single empty line of line-height', () => {
    const block: ParagraphBlock = {
      id: 'empty_p',
      runs: [{ text: '' }],
      defaultStyle,
    };

    const lines = lineBreaker.breakParagraph(block, 500);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('');
    expect(lines[0].height).toBe(24);
    expect(lines[0].startIndex).toBe(0);
    expect(lines[0].endIndex).toBe(0);
  });

  it('keeps short text within a single line', () => {
    const block: ParagraphBlock = {
      id: 'short_p',
      runs: [{ text: 'Hello World' }],
      defaultStyle,
    };

    const lines = lineBreaker.breakParagraph(block, 500);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello World');
    expect(lines[0].startIndex).toBe(0);
    expect(lines[0].endIndex).toBe(11);
  });

  it('wraps long sentences into multiple lines without exceeding maxWidth', () => {
    const text =
      'The hybrid micro-canvas pagination engine solves the single large paragraph paradox by slicing display tracks while preserving the AST.';
    const block: ParagraphBlock = {
      id: 'wrap_p',
      runs: [{ text }],
      defaultStyle,
    };

    // Narrow width forces multiple wraps
    const maxWidth = 200;
    const lines = lineBreaker.breakParagraph(block, maxWidth);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(maxWidth);
      expect(line.text.length).toBeGreaterThan(0);
    }

    // Verify continuous character indexing across lines
    expect(lines[0].startIndex).toBe(0);
    expect(lines[lines.length - 1].endIndex).toBe(text.length);
  });

  it('preserves formatting across mixed styled runs in a single line or wrapped lines', () => {
    const block: ParagraphBlock = {
      id: 'mixed_p',
      runs: [
        { text: 'This is ' },
        { text: 'bold text ', style: { fontWeight: 'bold' } },
        { text: 'and italic text.', style: { fontStyle: 'italic' } },
      ],
      defaultStyle,
    };

    const lines = lineBreaker.breakParagraph(block, 600);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('This is bold text and italic text.');
    expect(lines[0].runs.length).toBe(3);
    expect(lines[0].runs[1].style?.fontWeight).toBe('bold');
    expect(lines[0].runs[2].style?.fontStyle).toBe('italic');
  });

  it('slices oversized continuous unbroken tokens into character chunks', () => {
    const block: ParagraphBlock = {
      id: 'oversized_token',
      runs: [
        {
          text: 'https://very-long-url-with-no-spaces-that-exceeds-page-width.com/path/to/resource',
        },
      ],
      defaultStyle,
    };

    const maxWidth = 150;
    const lines = lineBreaker.breakParagraph(block, maxWidth);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(maxWidth);
    }
  });
});
