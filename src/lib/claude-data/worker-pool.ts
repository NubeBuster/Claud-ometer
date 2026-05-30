import { Worker } from 'worker_threads';
import path from 'path';
import os from 'os';
import type { FileStats } from './parser';

const WORKER_PATH = path.join(process.cwd(), 'workers/worker.mjs');
const CPU_COUNT = os.cpus().length || 4;
const MAX_WORKERS = Math.max(1, CPU_COUNT - 1); // Leave one core for main thread

export async function runInPool(filePaths: string[]): Promise<FileStats[]> {
  if (filePaths.length === 0) return [];
  
  // If only a few files, don't bother with workers
  if (filePaths.length < 10) {
    const { parseFileStats } = await import('./parser');
    return Promise.all(filePaths.map(parseFileStats));
  }

  const batchSize = Math.ceil(filePaths.length / MAX_WORKERS);
  const batches: string[][] = [];
  for (let i = 0; i < filePaths.length; i += batchSize) {
    batches.push(filePaths.slice(i, i + batchSize));
  }

  const workerPromises = batches.map(batch => {
    return new Promise<FileStats[]>((resolve, reject) => {
      const worker = new Worker(WORKER_PATH, {
        workerData: { filePaths: batch }
      });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
      });
    });
  });

  const results = await Promise.all(workerPromises);
  return results.flat();
}
