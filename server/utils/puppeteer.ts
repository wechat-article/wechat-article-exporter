import puppeteer, { type Browser } from 'puppeteer';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (browser && browser.connected) {
    return browser;
  }

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-extensions',
    '--font-render-hinting=none',
  ];

  browser = await puppeteer.launch({
    headless: true,
    args: launchArgs,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  browser.on('disconnected', () => {
    browser = null;
  });

  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

process.on('exit', () => {
  browser?.close();
});

process.on('SIGINT', async () => {
  await closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await closeBrowser();
  process.exit(0);
});
