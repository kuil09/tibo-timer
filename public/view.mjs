export function localTime(instant, zone, locale = 'ko-KR') {
  return new Intl.DateTimeFormat(locale, { timeZone: zone, month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }).format(new Date(instant));
}
export function historyState(post, now = Date.now()) {
  if (post?.verdict_status === 'disagreement') return { kind: 'disagreement', event: null, time: null };
  const result = post?.result;
  if (!result) return { kind: 'pending', event: null, time: null };
  if (result.event === 'none') return { kind: 'none', event: 'none', time: null };
  if (result.state === 'cancelled') return { kind: 'cancelled', event: result.event, time: null };
  if (result.state === 'completed') return { kind: 'completed', event: result.event, time: null };
  if (result.state === 'scheduled' && result.conditional) return { kind: 'conditional', event: result.event, time: null };
  if (result.state === 'scheduled' && result.time && Number.isFinite(Date.parse(result.time.at))) {
    return { kind: Date.parse(result.time.at) <= now ? 'elapsed' : 'scheduled', event: result.event, time: result.time };
  }
  return { kind: 'unknown', event: result.event, time: null };
}
export function headline(snapshot, now = Date.now()) {
  const stale = snapshot.source_status !== 'ok' || !Number.isFinite(Date.parse(snapshot.last_success_at)) || now - Date.parse(snapshot.last_success_at) > 3600000 || Date.parse(snapshot.last_success_at) > now + 300000;
  if (stale) return { kind: 'stale', post: null };
  const recent = snapshot.posts.filter(p => now - Date.parse(p.posted_at) <= 86400000).sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  // A newer unprocessed or ambiguous post may cancel or change an older schedule.
  // Do not present an old promise as the current answer while that update is unresolved.
  for (const post of recent) {
    if (!post.result) return { kind: 'pending', post };
    const r = post.result;
    if (r.event === 'none') continue;
    if (r.state === 'cancelled') return { kind: 'cancelled', post };
    if (r.state === 'completed') return { kind: 'completed', post };
    if (r.state !== 'scheduled' || r.conditional || !r.time) return { kind: 'unknown', post };
    if (Date.parse(r.time.at) <= now) return { kind: 'elapsed', post };
    return { kind: 'scheduled', post };
  }
  return { kind: 'empty', post: null };
}
export function countdown(at, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((Date.parse(at) - now) / 1000));
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return `${days ? `${days}일 ` : ''}${hours}시간 ${minutes}분 ${seconds % 60}초`;
}
