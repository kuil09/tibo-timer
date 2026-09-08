import type { Extraction } from './types.js';

/** Deliberately small lexical comparator; never used as an automatic publication fallback. */
export function baseline(text: string): Extraction {
  const empty: Extraction = { event_type: 'unknown', state: 'unknown', audience: [], time_expression: '', evidence: '', time_zone: null };
  if (/prompt injection|ignore all previous|SYSTEM:|not a reset announcement/i.test(text)) return empty;
  if (!/\breset(?:s|ed|ing)?\b/i.test(text)) return empty;
  const event_type = /banked reset/i.test(text) ? 'banked_reset' : 'reset';
  const evidence = text.split(/[.!?\n]/).find(s => /reset/i.test(s))?.trim() ?? '';
  const result: Extraction = { ...empty, event_type, evidence };
  if (/\bnot\b|\bif\b|\bmight\b|\bwhich\b|\bintrigued\b/i.test(text)) return result;
  if (/last (?:week|month)|forgot the part|yesterday we reset/i.test(text)) return { ...result, state: 'retrospective' };
  if (/all reset|have now reset|has now been delivered|have received.*banked reset/i.test(text)) return { ...result, state: 'completed' };
  if (!/will|lands?\b|arrive|reset(?:s)? tomorrow/i.test(text)) return result;
  const time_expression = text.match(/(?:in|within)\s+(?:~\s*)?\d+\s+hours?\b|(?:at|around)\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)\s+(?:PST|PDT|PT)(?:\s+(?:today|tomorrow))?|(?:by\s+)?end of day|tomorrow(?:\s+PT)?/i)?.[0] ?? '';
  return { ...result, state: 'scheduled', time_expression, time_zone: time_expression.match(/\b(PST|PDT|PT)\b/)?.[1] ?? null, evidence: time_expression ? text.split(/[.!?\n]/).find(s => s.includes(time_expression))?.trim() ?? evidence : evidence };
}
