import dayjs from 'dayjs';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import PQueue from 'p-queue';

export type ExportStorageMode = 'filesystem' | 'zip';

export interface ExportStorageFallbackEvent {
  mode: 'zip';
  reason: string;
}

interface ExportStorageRuntime {
  location?: {
    hostname?: string;
  };
  showDirectoryPicker?: (options: {
    mode: 'readwrite';
    startIn: 'downloads';
  }) => Promise<FileSystemDirectoryHandle>;
}

interface PrepareExportStorageOptions {
  directZip?: boolean;
  runtime?: ExportStorageRuntime;
}

const LOCAL_DIRECT_ZIP_REASON = '当前为本地/私有化访问，已跳过文件夹选择，完成后将直接下载 ZIP 压缩包';
const UNSUPPORTED_PICKER_REASON = '当前环境不支持文件夹选择，将使用 ZIP 打包下载';

function getRuntimeWindow(): ExportStorageRuntime | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }
  return window as unknown as ExportStorageRuntime;
}

export function shouldUseDirectZip(options: { directZip?: boolean; hostname?: string } = {}): boolean {
  const { directZip, hostname } = options;
  if (directZip === true) {
    return true;
  }
  if (directZip === false) {
    return false;
  }
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

export function splitExportPath(path: string): { directories: string[]; filename: string } {
  const segments = path.split('/').filter(segment => segment.length > 0);
  const filename = segments[segments.length - 1];
  if (!filename) {
    throw new Error('导出文件路径不能为空');
  }
  return {
    directories: segments.slice(0, -1),
    filename,
  };
}

export class ExportStorageWriter {
  private directoryHandle: FileSystemDirectoryHandle | null = null;
  private storageMode: ExportStorageMode = 'filesystem';
  private zipArchive: JSZip | null = null;
  private zipWriteQueue: PQueue | null = null;
  private zipFallbackReason = '';

  public get mode(): ExportStorageMode {
    return this.storageMode;
  }

  public reset(): void {
    this.directoryHandle = null;
    this.storageMode = 'filesystem';
    this.zipArchive = null;
    this.zipWriteQueue = null;
    this.zipFallbackReason = '';
  }

  public async prepare(options: PrepareExportStorageOptions = {}): Promise<void> {
    const runtime = options.runtime ?? getRuntimeWindow();
    if (shouldUseDirectZip({ directZip: options.directZip, hostname: runtime?.location?.hostname })) {
      this.enableZipExportFallback(LOCAL_DIRECT_ZIP_REASON);
      return;
    }

    if (typeof runtime?.showDirectoryPicker !== 'function') {
      this.enableZipExportFallback(UNSUPPORTED_PICKER_REASON);
      return;
    }

    try {
      this.directoryHandle = await runtime.showDirectoryPicker({
        mode: 'readwrite',
        startIn: 'downloads',
      });
      this.storageMode = 'filesystem';
    } catch {
      this.enableZipExportFallback();
    }
  }

  public getFallbackEvent(): ExportStorageFallbackEvent | null {
    if (this.storageMode !== 'zip') {
      return null;
    }
    return {
      mode: 'zip',
      reason: this.zipFallbackReason,
    };
  }

  public async flushZipDownload(): Promise<void> {
    if (!this.zipArchive) {
      return;
    }

    const blob = await this.zipArchive.generateAsync({
      type: 'blob',
      compression: 'DEFLATE',
    });
    const name = `wechat-article-export-${dayjs().format('YYYY-MM-DD-HHmmss')}.zip`;
    saveAs(blob, name);
  }

  public async writeFile(path: string, file: Blob): Promise<void> {
    if (this.storageMode === 'zip' && this.zipArchive && this.zipWriteQueue) {
      await this.zipWriteQueue.add(() => {
        return this.addFileToZip(path, file);
      });
      return;
    }

    await this.writeFileToDirectory(path, file);
  }

  private enableZipExportFallback(message?: string): void {
    this.storageMode = 'zip';
    this.directoryHandle = null;
    this.zipArchive = new JSZip();
    this.zipWriteQueue = new PQueue({ concurrency: 1 });
    this.zipFallbackReason = message ?? '';
  }

  private async addFileToZip(path: string, file: Blob): Promise<void> {
    const zip = this.zipArchive!;
    const { directories, filename } = splitExportPath(path);
    let folder: JSZip = zip;
    for (const name of directories) {
      const next = folder.folder(name);
      if (!next) {
        throw new Error(`无法创建 ZIP 目录: ${name}`);
      }
      folder = next;
    }
    folder.file(filename, await file.arrayBuffer());
  }

  private async writeFileToDirectory(path: string, file: Blob): Promise<void> {
    if (!this.directoryHandle) {
      throw new Error('导出目录未初始化');
    }

    const { directories, filename } = splitExportPath(path);
    let directory = this.directoryHandle;
    for (const name of directories) {
      directory = await directory.getDirectoryHandle(name, { create: true }).catch(e => {
        console.warn(`路径(${path})(${name})中包含非法字符，不能作为文件系统的路径名`);
        throw e;
      });
    }
    const fileHandle = await directory.getFileHandle(filename, { create: true });
    // File System Access API writable handles are available only in supported browsers.
    const writable = await fileHandle.createWritable();
    await writable.write(file);
    await writable.close();
  }
}
