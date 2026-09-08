export const TYPE_LABELS = { reset: '일반 사용량 Reset', banked_reset: 'Banked reset 지급', unknown: '유형 미확인' };
export const STATE_LABELS = { scheduled: '예정 공지', completed: '완료 공지', retrospective: '과거 언급', unknown: '해석 미확인' };

export function sourceUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['x.com', 'www.x.com'].includes(url.hostname) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function isStale(lastSuccess, now = Date.now()) {
  const time = Date.parse(lastSuccess || '');
  return !Number.isFinite(time) || now - time > 60 * 60 * 1000;
}

export function deadline(item) {
  return Date.parse(item.temporal?.kind === 'instant' ? item.temporal.at : item.temporal?.kind === 'window' ? item.temporal.until : '');
}

export function nextEvent(items, type, now = Date.now()) {
  return items.filter(item => item.event.type === type && item.event.state === 'scheduled' && deadline(item) > now)
    .sort((a, b) => deadline(a) - deadline(b))[0] || null;
}

export function stateLabel(item, now = Date.now()) {
  if (item.event.state === 'scheduled' && Number.isFinite(deadline(item)) && deadline(item) <= now) return '예정 시각 경과 · 완료 미확인';
  return STATE_LABELS[item.event.state] || STATE_LABELS.unknown;
}

export function formatInstant(value, timeZone) {
  if (!value || !Number.isFinite(Date.parse(value))) return '시각 미확인';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone, year: 'numeric', month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

export function temporalLabel(temporal, timeZone) {
  const prefix = temporal.precision === 'approximate' ? '예상 · ' : '';
  if (temporal.kind === 'instant') return prefix + formatInstant(temporal.at, timeZone);
  if (temporal.kind === 'window') return prefix + (temporal.from ? `${formatInstant(temporal.from, timeZone)} ~ ` : '') + `${formatInstant(temporal.until, timeZone)} 이내`;
  if (temporal.kind === 'date') return `${temporal.date} · ${temporal.time_zone || '기준 시간대 미확인'} 기준 (시각 미정)`;
  return '시각 미정';
}

export function countdown(item, now = Date.now()) {
  const end = deadline(item);
  if (!Number.isFinite(end) || item.event.state !== 'scheduled') return '';
  if (end <= now) return '예정 시각 경과 · 완료 미확인';
  const seconds = Math.floor((end - now) / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor(seconds % 86400 / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const rest = seconds % 60;
  const label = item.temporal.kind === 'window' ? '기한까지' : item.temporal.precision === 'approximate' ? '예상 시각까지' : '예정 시각까지';
  return `${label} ${days ? `${days}일 ` : ''}${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}
