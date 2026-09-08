import { readFile, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { baseline } from './baseline.js';
import { normalizeTemporal } from './temporal.js';
import { validateExtraction, type Extraction, type TemporalValue } from './types.js';

interface EvaluationCase {
  id: string;
  split: 'dev' | 'holdout';
  category: string;
  provenance: { kind: string; source_url: string; note: string };
  text: string;
  posted_at: string;
  truncated: boolean;
  expected: { extraction: Extraction; temporal: Partial<TemporalValue> & { kind: TemporalValue['kind'] } };
}
const flag = (name: string, fallback: string) => {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? fallback : process.argv[index + 1];
};
const model = flag('model', 'baseline');
const split = flag('split', 'holdout');
if (!['phi4mini', 'qwen25', 'qwen3', 'baseline'].includes(model) || !['dev', 'holdout'].includes(split)) throw new Error('Use --model phi4mini|qwen25|qwen3|baseline --split dev|holdout');
const all = JSON.parse(await readFile(new URL('../eval/cases.json', import.meta.url), 'utf8')) as EvaluationCase[];
if (all.length !== 40 || new Set(all.map(c => c.id)).size !== 40 || ['dev','holdout'].some(s => all.filter(c => c.split === s).length !== 20)) throw new Error('Evaluation fixture must contain 40 unique cases split 20/20');
const cases = all.filter(c => c.split === split);
const extractor = model === 'baseline' ? async (text: string) => baseline(text) : (await import('./inference.js')).extract;
const normalized = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
const equivalent = (key: string, actual: unknown, expected: unknown) => {
  if (['at','from','until'].includes(key) && typeof actual === 'string' && typeof expected === 'string') return Date.parse(actual) === Date.parse(expected);
  return actual === expected;
};
const started = performance.now();
const results: Record<string, unknown>[] = [];
let correct = 0, false_completed = 0, false_time = 0, unresolved = 0, errors = 0;
for (const sample of cases) {
  const start = performance.now();
  try {
    const extraction = validateExtraction(await extractor(sample.text));
    const temporal = normalizeTemporal(extraction, { text: sample.text, posted_at: sample.posted_at, truncated: sample.truncated });
    const gold = sample.expected;
    const extractionMatch = extraction.event_type === gold.extraction.event_type && extraction.state === gold.extraction.state && normalized(extraction.time_expression) === normalized(gold.extraction.time_expression);
    const temporalMatch = Object.entries(gold.temporal).every(([key,value]) => equivalent(key, temporal[key as keyof TemporalValue], value));
    const evidenceMatch = extraction.evidence === '' ? extraction.event_type === 'unknown' && extraction.state === 'unknown' : sample.text.includes(extraction.evidence);
    const passed = extractionMatch && temporalMatch && evidenceMatch;
    const falseCompleted = extraction.state === 'completed' && gold.extraction.state !== 'completed';
    const falseTime = temporal.kind !== 'unresolved' && !temporalMatch;
    correct += Number(passed); false_completed += Number(falseCompleted); false_time += Number(falseTime); unresolved += Number(temporal.kind === 'unresolved');
    results.push({ id: sample.id, category: sample.category, passed, extraction_match: extractionMatch, temporal_match: temporalMatch, evidence_match: evidenceMatch, false_completed: falseCompleted, false_time: falseTime, expected: gold, extraction, temporal, elapsed_ms: Math.round(performance.now() - start) });
  } catch (error) {
    errors++;
    results.push({ id: sample.id, category: sample.category, passed: false, expected: sample.expected, error: error instanceof Error ? error.message : String(error), elapsed_ms: Math.round(performance.now() - start) });
  }
}
const report = {
  version: 1, model, split, generated_at: new Date().toISOString(), total: cases.length, correct, accuracy: correct / cases.length,
  false_completed, false_time, unresolved, errors,
  quality_passed: correct / cases.length >= .95 && false_completed === 0 && false_time === 0,
  elapsed_ms: Math.round(performance.now() - started), evaluator_max_rss_kib: process.resourceUsage().maxRSS,
  memory_scope: 'Evaluator process only. Inference server memory is measured separately by the workflow.',
  hardware: { platform: process.platform, architecture: process.arch, cpus: os.cpus().length, cpu_model: os.cpus()[0]?.model, total_memory_bytes: os.totalmem(), runner: process.env.RUNNER_NAME ?? null },
  results,
};
await mkdir('.cache/evaluation', { recursive: true });
const path = `.cache/evaluation/${model}-${split}.json`;
await writeFile(path, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ report: path, ...Object.fromEntries(Object.entries(report).filter(([key]) => !['results','hardware'].includes(key))) }, null, 2));
