import fs from 'fs';
import readline from 'readline';
import { calculateCostAllModes } from '@/config/pricing';
import type { SessionMessage, CostEstimates } from './types';

export function zeroCosts(): CostEstimates {
  return { api: 0, conservative: 0, subscription: 0 };
}

export function addCosts(a: CostEstimates, b: CostEstimates): CostEstimates {
  return {
    api: a.api + (b.api || 0),
    conservative: a.conservative + (b.conservative || 0),
    subscription: a.subscription + (b.subscription || 0),
  };
}

export async function forEachJsonlLine(filePath: string, callback: (msg: SessionMessage) => void): Promise<void> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line) as SessionMessage;
      callback(msg);
    } catch { /* skip malformed line */ }
  }
}

export interface FileStats {
  sessionId: string;
  firstTimestamp: string;
  lastTimestamp: string;
  mtime: string;
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  estimatedCosts: CostEstimates;
  gitBranch: string;
  cwd: string;
  version: string;
  models: string[];
  toolsUsed: Record<string, number>;
  compactions: number;
  microcompactions: number;
  totalTokensSaved: number;
  compactionTimestamps: string[];
}

export async function parseFileStats(filePath: string): Promise<FileStats> {
  const sessionId = filePath.split('/').pop()?.replace('.jsonl', '') || '';
  let mtime = '';
  try {
    mtime = fs.statSync(filePath).mtime.toISOString();
  } catch {
    mtime = new Date().toISOString();
  }

  const stats: FileStats = {
    sessionId,
    firstTimestamp: '',
    lastTimestamp: '',
    mtime,
    userMessageCount: 0,
    assistantMessageCount: 0,
    toolCallCount: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    estimatedCosts: zeroCosts(),
    gitBranch: '',
    cwd: '',
    version: '',
    models: [],
    toolsUsed: {},
    compactions: 0,
    microcompactions: 0,
    totalTokensSaved: 0,
    compactionTimestamps: [],
  };

  const modelsSet = new Set<string>();

  await forEachJsonlLine(filePath, (msg) => {
    const ts = msg.timestamp || (msg as any).snapshot?.timestamp;
    if (ts) {
      if (!stats.firstTimestamp) stats.firstTimestamp = ts;
      stats.lastTimestamp = ts;
    }
    if (msg.gitBranch && !stats.gitBranch) stats.gitBranch = msg.gitBranch;
    if (msg.cwd && !stats.cwd) stats.cwd = msg.cwd;
    if (msg.version && !stats.version) stats.version = msg.version;

    // Track compaction events
    if (msg.compactMetadata) {
      stats.compactions++;
      if (msg.timestamp) stats.compactionTimestamps.push(msg.timestamp);
    }
    if (msg.microcompactMetadata) {
      stats.microcompactions++;
      stats.totalTokensSaved += msg.microcompactMetadata.tokensSaved || 0;
      if (msg.timestamp) stats.compactionTimestamps.push(msg.timestamp);
    }

    if (msg.type === 'user') {
      stats.userMessageCount++;
    }
    if (msg.type === 'assistant') {
      stats.assistantMessageCount++;
      const model = msg.message?.model || '';
      if (model) modelsSet.add(model);
      const usage = msg.message?.usage;
      if (usage) {
        stats.totalInputTokens += usage.input_tokens || 0;
        stats.totalOutputTokens += usage.output_tokens || 0;
        stats.totalCacheReadTokens += usage.cache_read_input_tokens || 0;
        stats.totalCacheWriteTokens += usage.cache_creation_input_tokens || 0;
        const costs = calculateCostAllModes(
          model,
          usage.input_tokens || 0,
          usage.output_tokens || 0,
          usage.cache_creation_input_tokens || 0,
          usage.cache_read_input_tokens || 0
        );
        stats.estimatedCosts = addCosts(stats.estimatedCosts, costs);
      }
      const content = msg.message?.content;
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c && typeof c === 'object' && 'type' in c && c.type === 'tool_use') {
            stats.toolCallCount++;
            const name = ('name' in c ? c.name : 'unknown') as string;
            stats.toolsUsed[name] = (stats.toolsUsed[name] || 0) + 1;
          }
        }
      }
    }
  });

  stats.models = Array.from(modelsSet);
  return stats;
}
