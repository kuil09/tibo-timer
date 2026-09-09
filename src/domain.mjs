import { createHash } from 'node:crypto';
import { resolveTime } from './time.mjs';
export const VERSION = 'reset-v2';
export const fingerprint = post => createHash('sha256').update(JSON.stringify([VERSION, post.id, post.text, post.url, post.posted_at, post.truncated])).digest('hex');
export function initialState() {
  return { schema_version: 2, checked_at: null, last_success_at: null, source_status: 'pending', analysis_status: 'pending', models: [], posts: [], budget: { day: null, requests: 0 }, cooldowns: {} };
}
export function parseTimeline(body, config, now = Date.now()) {
  if (body?.code !== 200 || !Array.isArray(body.results) || !body.cursor || typeof body.cursor !== 'object') throw new Error('source_invalid');
  const posts = new Map();
  for (const item of body.results) {
    if (item?.type === 'tombstone') continue;
    if (item?.type !== 'status' || !/^\d+$/.test(item.author?.id ?? '') || typeof item.author?.screen_name !== 'string') throw new Error('source_invalid_entry');
    const handle = item.author.screen_name.toLowerCase() === config.author.handle;
    const author = item.author.id === config.author.id;
    if (handle !== author) throw new Error('source_author_changed');
    if (!author) continue; // Do not include other authors' parents or recurse into quotes.
    const timestamp = item.created_timestamp * 1000;
    const text = typeof item.raw_text?.text === 'string' ? item.raw_text.text : item.text;
    if (typeof item.id !== 'string' || !/^\d+$/.test(item.id) || item.url !== `https://x.com/${config.author.handle}/status/${item.id}` || typeof text !== 'string' || !text.trim() || text.length > 100000 || !Number.isSafeInteger(item.created_timestamp) || timestamp <= 0 || timestamp > now + 300000 || !Number.isFinite(Date.parse(item.created_at)) || Math.abs(Date.parse(item.created_at) - timestamp) > 1000) throw new Error('source_invalid_post');
    const post = { id: item.id, text, url: item.url, posted_at: new Date(timestamp).toISOString(), truncated: item.truncated === true || typeof item.raw_text?.text !== 'string' || /(?:…|\.\.\.)\s*(?:https:\/\/t\.co\/\S+\s*)*$/.test(text) || (item.is_note_tweet === true && text.length <= 280) };
    post.hash = fingerprint(post);
    if (posts.has(post.id) && posts.get(post.id).hash !== post.hash) throw new Error('source_conflicting_duplicate');
    posts.set(post.id, post);
  }
  if (!posts.size) throw new Error('source_empty_author');
  return [...posts.values()].filter(p => Date.parse(p.posted_at) >= now - config.lookbackHours * 3600000).sort((a, b) => b.posted_at.localeCompare(a.posted_at) || b.id.localeCompare(a.id));
}
export function reconcile(incoming, previous) {
  const old = new Map(previous.map(p => [p.id, p]));
  return incoming.map(p => old.get(p.id)?.hash === p.hash ? { ...old.get(p.id), ...p } : { ...p, status: p.truncated ? 'source_only' : 'pending', attempts: 0, retry_at: null, votes: [], result: null });
}
export function validateVote(value, post) {
  const keys = ['id', 'event', 'state', 'conditional', 'evidence', 'time_text'];
  if (!value || Object.keys(value).sort().join() !== keys.sort().join() || value.id !== post.id || !['reset', 'banked_reset', 'none'].includes(value.event) || !['scheduled', 'completed', 'cancelled', 'unknown'].includes(value.state) || typeof value.conditional !== 'boolean') throw new Error('invalid_vote');
  for (const key of ['evidence', 'time_text']) if (typeof value[key] !== 'string' || value[key].length > 4000 || (value[key] && !post.text.includes(value[key]))) throw new Error('ungrounded_vote');
  if ((value.event === 'none' && (value.state !== 'unknown' || value.evidence || value.time_text || value.conditional)) || (value.event !== 'none' && !value.evidence) || (value.state !== 'scheduled' && (value.time_text || value.conditional))) throw new Error('inconsistent_vote');
  const time = value.state === 'scheduled' && !value.conditional ? resolveTime(value.time_text, post.posted_at) : null;
  // A future promise cannot be scheduled before the source's own timestamp.
  if (time && (Date.parse(time.at) < Date.parse(post.posted_at) || Date.parse(time.at) > Date.parse(post.posted_at) + 31 * 86400000)) throw new Error('invalid_schedule');
  return { ...value, time };
}
export function consensus(votes) {
  if (votes.length !== 3 || new Set(votes.map(v => v.model)).size !== 3 || votes.some(v => !v.claim)) return null;
  const semantic = c => JSON.stringify([c.event, c.state, c.conditional, c.time]);
  if (new Set(votes.map(v => semantic(v.claim))).size !== 1) return null;
  const c = votes[0].claim;
  return { event: c.event, state: c.state, conditional: c.conditional, time: c.time, evidence: c.evidence, time_text: c.time_text, agreement: '3/3' };
}
export function selectBatch(posts, config, now) {
  const batch = []; let characters = 0;
  for (const post of posts) {
    if (post.truncated || !['pending', 'error'].includes(post.status) || post.attempts >= 3 || (post.retry_at && Date.parse(post.retry_at) > now)) continue;
    if (characters + post.text.length > config.batchCharacters) continue;
    batch.push(post); characters += post.text.length;
    if (batch.length >= config.batchPosts) break;
  }
  return batch;
}
export function reserve(budget, count, now, limit) {
  const day = new Date(now).toISOString().slice(0, 10);
  if (budget.day !== day) { budget.day = day; budget.requests = 0; }
  if (!Number.isInteger(budget.requests) || budget.requests < 0 || budget.requests + count > limit) return false;
  budget.requests += count;
  return true;
}
export function publicSnapshot(state, version) {
  return { schema_version: 2, version, checked_at: state.checked_at, last_success_at: state.last_success_at, source_status: state.source_status, analysis_status: state.analysis_status, models: state.models, posts: state.posts.map(({ id, text, url, posted_at, truncated, status, result, votes }) => ({ id, text, url, posted_at, truncated, status, result, votes })) };
}
