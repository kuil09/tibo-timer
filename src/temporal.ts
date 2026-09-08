import { Temporal } from '@js-temporal/polyfill';
import { validateExtraction, type Extraction, type TemporalValue } from './types.js';
export { validateExtraction } from './types.js';

export interface TemporalSource { text: string; posted_at: string; truncated?: boolean }

const quantities: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twelve: 12 };
const quantity = (s: string) => quantities[s] ?? Number(s);

/** Normalize only explicit, supported source language. Never infer completion or timezone. */
export function normalizeTemporal(extraction: Extraction, source: TemporalSource): TemporalValue {
  const original = typeof extraction?.time_expression === 'string' ? extraction.time_expression : '';
  const unresolved = (reason: string): TemporalValue => ({ kind: 'unresolved', precision: 'unspecified', original, reason });
  try { validateExtraction(extraction); } catch { return unresolved('invalid_extraction'); }
  if (source.truncated) return unresolved('truncated_source');
  if (!extraction.evidence || !source.text.includes(extraction.evidence) || !extraction.evidence.includes(original)) return unresolved('unsupported_evidence');
  if (!original.trim()) return unresolved('no_time_expression');
  if (extraction.state !== 'scheduled' || extraction.event_type === 'unknown') return unresolved('not_a_schedule');
  let posted: Temporal.Instant;
  try { posted = Temporal.Instant.from(source.posted_at); } catch { return unresolved('invalid_posted_at'); }
  const expression = original.trim().replace(/[.!]$/, '').toLowerCase();
  const approximate = /\b(?:around|about|approximately)\b|~/.test(expression);
  const precision = approximate ? 'approximate' : 'exact';
  // Full-match supported phrases prevents discarding qualifiers such as "not" or "maybe".
  const relative = expression.match(/^(in|within)\s+(?:(?:around|about|approximately)\s+|~\s*)?(\d+(?:\.\d+)?|a|an|one|two|three|four|five|six|twelve)\s+(hours?|hrs?|minutes?|mins?)$/);
  if (relative) {
    const minutes = quantity(relative[2]) * (/^(hour|hr)/.test(relative[3]) ? 60 : 1);
    if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 60 * 24 * 30) return unresolved('unsupported_duration');
    const at = posted.add({ milliseconds: Math.round(minutes * 60000) }).toString();
    return relative[1] === 'within'
      ? { kind: 'window', precision, original, from: posted.toString(), until: at }
      : { kind: 'instant', precision, original, at };
  }
  if (/\b(?:end of day|soon|few|couple)\b/.test(expression)) return unresolved('imprecise_expression');
  const zoneToken = extraction.time_zone;
  if (!zoneToken || !new RegExp(`(^|[^A-Za-z_])${escapeRegExp(zoneToken)}($|[^A-Za-z_])`).test(extraction.evidence)) return unresolved('missing_timezone_evidence');
  const zone = ['PT', 'PST', 'PDT'].includes(zoneToken) ? 'America/Los_Angeles' : zoneToken;
  let localPosted: Temporal.ZonedDateTime;
  try { localPosted = posted.toZonedDateTimeISO(zone); } catch { return unresolved('unsupported_timezone'); }
  // Date-only means a calendar day in the source timezone, never a midnight instant.
  const withoutZone = expression.replace(new RegExp(`\\s*${escapeRegExp(zoneToken.toLowerCase())}\\s*`), ' ').trim();
  if (/^(today|tomorrow)$/.test(withoutZone)) {
    const date = localPosted.toPlainDate().add({ days: withoutZone === 'tomorrow' ? 1 : 0 });
    if (['PST', 'PDT'].includes(zoneToken)) {
      const midday = date.toZonedDateTime({ timeZone: zone, plainTime: '12:00' });
      if (midday.offset !== (zoneToken === 'PST' ? '-08:00' : '-07:00')) return unresolved('timezone_abbreviation_conflict');
    }
    return { kind: 'date', precision: 'unspecified', original, date: date.toString(), time_zone: zone };
  }
  // A clock without a day is anchored to the original post calendar date.
  const clock = withoutZone.match(/^(?:(at|around|about|approximately|by|before)\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?(?:\s+(today|tomorrow|\d{4}-\d{2}-\d{2}))?$/);
  if (!clock) return unresolved('unsupported_time_expression');
  let hour = Number(clock[2]);
  const minute = Number(clock[3] ?? 0);
  if (clock[4]) {
    if (hour < 1 || hour > 12) return unresolved('invalid_clock');
    hour = hour % 12 + (clock[4] === 'pm' ? 12 : 0);
  }
  if (hour > 23 || minute > 59) return unresolved('invalid_clock');
  try {
    const date = !clock[5] || clock[5] === 'today' || clock[5] === 'tomorrow'
      ? localPosted.toPlainDate().add({ days: clock[5] === 'tomorrow' ? 1 : 0 })
      : Temporal.PlainDate.from(clock[5]);
    const local = date.toPlainDateTime({ hour, minute }).toZonedDateTime(zone, { disambiguation: 'reject' });
    if (['PST', 'PDT'].includes(zoneToken) && local.offset !== (zoneToken === 'PST' ? '-08:00' : '-07:00')) return unresolved('timezone_abbreviation_conflict');
    const at = local.toInstant().toString();
    return clock[1] === 'by' || clock[1] === 'before'
      ? { kind: 'window', precision, original, until: at, time_zone: zone }
      : { kind: 'instant', precision, original, at, time_zone: zone };
  } catch { return unresolved('invalid_or_ambiguous_local_time'); }
}

function escapeRegExp(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
