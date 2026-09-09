const MINUTE = 60000;
const WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const ZONES = { UTC: 0, GMT: 0, Z: 0, KST: 540, JST: 540, PST: -480, PDT: -420, EST: -300, EDT: -240, CET: 60, CEST: 120, PT: 'America/Los_Angeles', ET: 'America/New_York' };
const iso = ms => new Date(ms).toISOString();
function validDate(y, m, d) {
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
function parts(ms, zone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ms).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
// Reject nonexistent and ambiguous wall-clock times instead of guessing at DST changes.
export function wallClock(y, m, d, h, minute, zone) {
  if (!validDate(y, m, d) || h < 0 || h > 23 || minute < 0 || minute > 59) return null;
  const naive = Date.UTC(y, m - 1, d, h, minute);
  if (typeof zone === 'number') return naive - zone * MINUTE;
  const matches = [];
  try {
    for (let offset = -840; offset <= 840; offset += 15) {
      const candidate = naive - offset * MINUTE, p = parts(candidate, zone);
      if (p.year === y && p.month === m && p.day === d && p.hour === h && p.minute === minute) matches.push(candidate);
    }
  } catch { return null; }
  return matches.length === 1 ? matches[0] : null;
}
// Interpret only a model-selected source span, never unrelated dates elsewhere in the post.
export function resolveTime(expression, postedAt) {
  const posted = Date.parse(postedAt);
  if (typeof expression !== 'string' || !Number.isFinite(posted)) return null;
  const text = expression.trim();
  let m = text.match(/^(in|within|in about|in around|about|around)\s+(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(minutes?|mins?|hours?|hrs?|days?)\.?$/i);
  if (m) {
    const quantity = WORDS[m[2].toLowerCase()] ?? Number(m[2]);
    const duration = quantity * (/^h/i.test(m[3]) ? 60 : /^d/i.test(m[3]) ? 1440 : 1) * MINUTE;
    if (!(duration > 0 && duration <= 7 * 86400000)) return null;
    return { kind: m[1].toLowerCase() === 'within' ? 'deadline' : /about|around/i.test(m[1]) ? 'approximate' : 'exact', at: iso(posted + duration) };
  }
  m = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(Z|[+-]\d{2}:\d{2})$/);
  if (m) {
    const time = Date.parse(text), offset = m[7] === 'Z' ? null : m[7].slice(1).split(':').map(Number);
    if (!validDate(+m[1], +m[2], +m[3]) || +m[4] > 23 || +m[5] > 59 || +(m[6] ?? 0) > 59 || (offset && (offset[0] > 14 || offset[1] > 59 || (offset[0] === 14 && offset[1] !== 0))) || !Number.isFinite(time)) return null;
    return { kind: 'exact', at: iso(time) };
  }
  m = text.match(/^(?:(around|about|by)\s+)?(?:(today|tomorrow|\d{4}-\d{2}-\d{2})\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(UTC|GMT|Z|PT|PST|PDT|ET|EST|EDT|KST|JST|CET|CEST|[A-Za-z_]+\/[A-Za-z_]+(?:\/[A-Za-z_]+)?)$/i);
  if (!m) return null;
  const zone = ZONES[m[6].toUpperCase()] ?? m[6];
  let h = +m[3], minute = +(m[4] ?? 0);
  if (m[5]) { if (h < 1 || h > 12) return null; h = h % 12 + (m[5].toLowerCase() === 'pm' ? 12 : 0); }
  let y, month, day;
  try {
    if (m[2] && /^\d/.test(m[2])) [y, month, day] = m[2].split('-').map(Number);
    else {
      const p = typeof zone === 'number' ? parts(posted + zone * MINUTE, 'UTC') : parts(posted, zone);
      const base = new Date(Date.UTC(p.year, p.month - 1, p.day + (m[2]?.toLowerCase() === 'tomorrow' ? 1 : 0)));
      [y, month, day] = [base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate()];
    }
    const time = wallClock(y, month, day, h, minute, zone);
    if (time === null || (!m[2] && time < posted)) return null;
    return { kind: /around|about/i.test(m[1] ?? '') ? 'approximate' : m[1]?.toLowerCase() === 'by' ? 'deadline' : 'exact', at: iso(time) };
  } catch { return null; }
}
