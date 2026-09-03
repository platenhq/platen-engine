import { MetricEngine } from './MetricEngine';
import { ParagraphBlock, TextLine, TextRun, TextStyle } from './Types';

interface AtomicToken {
  text: string;
  isSpace: boolean;
  style: TextStyle;
  width: number;
  height: number;
  ascent: number;
  startIndex: number;
  endIndex: number;
}

/**
 * Deterministic word-wrapping and line segmentation engine.
 * Takes a multi-run paragraph and slices it into TextLines based on usable width.
 */
export class LineBreaker {
  private metricEngine: MetricEngine;

  constructor(metricEngine?: MetricEngine) {
    this.metricEngine = metricEngine || new MetricEngine();
  }

  /**
   * Slices a paragraph block into an array of wrapped TextLines.
   */
  public breakParagraph(block: ParagraphBlock, maxWidth: number): TextLine[] {
    const defaultStyle = block.defaultStyle || {
      fontFamily: 'Arial',
      fontSize: 16,
      lineHeight: 24,
    };

    // Handle empty paragraph (e.g. empty line created by pressing Enter)
    if (!block.runs || block.runs.length === 0 || block.runs.every((r) => r.text === '')) {
      const defaultMetrics = this.metricEngine.getRunMetrics('', defaultStyle);
      return [
        {
          text: '',
          startIndex: 0,
          endIndex: 0,
          width: 0,
          height: defaultMetrics.height,
          ascent: defaultMetrics.ascent,
          runs: [{ text: '', style: defaultStyle }],
        },
      ];
    }

    // Step 1: Tokenize all runs into atomic tokens (words, spaces, punctuation)
    const tokens = this.tokenizeRuns(block.runs, defaultStyle);

    if (tokens.length === 0) {
      const defaultMetrics = this.metricEngine.getRunMetrics('', defaultStyle);
      return [
        {
          text: '',
          startIndex: 0,
          endIndex: 0,
          width: 0,
          height: defaultMetrics.height,
          ascent: defaultMetrics.ascent,
          runs: [{ text: '', style: defaultStyle }],
        },
      ];
    }

    // Step 2: Line-breaking accumulator
    const lines: TextLine[] = [];
    let currentTokens: AtomicToken[] = [];
    let currentLineWidth = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      // If token is larger than maxWidth on its own (unbroken long word), force character slicing
      if (token.width > maxWidth && !token.isSpace) {
        // First flush any preceding tokens
        if (currentTokens.length > 0) {
          lines.push(this.buildLineFromTokens(currentTokens));
          currentTokens = [];
          currentLineWidth = 0;
        }

        // Break the oversized token into character chunks that fit
        const chunks = this.sliceOversizedToken(token, maxWidth);
        for (let c = 0; c < chunks.length - 1; c++) {
          lines.push(this.buildLineFromTokens([chunks[c]]));
        }
        // Keep the last chunk in current line
        const lastChunk = chunks[chunks.length - 1];
        currentTokens.push(lastChunk);
        currentLineWidth = lastChunk.width;
        continue;
      }

      // Check if adding this token overflows maxWidth
      // (Trailing whitespace is allowed to hang past the margin boundary until non-space arrives)
      const wouldOverflow = currentLineWidth + token.width > maxWidth;

      if (wouldOverflow && currentTokens.length > 0) {
        // If current token is a space, don't wrap yet if it's trailing, but if we have non-spaces, wrap
        if (token.isSpace) {
          // Drop space at end of line if it overflows
          lines.push(this.buildLineFromTokens(currentTokens));
          currentTokens = [];
          currentLineWidth = 0;
          continue;
        }

        lines.push(this.buildLineFromTokens(currentTokens));
        currentTokens = [token];
        currentLineWidth = token.width;
      } else {
        // If line is empty and token is leading space, skip leading space at start of line
        if (currentTokens.length === 0 && token.isSpace) {
          continue;
        }

        currentTokens.push(token);
        currentLineWidth += token.width;
      }
    }

    if (currentTokens.length > 0) {
      lines.push(this.buildLineFromTokens(currentTokens));
    }

    return lines;
  }

  /**
   * Tokenizes text runs into words and whitespace fragments preserving character index offsets.
   */
  private tokenizeRuns(runs: TextRun[], defaultStyle: TextStyle): AtomicToken[] {
    const tokens: AtomicToken[] = [];
    let cumulativeCharIndex = 0;

    for (const run of runs) {
      const mergedStyle: TextStyle = { ...defaultStyle, ...run.style };
      const text = run.text;
      if (!text) continue;

      // Regex matching words or sequences of whitespace
      const regex = /\S+|\s+/g;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const tokenText = match[0];
        const isSpace = /^\s+$/.test(tokenText);
        const startIndex = cumulativeCharIndex + match.index;
        const endIndex = startIndex + tokenText.length;
        const metrics = this.metricEngine.getRunMetrics(tokenText, mergedStyle);

        tokens.push({
          text: tokenText,
          isSpace,
          style: mergedStyle,
          width: metrics.width,
          height: metrics.height,
          ascent: metrics.ascent,
          startIndex,
          endIndex,
        });
      }

      cumulativeCharIndex += text.length;
    }

    return tokens;
  }

  /**
   * Slices an oversized token (e.g. URL or continuous string without spaces) into character chunks.
   */
  private sliceOversizedToken(token: AtomicToken, maxWidth: number): AtomicToken[] {
    const chunks: AtomicToken[] = [];
    let currentChunkText = '';
    let currentChunkStart = token.startIndex;
    let currentCharIndex = token.startIndex;

    for (const char of token.text) {
      const testText = currentChunkText + char;
      const metrics = this.metricEngine.getRunMetrics(testText, token.style);

      if (metrics.width > maxWidth && currentChunkText.length > 0) {
        const chunkMetrics = this.metricEngine.getRunMetrics(currentChunkText, token.style);
        chunks.push({
          text: currentChunkText,
          isSpace: false,
          style: token.style,
          width: chunkMetrics.width,
          height: chunkMetrics.height,
          ascent: chunkMetrics.ascent,
          startIndex: currentChunkStart,
          endIndex: currentCharIndex,
        });

        currentChunkText = char;
        currentChunkStart = currentCharIndex;
      } else {
        currentChunkText = testText;
      }

      currentCharIndex += char.length;
    }

    if (currentChunkText.length > 0) {
      const chunkMetrics = this.metricEngine.getRunMetrics(currentChunkText, token.style);
      chunks.push({
        text: currentChunkText,
        isSpace: false,
        style: token.style,
        width: chunkMetrics.width,
        height: chunkMetrics.height,
        ascent: chunkMetrics.ascent,
        startIndex: currentChunkStart,
        endIndex: token.endIndex,
      });
    }

    return chunks;
  }

  /**
   * Converts a collection of tokens into a final TextLine with merged runs.
   */
  private buildLineFromTokens(tokens: AtomicToken[]): TextLine {
    // Trim trailing whitespace tokens from line end
    while (tokens.length > 0 && tokens[tokens.length - 1].isSpace) {
      tokens.pop();
    }

    if (tokens.length === 0) {
      return {
        text: '',
        startIndex: 0,
        endIndex: 0,
        width: 0,
        height: 0,
        ascent: 0,
        runs: [],
      };
    }

    const firstToken = tokens[0];
    const lastToken = tokens[tokens.length - 1];

    let fullLineText = '';
    let maxHeight = 0;
    let maxAscent = 0;
    let totalWidth = 0;

    const runs: TextRun[] = [];
    let currentRunText = '';
    let currentRunStyle = firstToken.style;

    for (const token of tokens) {
      fullLineText += token.text;
      totalWidth += token.width;
      if (token.height > maxHeight) maxHeight = token.height;
      if (token.ascent > maxAscent) maxAscent = token.ascent;

      // Group consecutive tokens sharing the exact same font/style into runs
      if (this.areStylesEqual(currentRunStyle, token.style)) {
        currentRunText += token.text;
      } else {
        if (currentRunText.length > 0) {
          runs.push({ text: currentRunText, style: currentRunStyle });
        }
        currentRunText = token.text;
        currentRunStyle = token.style;
      }
    }

    if (currentRunText.length > 0) {
      runs.push({ text: currentRunText, style: currentRunStyle });
    }

    return {
      text: fullLineText,
      startIndex: firstToken.startIndex,
      endIndex: lastToken.endIndex,
      width: Math.round(totalWidth * 2) / 2,
      height: maxHeight,
      ascent: maxAscent,
      runs,
    };
  }

  private areStylesEqual(a: TextStyle, b: TextStyle): boolean {
    return (
      a.fontFamily === b.fontFamily &&
      a.fontSize === b.fontSize &&
      a.fontWeight === b.fontWeight &&
      a.fontStyle === b.fontStyle &&
      a.color === b.color &&
      a.lineHeight === b.lineHeight
    );
  }
}
