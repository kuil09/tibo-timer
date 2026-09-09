import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initialState } from '../src/domain.mjs';
import { synchronize } from '../src/sync.mjs';
const config = JSON.parse(await readFile(new URL('../config/settings.json', import.meta.url)));
const now = Date.parse('2026-09-09T06:00:00Z');
const model = id => ({ id, pricing: { prompt: '0', completion: '0' }, supported_parameters: ['max_tokens'], context_length: 32000, architecture: { input_modalities: ['text'], output_modalities: ['text'] } });
const models = ['a/one:free', 'b/two:free', 'c/three:free', 'd/four:free'].map(model);
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const request = async (url, options = {}) => {
  if (String(url).includes('fxtwitter')) return response({ code: 200, cursor: {}, results: [{ type: 'status', id: '1', author: { id: config.author.id, screen_name: config.author.handle }, url: `https://x.com/${config.author.handle}/status/1`, text: 'Hello!', raw_text: { text: 'Hello!' }, created_timestamp: now / 1000, created_at: new Date(now).toISOString() }] });
  if (String(url).endsWith('/models')) return response({ data: models });
  const body = JSON.parse(options.body);
  if (body.model === 'a/one:free') return response({}, 429);
  return response({ model: body.model, usage: { cost: 0 }, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ results: [{ id: '1', event: 'none', state: 'unknown', conditional: false, evidence: '', time_text: '' }] }) } }] });
};
test('failed model cooldown outlasts the post retry delay', async () => {
  const state = initialState();
  await synchronize(state, config, { request, now, key: 'key' });
  assert.ok(Date.parse(state.cooldowns['a/one:free']) > Date.parse(state.posts[0].retry_at));
});
test('explicitly excluding a failed model allows immediate safe replacement', async () => {
  const state = initialState();
  await synchronize(state, config, { request, now, key: 'key' });
  await synchronize(state, { ...config, excludedModels: [...config.excludedModels, 'a/one:free'] }, { request, now: now + 60000, key: 'key' });
  assert.equal(state.posts[0].status, 'complete'); assert.equal(state.posts[0].attempts, 2); assert.equal(state.budget.requests, 6);
  assert.deepEqual(state.models.map(m => m.id), ['b/two:free', 'c/three:free', 'd/four:free']);
});
