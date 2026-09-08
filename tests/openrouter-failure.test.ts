import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/openrouter.ts';

type Failure = 'http' | 'network' | 'malformed';

async function exerciseFailure(kind: Failure) {
  const directory = await mkdtemp(join(tmpdir(), 'openrouter-failure-'));
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const originalTimeout = globalThis.setTimeout;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalLimit = process.env.OPENROUTER_MAX_POSTS;
  const models = ['a', 'b', 'c'].map((author, index) => ({
    id: `${author}/test:free`, pricing: { prompt: '0', completion: '0', request: '0' },
    supported_parameters: ['reasoning', 'max_tokens'], context_length: 32768,
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    benchmarks: { artificial_analysis: { intelligence_index: 30 - index } },
  }));
  const now = new Date().toISOString();
  const source = JSON.stringify({ last_success_at: now, events: [{
    id: 'test-post', source: { text: 'Unrelated product news.', posted_at: now, truncated: false },
  }] });
  let requests = 0;
  try {
    await mkdir(join(directory, '.cache/openrouter'), { recursive: true });
    await mkdir(join(directory, 'data'));
    await writeFile(join(directory, '.cache/openrouter/catalog.json'), JSON.stringify({ fetched_at: now, models, selected: models }));
    await writeFile(join(directory, 'data/events.json'), source);
    process.chdir(directory);
    process.env.OPENROUTER_API_KEY = 'test-only-dummy-key';
    process.env.OPENROUTER_MAX_POSTS = '1';
    // Eliminate rate-limit pacing only; fetch is completely mocked below.
    globalThis.setTimeout = ((callback: (...args: unknown[]) => void, _delay?: number, ...args: unknown[]) =>
      originalTimeout(callback, 0, ...args)) as typeof globalThis.setTimeout;
    globalThis.fetch = async (input, init) => {
      if (String(input) === 'https://openrouter.ai/api/v1/models') return Response.json({ data: models });
      assert.equal(String(input), 'https://openrouter.ai/api/v1/chat/completions');
      requests++;
      if (requests === 1) {
        if (kind === 'http') return new Response('Rate limited', { status: 429 });
        if (kind === 'network') throw new TypeError('Simulated network failure');
        return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{invalid JSON' } }] });
      }
      const request = JSON.parse(String(init?.body));
      const review = request.messages[0].content.includes('Now audit');
      const content = review ? { verdict: 'supported', evidence: '' } : {
        event_type: 'unknown', state: 'unknown', conditional: false, condition: '',
        evidence: '', time_expression: '', time_basis: 'none',
      };
      return Response.json({ model: request.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] });
    };

    await assert.rejects(main('council'), kind === 'http' ? /HTTP 429/ : /failed model responses/);
    const report = JSON.parse(await readFile('.cache/openrouter/council.json', 'utf8'));
    assert.equal(report.status, 'failed');
    assert.equal(report.requests, requests);
    assert.ok(report.calls.some((call: { error?: string }) => typeof call.error === 'string'));
    assert.ok(report.results.every((result: { status: string; publication: string }) =>
      result.status === 'unresolved' && result.publication === 'not_published'));
    if (kind === 'http') {
      assert.equal(requests, 1, 'HTTP failures must stop without retry or fallback');
      assert.ok(report.calls.some((call: { http_status?: number }) => call.http_status === 429));
    } else {
      assert.equal(report.results.length, 1, 'Partial results must survive later successful calls');
      assert.equal(report.results[0].claims[0], null);
      assert.ok(report.calls.some((call: { stage?: string }) => call.stage === 'draft_validation'));
      if (kind === 'network') assert.ok(report.calls.some((call: { error?: string }) => call.error?.includes('Simulated network failure')));
    }
    assert.equal(await readFile('data/events.json', 'utf8'), source);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalTimeout;
    process.chdir(originalCwd);
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKey;
    if (originalLimit === undefined) delete process.env.OPENROUTER_MAX_POSTS;
    else process.env.OPENROUTER_MAX_POSTS = originalLimit;
    await rm(directory, { recursive: true, force: true });
  }
}

test('council preserves failure evidence on HTTP 429 without retry', () => exerciseFailure('http'));
test('council cannot report completion after an initial network failure', () => exerciseFailure('network'));
test('council cannot corroborate a post after a malformed draft response', () => exerciseFailure('malformed'));
