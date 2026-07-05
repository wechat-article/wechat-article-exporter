import { afterEach, describe, expect, it } from 'vitest';
import {
  HTML_DOCX_SCRIPT_SRC,
  writeMarkdownExportFile,
  writeTextExportFile,
  writeWordExportFile,
} from '~/utils/download/exporter/formatRenderers';

type WriteCall = {
  path: string;
  file: Blob;
};

function createWriteRecorder() {
  const calls: WriteCall[] = [];
  return {
    calls,
    writeFile: async (path: string, file: Blob) => {
      calls.push({ path, file });
    },
  };
}

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

function restoreGlobalRuntime() {
  if (originalWindow === undefined) {
    delete (globalThis as typeof globalThis & { window?: Window }).window;
  } else {
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  }

  if (originalDocument === undefined) {
    delete (globalThis as typeof globalThis & { document?: Document }).document;
  } else {
    Object.defineProperty(globalThis, 'document', {
      value: originalDocument,
      configurable: true,
      writable: true,
    });
  }
}

describe('format renderers', () => {
  afterEach(() => {
    restoreGlobalRuntime();
  });

  it('writes TXT content as a plain text file', async () => {
    const recorder = createWriteRecorder();

    const result = await writeTextExportFile({
      filename: 'account/article',
      content: 'hello text',
      writeFile: recorder.writeFile,
    });

    expect(result).toEqual({
      written: true,
      path: 'account/article.txt',
      type: 'text/plain',
    });
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0].file.type).toBe('text/plain');
    await expect(recorder.calls[0].file.text()).resolves.toBe('hello text');
  });

  it('writes Markdown content through the configured converter', async () => {
    const recorder = createWriteRecorder();

    const result = await writeMarkdownExportFile({
      filename: 'account/article',
      html: '<h1>Title</h1>',
      converter: {
        turndown: html => `converted:${html}`,
      },
      writeFile: recorder.writeFile,
    });

    expect(result.path).toBe('account/article.md');
    expect(result.type).toBe('text/markdown');
    expect(recorder.calls).toHaveLength(1);
    expect(recorder.calls[0].file.type).toBe('text/markdown');
    await expect(recorder.calls[0].file.text()).resolves.toBe('converted:<h1>Title</h1>');
  });

  it('writes Word content through htmlDocx', async () => {
    const recorder = createWriteRecorder();

    const result = await writeWordExportFile({
      filename: 'account/article',
      html: '<p>word</p>',
      htmlDocx: {
        asBlob: html => new Blob([`doc:${html}`], { type: 'application/docx-test' }),
      },
      writeFile: recorder.writeFile,
    });

    expect(result).toEqual({
      written: true,
      path: 'account/article.docx',
      type: 'application/docx-test',
    });
    expect(recorder.calls).toHaveLength(1);
    await expect(recorder.calls[0].file.text()).resolves.toBe('doc:<p>word</p>');
  });

  it('loads the Word vendor script only when no adapter is injected', async () => {
    const recorder = createWriteRecorder();
    const appendedScripts: Array<{
      src?: string;
      defer?: boolean;
      async?: boolean;
      onload?: () => void;
    }> = [];
    const fakeWindow: { htmlDocx?: { asBlob(html: string): Blob } } = {};
    const fakeDocument = {
      createElement: () => ({}),
      head: {
        appendChild: (script: (typeof appendedScripts)[number]) => {
          appendedScripts.push(script);
          fakeWindow.htmlDocx = {
            asBlob: html => new Blob([`lazy-doc:${html}`], { type: 'application/docx-lazy-test' }),
          };
          script.onload?.();
          return script;
        },
      },
    };

    Object.defineProperty(globalThis, 'window', {
      value: fakeWindow,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(globalThis, 'document', {
      value: fakeDocument,
      configurable: true,
      writable: true,
    });

    const result = await writeWordExportFile({
      filename: 'account/lazy-article',
      html: '<p>lazy word</p>',
      writeFile: recorder.writeFile,
    });

    expect(result).toEqual({
      written: true,
      path: 'account/lazy-article.docx',
      type: 'application/docx-lazy-test',
    });
    expect(appendedScripts).toHaveLength(1);
    expect(appendedScripts[0].src).toBe(HTML_DOCX_SCRIPT_SRC);
    expect(appendedScripts[0].defer).toBe(true);
    expect(appendedScripts[0].async).toBe(true);
    await expect(recorder.calls[0].file.text()).resolves.toBe('lazy-doc:<p>lazy word</p>');
  });

  it('skips empty content without writing a file', async () => {
    const recorder = createWriteRecorder();

    const result = await writeTextExportFile({
      filename: 'account/article',
      content: '',
      writeFile: recorder.writeFile,
    });

    expect(result).toEqual({
      written: false,
      reason: 'empty-content',
    });
    expect(recorder.calls).toHaveLength(0);
  });
});
