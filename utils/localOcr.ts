import { createWorker, Worker } from 'tesseract.js';
import { cleanOcrText } from './textCleaner.ts';

export interface OcrProgressCallback {
  (status: string, progress: number): void;
}

export interface LocalOcrResult {
  text: string;
  cleanedText: string;
  confidence: number;
  durationMs: number;
  linesCount: number;
}

class LocalOcrService {
  private static instance: LocalOcrService;
  private worker: Worker | null = null;
  private isInitializing = false;
  private initPromise: Promise<Worker> | null = null;

  private constructor() {}

  public static getInstance(): LocalOcrService {
    if (!LocalOcrService.instance) {
      LocalOcrService.instance = new LocalOcrService();
    }
    return LocalOcrService.instance;
  }

  /**
   * Initializes WebAssembly Tesseract.js worker with Russian and English language packs
   */
  public async initWorker(onProgress?: OcrProgressCallback): Promise<Worker> {
    if (this.worker) return this.worker;

    if (this.isInitializing && this.initPromise) {
      return this.initPromise;
    }

    this.isInitializing = true;
    this.initPromise = (async () => {
      try {
        const worker = await createWorker(['rus', 'eng'], 1, {
          logger: (m: any) => {
            if (onProgress && m.status) {
              onProgress(m.status, m.progress || 0);
            }
          }
        });
        this.worker = worker;
        this.isInitializing = false;
        return worker;
      } catch (err) {
        this.isInitializing = false;
        this.initPromise = null;
        console.error('Failed to init Tesseract.js Worker:', err);
        throw err;
      }
    })();

    return this.initPromise;
  }

  /**
   * Recognizes text directly from an image file, blob, or base64 data URL locally in WebAssembly
   */
  public async recognize(
    imageSource: File | Blob | string,
    onProgress?: OcrProgressCallback
  ): Promise<LocalOcrResult> {
    const startTime = performance.now();
    const worker = await this.initWorker(onProgress);

    if (onProgress) onProgress('Распознавание текста...', 0.3);

    const ret = await worker.recognize(imageSource);
    const durationMs = Math.round(performance.now() - startTime);

    const rawText = ret.data.text || '';
    const cleaned = cleanOcrText(rawText);
    const lines = cleaned.split('\n').filter(l => l.trim().length > 0);

    if (onProgress) onProgress('Готово', 1.0);

    return {
      text: rawText,
      cleanedText: cleaned,
      confidence: ret.data.confidence || 0,
      durationMs,
      linesCount: lines.length
    };
  }

  /**
   * Terminates the worker to free memory
   */
  public async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.initPromise = null;
      this.isInitializing = false;
    }
  }
}

export const localOcr = LocalOcrService.getInstance();
