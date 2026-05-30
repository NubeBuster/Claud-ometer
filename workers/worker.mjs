import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { parentPort, workerData } from 'worker_threads';

// Load pricing from the shared JSON file
const PRICING_PATH = path.join(process.cwd(), 'src/config/pricing-data.json');
const MODEL_PRICING = JSON.parse(fs.readFileSync(PRICING_PATH, 'utf-8'));

function findPricing(model) {
  // Exact match first
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];
  
  // Family match
  for (const [key, pricing] of Object.entries(MODEL_PRICING)) {
    const family = key.includes('opus') ? 'opus' : key.includes('sonnet') ? 'sonnet' : 'haiku';
    if (model.includes(family)) return pricing;
  }
  
  // Default to sonnet
  return MODEL_PRICING['claude-sonnet-4-5-20250929'];
}

function calculateCostAllModes(model, input, output, cacheWrite, cacheRead) {
  const pricing = findPricing(model);
  const baseCost = (input / 1_000_000) * pricing.inputPerMillion + (output / 1_000_000) * pricing.outputPerMillion;
  const cacheWriteCost = (cacheWrite / 1_000_000) * pricing.cacheWritePerMillion;
  const cacheReadCost = (cacheRead / 1_000_000) * pricing.cacheReadPerMillion;

  return {
    api: baseCost + cacheWriteCost + cacheReadCost,
    conservative: baseCost + cacheWriteCost * 0.15 + cacheReadCost * 0.05,
    subscription: baseCost + cacheWriteCost * 0.08 + cacheReadCost * 0.01,
  };
}

async function parseFileStats(filePath) {
  const sessionId = filePath.split('/').pop().replace('.jsonl', '');
  let mtime = '';
  try {
    mtime = fs.statSync(filePath).mtime.toISOString();
  } catch {
    mtime = new Date().toISOString();
  }

  const stats = {
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
    estimatedCosts: { api: 0, conservative: 0, subscription: 0 },
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

  const modelsSet = new Set();
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      const ts = msg.timestamp || msg.snapshot?.timestamp;
      if (ts) {
        if (!stats.firstTimestamp) stats.firstTimestamp = ts;
        stats.lastTimestamp = ts;
      }
      if (msg.gitBranch && !stats.gitBranch) stats.gitBranch = msg.gitBranch;
      if (msg.cwd && !stats.cwd) stats.cwd = msg.cwd;
      if (msg.version && !stats.version) stats.version = msg.version;

      if (msg.compactMetadata) {
        stats.compactions++;
        if (msg.timestamp) stats.compactionTimestamps.push(msg.timestamp);
      }
      if (msg.microcompactMetadata) {
        stats.microcompactions++;
        stats.totalTokensSaved += msg.microcompactMetadata.tokensSaved || 0;
        if (msg.timestamp) stats.compactionTimestamps.push(msg.timestamp);
      }

      if (msg.type === 'user') stats.userMessageCount++;
      if (msg.type === 'assistant') {
        stats.assistantMessageCount++;
        const model = msg.message?.model || '';
        if (model) modelsSet.add(model);
        const usage = msg.message?.usage;
        if (usage) {
          const input = usage.input_tokens || 0;
          const output = usage.output_tokens || 0;
          const cacheRead = usage.cache_read_input_tokens || 0;
          const cacheWrite = usage.cache_creation_input_tokens || 0;
          stats.totalInputTokens += input;
          stats.totalOutputTokens += output;
          stats.totalCacheReadTokens += cacheRead;
          stats.totalCacheWriteTokens += cacheWrite;
          
          const costs = calculateCostAllModes(model, input, output, cacheWrite, cacheRead);
          stats.estimatedCosts.api += costs.api;
          stats.estimatedCosts.conservative += costs.conservative;
          stats.estimatedCosts.subscription += costs.subscription;
        }
        const content = msg.message?.content;
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c && typeof c === 'object' && c.type === 'tool_use') {
              stats.toolCallCount++;
              const name = c.name || 'unknown';
              stats.toolsUsed[name] = (stats.toolsUsed[name] || 0) + 1;
            }
          }
        }
      }
    } catch (e) { /* skip malformed line */ }
  }

  stats.models = Array.from(modelsSet);
  return stats;
}

async function run() {
  const { filePaths } = workerData;
  const results = [];
  for (const filePath of filePaths) {
    try {
      results.push(await parseFileStats(filePath));
    } catch (e) {
      results.push({ error: e.message, filePath });
    }
  }
  parentPort.postMessage(results);
}

run().catch(err => {
  console.error('Worker error:', err);
  process.exit(1);
});
