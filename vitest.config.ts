import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import type { BrowserCommand } from 'vitest/node';

/**
 * Prints the test document to a real PDF and reports its paper size and the text on each
 * page. The test runs inside an iframe, so its markup is copied into a page of its own.
 */
const printToPdf: BrowserCommand<[]> = async (ctx) => {
  const frame = await ctx.frame();
  const html = await frame.content();
  const page = await ctx.context.newPage();
  try {
    await page.setContent(html);
    const buffer = await page.pdf({ preferCSSPageSize: true });
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;

    const pages: string[] = [];
    let size = { width: 0, height: 0 };
    for (let number = 1; number <= pdf.numPages; number++) {
      const pdfPage = await pdf.getPage(number);
      const [, , width, height] = pdfPage.view;
      if (number === 1) size = { width, height };
      const content = await pdfPage.getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
    }
    return { pages, size };
  } finally {
    await page.close();
  }
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
          exclude: ['tests/browser/**'],
        },
      },
      {
        // Development warnings are gated on this, as a consumer's bundler would set it.
        define: { 'process.env.NODE_ENV': JSON.stringify('development') },
        test: {
          name: 'browser',
          globals: true,
          include: ['tests/browser/**/*.test.tsx'],
          browser: {
            enabled: true,
            headless: true,
            commands: { printToPdf },
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
