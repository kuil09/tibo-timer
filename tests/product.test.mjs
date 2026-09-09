import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState, parseTimeline, reconcile, validateVote, consensus, selectBatch, reserve, publicSnapshot } from '../src/domain.mjs';
import { resolveTime, wallClock } from '../src/time.mjs';
import { isFree, selectModels, requestBody, infer, jsonRequest, safeError } from '../src/openrouter.mjs';
import { synchronize } from '../src/sync.mjs';
import { localTime, headline, countdown } from '../public/view.mjs';
const config = JSON.parse(await readFile(new URL('../config/settings.json', import.meta.url)));
const now = Date.parse('2026-09-09T06:00:00Z'), posted = '2026-09-09T05:00:00.000Z';
const model = (id = 'a/one:free') => ({ id, pricing: { prompt: '0', completion: '0' }, supported_parameters: ['max_tokens', 'response_format', 'temperature'], context_length: 32000, architecture: { input_modalities: ['text'], output_modalities: ['text'] } });
const models = [model(), model('b/two:free'), model('c/three:free')];
const item = (id = '1', text = 'We will reset all Codex usage in two hours.') => ({ type: 'status', id, author: { id: config.author.id, screen_name: config.author.handle }, text, raw_text: { text }, url: `https://x.com/${config.author.handle}/status/${id}`, created_timestamp: Date.parse(posted) / 1000, created_at: posted });
const feed = (...items) => ({ code: 200, results: items, cursor: { bottom: 'unused' } });
const parsed = () => parseTimeline(feed(item()), config, now)[0];
const vote = (post = parsed()) => ({ id: post.id, event: 'reset', state: 'scheduled', conditional: false, evidence: post.text, time_text: 'in two hours' });
const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
function router({ upstream = feed(item()), fail = '', mutate, checkCall } = {}) {
  const calls = [];
  return { calls, request: async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).includes('fxtwitter')) return response(upstream);
    if (String(url).endsWith('/models')) return response({ data: models });
    checkCall?.();
    const body = JSON.parse(options.body);
    if (body.model === fail) return response({}, 429);
    const input = JSON.parse(body.messages[1].content);
    let results = input.posts.map(p => vote(p));
    if (mutate) results = mutate(results, body.model);
    return response({ model: body.model, usage: { cost: 0 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ results }) } }] });
  } };
}
for (const [expression, at, kind = 'exact'] of [
  ['in two hours', '2026-09-09T07:00:00.000Z'], ['within 30 minutes', '2026-09-09T05:30:00.000Z', 'deadline'],
  ['in about 2 hours', '2026-09-09T07:00:00.000Z', 'approximate'], ['in 1.5 hours', '2026-09-09T06:30:00.000Z'],
  ['tomorrow at 5pm PT', '2026-09-10T00:00:00.000Z'], ['2026-09-10 at 5pm PT', '2026-09-11T00:00:00.000Z'],
  ['2026-09-09T14:00+09:00', '2026-09-09T05:00:00.000Z'], ['by tomorrow at 5pm PT', '2026-09-10T00:00:00.000Z', 'deadline']
]) test(`time: ${expression}`, () => assert.deepEqual(resolveTime(expression, posted), { at, kind }));
for (const expression of ['soon', 'tonight', 'tomorrow', 'at 5pm', 'after launch', 'in 0 hours', 'in 999 days', 'in 2 hours after launch', '2026-02-30T12:00Z', '2026-09-09T24:00Z', 'tomorrow at 13pm PT', 'tomorrow at 2:99 UTC']) test(`uncertain time: ${expression}`, () => assert.equal(resolveTime(expression, posted), null));
test('DST spring gap and fall fold remain unresolved', () => {
  assert.equal(wallClock(2026, 3, 8, 2, 30, 'America/New_York'), null);
  assert.equal(wallClock(2026, 11, 1, 1, 30, 'America/New_York'), null);
  assert.equal(wallClock(2026, 9, 9, 17, 0, 'America/New_York'), Date.parse('2026-09-09T21:00Z'));
});
test('timezone conversion crosses calendar days without geolocation', () => {
  assert.match(localTime('2026-09-09T23:00Z', 'Asia/Seoul'), /10일.*08:00/);
  assert.match(localTime('2026-09-09T23:00Z', 'America/New_York'), /9일.*19:00/);
});
test('source excludes other authors and does not traverse quotes', () => {
  const own = item(), foreign = item('2'); foreign.author = { id: '456', screen_name: 'other' }; foreign.quote = item('3');
  assert.deepEqual(parseTimeline(feed(own, foreign), config, now).map(p => p.id), ['1']);
});
test('changed numeric identity fails closed', () => { const x = item(); x.author.id = '999'; assert.throws(() => parseTimeline(feed(x), config, now)); });
test('timestamp mismatch, fake URL, conflicting duplicates rejected', () => {
  for (const patch of [{ created_at: 'wrong' }, { url: 'https://evil.example' }, { created_timestamp: now / 1000 + 9999 }]) assert.throws(() => parseTimeline(feed({ ...item(), ...patch }), config, now));
  assert.throws(() => parseTimeline(feed(item(), item('1', 'changed')), config, now));
});
test('old first-page posts produce a healthy empty window', () => { const x = item(); x.created_timestamp -= 86400; x.created_at = new Date(x.created_timestamp * 1000).toISOString(); assert.deepEqual(parseTimeline(feed(x), config, now), []); });
test('empty target timeline is a source failure', () => assert.throws(() => parseTimeline(feed(), config, now)));
test('missing original text or truncation makes source-only', () => { const x = item(); delete x.raw_text; assert.equal(reconcile(parseTimeline(feed(x), config, now), [])[0].status, 'source_only'); });
test('edits invalidate previous votes and schedule', () => {
  const old = { ...parsed(), status: 'complete', votes: [{}], result: { time: 'stale' }, attempts: 2 };
  assert.equal(reconcile([parsed()], [old])[0].result.time, 'stale');
  const changed = parseTimeline(feed(item('1', 'We will reset all Codex usage in three hours.')), config, now);
  const updated = reconcile(changed, [old])[0]; assert.equal(updated.result, null); assert.equal(updated.attempts, 0);
});
test('votes must quote the original; unknown extra fields rejected', () => {
  assert.throws(() => validateVote({ ...vote(), evidence: 'invented' }, parsed()));
  assert.throws(() => validateVote({ ...vote(), extra: true }, parsed()));
  assert.throws(() => validateVote({ ...vote(), state: 'completed' }, parsed()));
});
test('conditional promise cannot become a precise timer', () => assert.equal(validateVote({ ...vote(), conditional: true }, parsed()).time, null));
test('only three distinct agreeing models establish consensus', () => {
  const claim = validateVote(vote(), parsed()), votes = models.map(m => ({ model: m.id, claim }));
  assert.equal(consensus(votes).agreement, '3/3'); assert.equal(consensus(votes.slice(0, 2)), null);
  assert.equal(consensus([votes[0], votes[0], votes[2]]), null);
  assert.equal(consensus([votes[0], votes[1], { model: 'other', claim: null }]), null);
  assert.equal(consensus([votes[0], votes[1], { model: 'other', claim: { ...claim, event: 'banked_reset' } }]), null);
});
test('free suffix alone never qualifies a paid endpoint', () => {
  assert.ok(isFree(model()));
  for (const pricing of [{ prompt: '0.1', completion: '0' }, { prompt: '0', completion: '' }, { prompt: '0', completion: '0', request: '1' }, { prompt: '0', completion: '0', image: 'NaN' }]) assert.equal(isFree({ ...model(), pricing }), false);
  assert.equal(isFree(model('openrouter/free')), false); assert.equal(isFree(model('x/model')) , false);
});
test('model choice is unique, diverse, current and respects exclusions', () => {
  assert.equal(selectModels({ data: [...models, model('a/duplicate:free')] }, config).length, 3);
  assert.throws(() => selectModels({ data: [model(), model('a/duplicate:free'), model('a/third:free')] }, config));
  assert.throws(() => selectModels({ data: models }, config, { 'a/one:free': new Date(now + 60000).toISOString() }, now));
});
test('request enforces zero prices, specific free model and no fallback', () => {
  const body = requestBody(model(), [parsed()]);
  assert.deepEqual(body.provider, { allow_fallbacks: false, max_price: { prompt: 0, completion: 0, request: 0 } });
  assert.equal(body.models, undefined); assert.equal(body.tools, undefined);
  assert.throws(() => requestBody({ ...model(), pricing: { prompt: '1', completion: '1' } }, []));
});
test('durable budget counts a whole batch and resets by UTC date', () => {
  const b = { day: '2026-09-09', requests: 42 }; assert.ok(reserve(b, 3, now, 45)); assert.equal(b.requests, 45);
  assert.equal(reserve(b, 3, now, 45), false); assert.ok(reserve(b, 3, now + 86400000, 45)); assert.equal(b.requests, 3);
});
test('batch bounds and retry delay', () => {
  const p = { ...parsed(), status: 'pending', attempts: 0 };
  assert.equal(selectBatch(Array.from({ length: 20 }, (_, i) => ({ ...p, id: String(i) })), config, now).length, 8);
  assert.equal(selectBatch([{ ...p, text: 'x'.repeat(20000) }, { ...p, attempts: 3 }, { ...p, retry_at: new Date(now + 1000).toISOString() }], config, now).length, 0);
});
test('sync collects once, reserves before all three calls, publishes consensus', async () => {
  const state = initialState(); let durable = false;
  const mock = router({ checkCall: () => { assert.ok(durable); assert.equal(state.budget.requests, 3); } });
  await synchronize(state, config, { request: mock.request, now, key: 'test-secret', checkpoint: async s => { if (s.analysis_status === 'running') durable = true; } });
  assert.equal(state.posts[0].result.time.at, '2026-09-09T07:00:00.000Z');
  assert.equal(state.analysis_status, 'up_to_date'); assert.equal(mock.calls.filter(c => c.options.method === 'POST').length, 3);
  assert.equal(mock.calls.filter(c => c.url.includes('fxtwitter')).length, 1); assert.ok(mock.calls[0].url.endsWith('count=50&with_replies=1'));
});
test('unchanged posts do not request catalog or inference again', async () => {
  const state = initialState(), first = router(); await synchronize(state, config, { request: first.request, now, key: 'key' });
  const second = router(); await synchronize(state, config, { request: second.request, now: now + 60000, key: 'key' });
  assert.equal(second.calls.length, 1); assert.equal(state.budget.requests, 3);
});
test('failed persistence prevents inference', async () => {
  const state = initialState(), mock = router();
  await assert.rejects(synchronize(state, config, { request: mock.request, now, key: 'key', checkpoint: async () => { throw new Error('save_failed'); } }));
  assert.equal(mock.calls.filter(c => c.options.method === 'POST').length, 0);
});
test('partial failure never publishes a two-model answer', async () => {
  const state = initialState(), mock = router({ fail: 'b/two:free' });
  await synchronize(state, config, { request: mock.request, now, key: 'key' });
  assert.equal(state.posts[0].result, null); assert.equal(state.analysis_status, 'error'); assert.equal(state.budget.requests, 3);
});
test('disagreement stays unresolved without repeated paid/free calls', async () => {
  const state = initialState(), mock = router({ mutate: (v, m) => m.startsWith('a/') ? v.map(x => ({ ...x, event: 'banked_reset' })) : v });
  await synchronize(state, config, { request: mock.request, now, key: 'key' });
  assert.equal(state.posts[0].status, 'unresolved'); assert.equal(state.posts[0].result, null);
  const second = router(); await synchronize(state, config, { request: second.request, now: now + 3600000, key: 'key' }); assert.equal(second.calls.length, 1);
});
test('upstream failure keeps originals and marks source stale', async () => {
  const state = initialState(); state.posts = [parsed()]; const mock = router({ upstream: {} });
  await synchronize(state, config, { request: mock.request, now, key: 'key' }); assert.equal(state.posts.length, 1); assert.notEqual(state.source_status, 'ok'); assert.equal(mock.calls.length, 1);
});
test('missing key and exhausted budget never call inference', async () => {
  for (const withKey of [false, true]) {
    const state = initialState(), mock = router(); state.budget = { day: '2026-09-09', requests: 45 };
    await synchronize(state, config, { request: mock.request, now, key: withKey ? 'key' : '' });
    assert.equal(state.analysis_status, withKey ? 'daily_limit' : 'missing_key'); assert.equal(mock.calls.filter(c => c.options.method === 'POST').length, 0);
  }
});
test('provider truncation, wrong model and nonzero costs rejected', async () => {
  for (const patch of [{ model: 'other' }, { usage: { cost: 1 } }, { choices: [{ finish_reason: 'length' }] }]) await assert.rejects(infer(model(), [parsed()], 'key', async () => response({ model: model().id, usage: { cost: 0 }, ...patch })));
});
test('bounded JSON reading and safe diagnostics do not leak secrets', async () => {
  await assert.rejects(jsonRequest('https://example.test', {}, async () => response({ x: '1234567890' }), 5));
  assert.equal(safeError(new Error('secret sk-123')), 'request_failed'); assert.equal(safeError(new Error('http_429')), 'http_429');
});
const snapshot = () => ({ source_status: 'ok', last_success_at: new Date(now).toISOString(), posts: [{ ...parsed(), status: 'complete', result: { event: 'reset', state: 'scheduled', conditional: false, time: { kind: 'exact', at: '2026-09-09T07:00:00Z' } } }] });
test('UI shows a future announcement, not completion after time passes', () => {
  assert.equal(headline(snapshot(), now).kind, 'scheduled'); const s = snapshot(); s.last_success_at = '2026-09-09T07:00Z'; assert.equal(headline(s, now + 3600000).kind, 'elapsed'); assert.equal(countdown('2026-09-09T05:00Z', now), '0시간 0분 0초');
});
test('UI suppresses stale or invalid freshness', () => { for (const stamp of ['2026-09-09T00:00Z', 'bad', null]) { const s = snapshot(); s.last_success_at = stamp; assert.equal(headline(s, now).kind, 'stale'); } });
test('newer pending edit or cancellation supersedes old timer', () => {
  const s = snapshot(); s.posts.unshift({ ...parsed(), id: '2', posted_at: '2026-09-09T05:30Z', status: 'pending', result: null }); assert.equal(headline(s, now).kind, 'pending');
  s.posts[0].result = { event: 'reset', state: 'cancelled' }; assert.equal(headline(s, now).kind, 'cancelled');
});
test('public build projection omits budget, attempts and cooldown state', () => {
  const s = initialState(); s.posts = [{ ...parsed(), attempts: 1, retry_at: 'later', votes: [], result: null }]; const pub = publicSnapshot(s, 'sha'); assert.equal(pub.budget, undefined); assert.equal(pub.cooldowns, undefined); assert.equal(pub.posts[0].attempts, undefined);
});

test('interrupted last attempt becomes unresolved after the retry window', async () => {
  const state = initialState();
  state.posts = [{ ...parsed(), status: 'pending', attempts: 3, retry_at: new Date(now - 1000).toISOString(), votes: [], result: null }];
  const mock = router(); await synchronize(state, config, { request: mock.request, now, key: 'key' });
  assert.equal(state.posts[0].status, 'unresolved'); assert.equal(state.analysis_status, 'unresolved'); assert.equal(mock.calls.length, 1);
});
test('reserved interrupted attempt is displayed as waiting, not complete', async () => {
  const state = initialState();
  state.posts = [{ ...parsed(), status: 'pending', attempts: 1, retry_at: new Date(now + 10000).toISOString(), votes: [], result: null }];
  const mock = router(); await synchronize(state, config, { request: mock.request, now, key: 'key' });
  assert.equal(state.analysis_status, 'retry_pending'); assert.equal(mock.calls.length, 1);
});
