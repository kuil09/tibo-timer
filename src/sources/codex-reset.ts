import type { SourcePost } from '../source.ts';
export interface Feed { version:number; stale:boolean; fetched_at:string; tweets: unknown[]; events: unknown[]; [key:string]:unknown; }
const instant = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && /(?:Z|[+-]\d\d:\d\d)$/.test(v);
export function validateFeed(value: unknown): Feed {
  if (!value || typeof value !== 'object') throw new Error('feed_not_object');
  const f = value as Feed;
  if (f.version !== 1 || f.stale !== false || !instant(f.fetched_at) || !Array.isArray(f.tweets) || !Array.isArray(f.events)) throw new Error('feed_stale_or_invalid');
  // An old post is fine; an old collector snapshot is not evidence of a healthy sync.
  if (Date.now() - Date.parse(f.fetched_at) > 60 * 60_000 || Date.parse(f.fetched_at) - Date.now() > 5 * 60_000) throw new Error('feed_snapshot_expired');
  if (f.events.some(e => !e || typeof e !== 'object' || Array.isArray(e))) throw new Error('invalid_event');
  const ids = new Set<string>();
  for (const t of f.tweets as Record<string, unknown>[]) {
    if (!t || typeof t.id !== 'string' || !/^\d+$/.test(t.id) || typeof t.text !== 'string' || !instant(t.at) || typeof t.url !== 'string' || !/^https:\/\/x\.com\/thsottiaux\/status\/\d+$/.test(t.url)) throw new Error('invalid_post');
    if (ids.has(t.id) || !t.url.endsWith(`/status/${t.id}`)) throw new Error('duplicate_or_mismatched_post');
    ids.add(t.id);
  }
  return f;
}
export function postsFromFeed(feed: Feed): SourcePost[] {
  return (feed.tweets as Record<string, unknown>[]).map(t => {
    const observation = (feed.events as Record<string, unknown>[]).find(e => e.id === t.id && e.source === 'operator-observed');
    return { id: t.id as string, url: t.url as string, text: t.text as string, posted_at: t.at as string,
      truncated: t.truncated === true || /(?:…|\.\.\.)\s*$/.test(t.text as string), kind: String(t.kind ?? 'unknown'),
      ...(observation && instant(observation.observed_at) ? {observation:{at:observation.observed_at,result:String(observation.observation_result ?? 'unknown')}} : {}) };
  });
}
export async function fetchFeed(): Promise<Feed> {
  const response = await fetch('https://codex-reset.com/api/feed', {signal:AbortSignal.timeout(20_000), headers:{Accept:'application/json','User-Agent':'tibo-timer/1.0 (+https://github.com/kuil09/tibo-timer)'}});
  if (!response.ok) throw new Error(`feed_http_${response.status}`);
  const text = await response.text();
  if (text.length > 2_000_000) throw new Error('feed_too_large');
  return validateFeed(JSON.parse(text));
}
