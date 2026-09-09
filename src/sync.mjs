import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { initialState, parseTimeline, reconcile, selectBatch, reserve, consensus } from './domain.mjs';
import { jsonRequest, selectModels, infer, safeError } from './openrouter.mjs';

export async function synchronize(state, config, { request = fetch, now = Date.now(), key = '', checkpoint = async () => {} } = {}) {
  state.checked_at = new Date(now).toISOString();
  try {
    const url = `https://api.fxtwitter.com/2/profile/${config.author.handle}/statuses?count=50&with_replies=1`;
    const body = await jsonRequest(url, { signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json', 'User-Agent': 'tibo-timer/2.0' } }, request);
    state.posts = reconcile(parseTimeline(body, config, now), state.posts);
    state.source_status = 'ok'; state.last_success_at = state.checked_at;
  } catch (error) {
    state.source_status = safeError(error); state.analysis_status = 'source_unavailable';
    await checkpoint(state); return state;
  }
  for (const post of state.posts) {
    if (post.text.length > config.batchCharacters && !post.truncated) post.status = 'source_only';
    if (['pending', 'error'].includes(post.status) && post.attempts >= 3 && Date.parse(post.retry_at ?? '') <= now) post.status = 'unresolved';
  }
  const batch = selectBatch(state.posts, config, now);
  if (!batch.length) {
    state.analysis_status = state.posts.some(p => ['pending', 'error'].includes(p.status)) ? 'retry_pending' : state.posts.some(p => p.status === 'unresolved') ? 'unresolved' : 'up_to_date';
    await checkpoint(state); return state;
  }
  if (!key) { state.analysis_status = 'missing_key'; await checkpoint(state); return state; }
  let models;
  try {
    const catalog = await jsonRequest('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30000) }, request, 8000000);
    models = selectModels(catalog, config, state.cooldowns, now);
  } catch (error) { state.analysis_status = safeError(error); await checkpoint(state); return state; }
  if (!reserve(state.budget, 3, now, config.dailyRequests)) { state.analysis_status = 'daily_limit'; await checkpoint(state); return state; }
  state.models = models.map(m => ({ id: m.id, status: 'pending', at: state.checked_at }));
  state.analysis_status = 'running';
  // Persist reservation BEFORE any inference. CI pushes this checkpoint to main, so
  // a killed runner still consumes the reserved allowance rather than overspending it.
  for (const post of batch) { post.attempts++; post.retry_at = new Date(now + 3600000).toISOString(); }
  await checkpoint(state);
  const results = await Promise.allSettled(models.map(model => infer(model, batch, key, request)));
  state.models = results.map((result, i) => ({ id: models[i].id, status: result.status === 'fulfilled' ? 'ok' : 'error', at: state.checked_at, ...(result.status === 'rejected' ? { error: safeError(result.reason) } : {}) }));
  for (let i = 0; i < results.length; i++) if (results[i].status === 'rejected') state.cooldowns[models[i].id] = new Date(now + 3600000).toISOString();
  for (let i = 0; i < batch.length; i++) {
    const post = batch[i];
    post.votes = results.map((r, j) => ({ model: models[j].id, claim: r.status === 'fulfilled' ? r.value[i] : null, ...(r.status === 'rejected' ? { error: safeError(r.reason) } : {}) }));
    post.result = consensus(post.votes);
    post.status = results.some(r => r.status === 'rejected') ? 'error' : post.result ? 'complete' : 'unresolved';
  }
  state.analysis_status = results.some(r => r.status === 'rejected') ? 'error' : state.posts.some(p => p.status === 'pending') ? 'pending' : state.posts.some(p => p.status === 'unresolved') ? 'unresolved' : 'up_to_date';
  await checkpoint(state);
  return state;
}
export async function saveState(state) {
  await mkdir('data', { recursive: true });
  await writeFile('data/state.json.tmp', JSON.stringify(state, null, 2) + '\n');
  await rename('data/state.json.tmp', 'data/state.json');
}
function commitState() {
  execFileSync('git', ['add', 'data/state.json']);
  try { execFileSync('git', ['diff', '--cached', '--quiet']); return; } catch {}
  execFileSync('git', ['commit', '-m', 'chore: update latest reset status'], { stdio: 'inherit' });
  // Non-fast-forward failures abort. Never overwrite another writer's code or state.
  execFileSync('git', ['push', 'origin', 'HEAD:main'], { stdio: 'inherit' });
}
export async function main() {
  const config = JSON.parse(await readFile('config/settings.json', 'utf8'));
  let state;
  try { state = JSON.parse(await readFile('data/state.json', 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; state = initialState(); }
  if (state.schema_version !== 2 || !Array.isArray(state.posts) || !state.budget || !state.cooldowns) throw new Error('invalid_state');
  const durable = process.env.GITHUB_ACTIONS === 'true' && process.env.PERSIST_STATE === 'true';
  await synchronize(state, config, { key: process.env.OPENROUTER_API_KEY ?? '', checkpoint: async state => { await saveState(state); if (durable) commitState(); } });
  console.log(JSON.stringify({ source: state.source_status, analysis: state.analysis_status, posts: state.posts.length, requests: state.budget.requests, models: state.models }));
  if (state.source_status !== 'ok' || ['missing_key', 'error', 'three_free_models_unavailable'].includes(state.analysis_status) || /^http_|^invalid_/.test(state.analysis_status)) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(error => { console.error(safeError(error)); process.exitCode = 1; });
