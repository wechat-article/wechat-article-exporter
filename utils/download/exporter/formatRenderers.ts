import TurndownService from 'turndown';

export type ExportFileWriter = (path: string, file: Blob) => Promise<void>;

export interface ExportFormatWriteResult {
  written: boolean;
  path?: string;
  type?: string;
  reason?: 'empty-content';
}

export interface MarkdownConverter {
  turndown(html: string): string;
}

export interface HtmlDocxAdapter {
  asBlob(html: string): Blob | BlobPart;
}

interface TextExportOptions {
  filename: string;
  content: string;
  writeFile: ExportFileWriter;
}

interface MarkdownExportOptions {
  filename: string;
  html: string;
  writeFile: ExportFileWriter;
  converter?: MarkdownConverter;
}

interface WordExportOptions {
  filename: string;
  html: string;
  writeFile: ExportFileWriter;
  htmlDocx?: HtmlDocxAdapter;
}

const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const HTML_DOCX_SCRIPT_SRC = '/vendors/html-docx-js@0.3.1/html-docx.js';

let htmlDocxLoadPromise: Promise<HtmlDocxAdapter> | null = null;

function getBrowserHtmlDocx(): HtmlDocxAdapter | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  const adapter = (window as unknown as { htmlDocx?: HtmlDocxAdapter }).htmlDocx;
  return adapter?.asBlob ? adapter : undefined;
}

function skippedEmptyContent(): ExportFormatWriteResult {
  return {
    written: false,
    reason: 'empty-content',
  };
}

export async function loadHtmlDocxAdapter(): Promise<HtmlDocxAdapter> {
  const adapter = getBrowserHtmlDocx();
  if (adapter) {
    return adapter;
  }

  if (typeof document === 'undefined') {
    throw new Error('DOCX export requires a browser runtime');
  }

  if (!htmlDocxLoadPromise) {
    htmlDocxLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = HTML_DOCX_SCRIPT_SRC;
      script.defer = true;
      script.async = true;
      script.onload = () => {
        const loadedAdapter = getBrowserHtmlDocx();
        htmlDocxLoadPromise = null;
        if (loadedAdapter) {
          resolve(loadedAdapter);
          return;
        }
        reject(new Error('DOCX vendor script loaded without htmlDocx adapter'));
      };
      script.onerror = () => {
        htmlDocxLoadPromise = null;
        reject(new Error('DOCX vendor script could not be loaded'));
      };
      document.head.appendChild(script);
    });
  }

  return htmlDocxLoadPromise;
}

export async function writeTextExportFile(options: TextExportOptions): Promise<ExportFormatWriteResult> {
  if (!options.content) {
    return skippedEmptyContent();
  }

  const path = `${options.filename}.txt`;
  const type = 'text/plain';
  await options.writeFile(path, new Blob([options.content], { type }));
  return {
    written: true,
    path,
    type,
  };
}

export async function writeMarkdownExportFile(options: MarkdownExportOptions): Promise<ExportFormatWriteResult> {
  if (!options.html) {
    return skippedEmptyContent();
  }

  const converter = options.converter ?? new TurndownService();
  const markdown = converter.turndown(options.html);
  const path = `${options.filename}.md`;
  const type = 'text/markdown';
  await options.writeFile(path, new Blob([markdown], { type }));
  return {
    written: true,
    path,
    type,
  };
}

export async function writeWordExportFile(options: WordExportOptions): Promise<ExportFormatWriteResult> {
  if (!options.html) {
    return skippedEmptyContent();
  }

  const htmlDocx = options.htmlDocx ?? (await loadHtmlDocxAdapter());

  const raw = htmlDocx.asBlob(options.html);
  const blob = raw instanceof Blob ? raw : new Blob([raw], { type: WORD_MIME });
  const path = `${options.filename}.docx`;
  await options.writeFile(path, blob);
  return {
    written: true,
    path,
    type: blob.type || WORD_MIME,
  };
}
