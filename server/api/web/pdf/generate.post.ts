import { getBrowser } from '~/server/utils/puppeteer';

export default defineEventHandler(async (event) => {
  const html = await readBody<string>(event);
  if (!html || typeof html !== 'string') {
    throw createError({ statusCode: 400, statusMessage: '请求体必须是 HTML 字符串' });
  }

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '10mm', right: '10mm' },
    });

    setResponseHeader(event, 'Content-Type', 'application/pdf');
    return pdfBuffer;
  } finally {
    await page.close();
  }
});
