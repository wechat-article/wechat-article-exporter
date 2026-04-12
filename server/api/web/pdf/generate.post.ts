import { getBrowser } from '~/server/utils/puppeteer';

export default defineEventHandler(async (event) => {
  const html = await readBody<string>(event);
  if (!html || typeof html !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '请求体必须是 HTML 字符串' });
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });

    const contentHeight = await page.evaluate(
      // @ts-expect-error runs in browser context
      () => Math.max(document.body.scrollHeight, document.body.offsetHeight, document.documentElement.scrollHeight, document.documentElement.offsetHeight),
    );

    const pdfBuffer = await page.pdf({
      width: '210mm',
      height: `${contentHeight}px`,
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });

    setResponseHeader(event, 'Content-Type', 'application/pdf');
    return pdfBuffer;
  } finally {
    await page.close();
  }
});
