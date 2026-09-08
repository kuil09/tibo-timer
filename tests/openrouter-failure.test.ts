import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main } from '../src/openrouter.ts';

type Scenario = 'provider429' | 'unauthorized' | 'account429' | 'emptyreserve' | 'review' | 'disagreement' | 'attemptlimit' | 'network' | 'malformed' | 'parallel';

async function exerciseScenario(scenario: Scenario) {
  const directory = await mkdtemp(join(tmpdir(), 'openrouter-failure-'));
  const originalCwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const originalTimeout = globalThis.setTimeout;
  const originalKey = process.env.OPENROUTER_API_KEY;
  const originalLimit = process.env.OPENROUTER_MAX_POSTS;
  const authors = scenario === 'emptyreserve' ? ['a', 'b', 'c'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'];
  const models = authors.map((author, index) => ({
    id: `${author}/test:free`, pricing: { prompt: '0', completion: '0', request: '0' },
    supported_parameters: ['reasoning', 'max_tokens'], context_length: 32768,
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    benchmarks: { artificial_analysis: { intelligence_index: index < 3 ? 30 - index : null } },
  }));
  const now = new Date().toISOString();
  const source = JSON.stringify({ last_success_at: now, events: [{
    id: 'test-post', source: { text: 'Unrelated product news.', posted_at: now, truncated: false },
  }] });
  const requests: { model: string; review: boolean }[] = [];
  const barriers: Record<string, (() => void)[]> = {draft:[],review:[]};
  const overlap = {draft:0,review:0};
  const fatal = ['unauthorized', 'account429', 'emptyreserve', 'attemptlimit'].includes(scenario);
  try {
    await mkdir(join(directory, '.cache/openrouter'), { recursive: true });
    await mkdir(join(directory, 'data'));
    await writeFile(join(directory, '.cache/openrouter/catalog.json'), JSON.stringify({ fetched_at: now, models, selected: models.slice(0, 3) }));
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
      const request = JSON.parse(String(init?.body));
      const review = request.messages[0].content.includes('Now audit');
      requests.push({ model: request.model, review });
      assert.equal(request.provider.allow_fallbacks, false);
      assert.deepEqual(request.provider.max_price, {prompt:0,completion:0,request:0});
      if (scenario === 'parallel') {
        const stage = review ? 'review' : 'draft';
        await new Promise<void>((resolve,reject) => {
          const timer = originalTimeout(() => reject(new Error(`Missing parallel ${stage} overlap`)), 2000);
          barriers[stage].push(() => {clearTimeout(timer);resolve();});
          overlap[stage] = barriers[stage].length;
          if (barriers[stage].length === (review ? 6 : 3)) barriers[stage].forEach(release => release());
        });
      }
      const failHere = scenario === 'attemptlimit' || requests.length === (scenario === 'review' ? 4 : 1);
      if (failHere && !['disagreement','parallel'].includes(scenario)) {
        if (scenario === 'unauthorized') return new Response('Invalid credentials', { status: 401 });
        if (scenario === 'account429') return new Response('Daily account limit exceeded', { status: 429 });
        if (scenario === 'network') throw new TypeError('Simulated network failure');
        if (scenario === 'malformed') return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{invalid JSON' } }] });
        return new Response('upstream_provider_shared_pool', { status: 429 });
      }
      const content = review ? { verdict: scenario === 'disagreement' ? 'uncertain' : 'supported', evidence: '' } : {
        event_type: 'unknown', state: 'unknown', conditional: false, condition: '',
        evidence: '', time_expression: '', time_basis: 'none',
      };
      return Response.json({ model: request.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] });
    };

    if (fatal) await assert.rejects(main('council'), /HTTP (401|429)/);
    else await main('council');
    const report = JSON.parse(await readFile('.cache/openrouter/council.json', 'utf8'));
    assert.equal(report.status, fatal ? 'failed' : 'completed');
    assert.equal(report.requests, requests.length);
    assert.equal(report.results.length, 1);
    assert.equal(report.results[0].publication, 'not_published');
    assert.equal(report.results[0].status, fatal || scenario === 'disagreement' ? 'unresolved' : 'corroborated');
    if (['unauthorized', 'account429'].includes(scenario)) {
      assert.equal(requests.length, 1);
      assert.equal(report.fallbacks.length, 0);
      assert.equal(report.abandoned.length, 1);
      assert.ok(report.calls.some((call: { error?: string }) => typeof call.error === 'string'));
    } else if (scenario === 'emptyreserve') {
      assert.equal(requests.length, 5);
      assert.equal(report.fallbacks.length, 0);
      assert.equal(report.abandoned.length, 1);
      assert.deepEqual(report.abandoned[0].claims.map((claim:unknown)=>claim!==null),[false,true,true]);
    } else if (scenario === 'attemptlimit') {
      assert.equal(requests.length, 9);
      assert.equal(report.fallbacks.length, 6);
      assert.equal(report.abandoned.length, 3);
      assert.equal(new Set(requests.map(request => request.model)).size, 9);
    } else if (scenario === 'disagreement' || scenario === 'parallel') {
      assert.equal(requests.length, 9);
      assert.equal(report.fallbacks.length, 0, 'Semantic disagreement must not trigger replacement');
      assert.equal(report.abandoned.length, 0);
    } else {
      const firstAttemptCalls = scenario === 'review' ? 9 : 5;
      assert.equal(requests.length, firstAttemptCalls + 9);
      assert.equal(report.abandoned.length, 1);
      assert.equal(report.abandoned[0].claims.length, 3);
      assert.deepEqual(report.abandoned[0].claims.map((claim:unknown)=>claim!==null), scenario === 'review' ? [true,true,true] : [false,true,true]);
      assert.equal(report.abandoned[0].reviews.length,6);
      assert.equal(report.fallbacks.length, 1);
      assert.equal(report.fallbacks[0].from, 'a/test:free');
      assert.equal(report.fallbacks[0].to, 'd/test:free');
      assert.equal(report.fallbacks[0].ranked, false, 'Unscored free candidates remain usable reserves');
      assert.deepEqual(report.results[0].models, ['d/test:free', 'b/test:free', 'c/test:free']);
      assert.equal(report.results[0].attempt, 2);
      assert.equal(report.results[0].claims.length, 3);
      assert.equal(report.results[0].reviews.length, 6);
      const fresh = requests.slice(firstAttemptCalls);
      assert.deepEqual(fresh.slice(0, 3), [
        { model: 'd/test:free', review: false }, { model: 'b/test:free', review: false }, { model: 'c/test:free', review: false },
      ]);
      assert.ok(fresh.slice(3).every(request => request.review));
      assert.ok(fresh.every(request => request.model !== 'a/test:free'));
      for (const model of report.results[0].models) assert.equal(fresh.filter(request => request.model === model && request.review).length, 2);
    }
    if(scenario === 'parallel') assert.deepEqual(overlap,{draft:3,review:6});
    assert.ok(requests.length <= 45);
    assert.doesNotMatch(JSON.stringify(report), /test-only-dummy-key/);
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

test('provider 429 replaces the failed model and reruns a complete panel', () => exerciseScenario('provider429'));
test('authentication failure stops without fallback', () => exerciseScenario('unauthorized'));
test('account-wide rate limit stops without fallback', () => exerciseScenario('account429'));
test('exhausted reserve preserves failed unresolved evidence', () => exerciseScenario('emptyreserve'));
test('review failure restarts drafts and all six reviews without mixing panels', () => exerciseScenario('review'));
test('semantic disagreement is unresolved without replacement', () => exerciseScenario('disagreement'));
test('panel retries stop after three attempts despite remaining reserves', () => exerciseScenario('attemptlimit'));
test('network failure uses a free replacement', () => exerciseScenario('network'));
test('malformed draft uses a free replacement', () => exerciseScenario('malformed'));

test('draft and review phases each overlap independent network requests', () => exerciseScenario('parallel'));
