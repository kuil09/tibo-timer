export function localTime(instant, zone, locale = 'ko-KR') {
  return new Intl.DateTimeFormat(locale, { timeZone: zone, month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' }).format(new Date(instant));
}
export function headline(snapshot, now = Date.now()) {
  const stale = snapshot.source_status !== 'ok' || !Number.isFinite(Date.parse(snapshot.last_success_at)) || now - Date.parse(snapshot.last_success_at) > 3600000 || Date.parse(snapshot.last_success_at) > now + 300000;
  if (stale) return { kind: 'stale', title: '최신 발언을 확인하지 못했습니다', post: null };
  const recent = snapshot.posts.filter(p => now - Date.parse(p.posted_at) <= 86400000).sort((a, b) => b.posted_at.localeCompare(a.posted_at));
  // A newer unprocessed/ambiguous post may cancel or change an older schedule.
  // Do not present an old promise as the current answer while that update is unresolved.
  for (const post of recent) {
    if (!post.result) return { kind: 'pending', title: ['pending', 'error'].includes(post.status) ? '새 발언의 해석을 기다리고 있습니다' : '최근 발언의 예정 시각을 확정하지 못했습니다', post };
    const r = post.result;
    if (r.event === 'none') continue;
    if (r.state === 'cancelled') return { kind: 'cancelled', title: '최근 공지에서 취소를 알렸습니다', post };
    if (r.state === 'completed') return { kind: 'completed', title: '최근 공지에서 지급·리셋을 알렸습니다', post };
    if (r.state !== 'scheduled' || r.conditional || !r.time) return { kind: 'unknown', title: r.conditional ? '조건이 있는 리셋 공지입니다' : '예정 시각이 정해지지 않았습니다', post };
    if (Date.parse(r.time.at) <= now) return { kind: 'elapsed', title: '공지된 예정 시각이 지났습니다', post };
    return { kind: 'scheduled', title: r.event === 'banked_reset' ? '추가 리셋권 지급 예정' : '사용량 리셋 예정', post };
  }
  return { kind: 'empty', title: '새로운 리셋 예정 공지가 없습니다', post: null };
}
export function countdown(at, now = Date.now()) {
  const seconds = Math.max(0, Math.floor((Date.parse(at) - now) / 1000));
  const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
  return `${days ? `${days}일 ` : ''}${hours}시간 ${minutes}분 ${seconds % 60}초`;
}
