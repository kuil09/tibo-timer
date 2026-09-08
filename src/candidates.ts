import type { Extraction, EventType, AnnouncementState } from './types.ts';

export interface SentenceCandidate { id: string; text: string; start: number; end: number }
export interface TimeCandidate extends SentenceCandidate { sentence_id: string; time_zone: string | null }
export interface Candidates { sentences: SentenceCandidate[]; times: TimeCandidate[] }
export interface Selection { event_type: EventType; state: AnnouncementState; sentence_id: string | null; time_id: string | null }

/** Candidate offsets refer to the untouched source; models select identifiers, never rewrite spans. */
export function buildCandidates(text: string): Candidates {
  const sentences: SentenceCandidate[] = [];
  let start = 0;
  const append = (end: number) => {
    let left = start, right = end;
    while (left < right && /\s/.test(text[left])) left++;
    while (right > left && /\s/.test(text[right - 1])) right--;
    if (right > left) sentences.push({ id: `s${sentences.length}`, text: text.slice(left, right), start: left, end: right });
    start = end;
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n' || ch === '\r') { append(i); start = i + 1; }
    else if (/[.!?]/.test(ch) && (i + 1 === text.length || /\s/.test(text[i + 1]))) {
      // Internal decimal points, URLs and dotted abbreviations are not boundaries.
      if (ch === '.' && (/\d/.test(text[i - 1] ?? '') && /\d/.test(text[i + 1] ?? '') || /\b(?:a|p)\.m\.$/i.test(text.slice(start, i + 1)))) continue;
      append(i + 1);
    }
  }
  append(text.length);
  const times: TimeCandidate[] = [];
  const zone = '(?:PST|PDT|PT|UTC|[A-Za-z_]+(?:/[A-Za-z_]+)+)';
  const day = '(?:today|tomorrow|\\d{4}-\\d{2}-\\d{2})';
  const expressions = new RegExp([
    '\\b(?:in|within)\\s+(?:(?:around|about|approximately)\\s+|~\\s*)?(?:\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|twelve)\\s+(?:hours?|hrs?|minutes?|mins?)\\b',
    `\\b(?:(?:at|by|before|around|about|approximately)\\s+)?\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)\\b(?:\\s+${zone})?(?:\\s+${day})?`,
    `\\b(?:(?:at|by|before|around|about|approximately)\\s+)?\\d{1,2}:\\d{2}\\s+${zone}(?:\\s+${day})?`,
    `\\b(?:today|tomorrow)(?:\\s+${zone})?`,
    '\\b(?:by\\s+)?end of day\\b',
    '\\bsoon\\b',
  ].join('|'), 'gi');
  for (const sentence of sentences) {
    for (const match of sentence.text.matchAll(expressions)) {
      const phrase = match[0];
      const localStart = match.index!;
      const offset = sentence.start + localStart;
      // Timezone is taken from this exact phrase, never the rest of a sentence.
      const zoneMatch = phrase.match(/\b(PST|PDT|PT|UTC|[A-Za-z_]+(?:\/[A-Za-z_]+)+)\b/i);
      const rawZone = zoneMatch?.[1] ?? null;
      times.push({ id: `t${times.length}`, text: phrase, sentence_id: sentence.id, start: offset, end: offset + phrase.length,
        time_zone: rawZone && /^(PST|PDT|PT|UTC)$/i.test(rawZone) ? rawZone.toUpperCase() : rawZone });
    }
  }
  return { sentences, times };
}

export function resolveSelection(text: string, candidates: Candidates, selection: unknown): Extraction {
  if (!selection || typeof selection !== 'object' || Array.isArray(selection)) throw new Error('invalid_selection');
  const x = selection as Record<string, unknown>;
  const keys = ['event_type', 'state', 'sentence_id', 'time_id'];
  if (Object.keys(x).length !== keys.length || Object.keys(x).some(k => !keys.includes(k))) throw new Error('invalid_selection_fields');
  if (!['reset', 'banked_reset', 'unknown'].includes(String(x.event_type)) || !['scheduled', 'completed', 'retrospective', 'unknown'].includes(String(x.state))) throw new Error('invalid_selection_classification');
  if (![x.sentence_id, x.time_id].every(id => id === null || typeof id === 'string')) throw new Error('invalid_selection_id');
  const sentence = candidates.sentences.find(s => s.id === x.sentence_id);
  const time = candidates.times.find(t => t.id === x.time_id);
  if (x.sentence_id !== null && !sentence || x.time_id !== null && !time) throw new Error('unknown_candidate_id');
  if (time && (!sentence || time.sentence_id !== sentence.id)) throw new Error('candidate_sentence_mismatch');
  if (x.event_type === 'unknown' && x.state !== 'unknown') throw new Error('inconsistent_unknown_state');
  if ((x.event_type === 'unknown' || x.state !== 'scheduled') && time) throw new Error('nonscheduled_time_selection');
  if ((x.event_type !== 'unknown' || x.state !== 'unknown') && !sentence) throw new Error('missing_evidence_sentence');
  if (sentence && text.slice(sentence.start, sentence.end) !== sentence.text) throw new Error('candidate_source_mismatch');
  if (time && (text.slice(time.start, time.end) !== time.text || time.start < sentence!.start || time.end > sentence!.end)) throw new Error('candidate_source_mismatch');
  return { event_type: x.event_type as EventType, state: x.state as AnnouncementState, audience: [], evidence: sentence?.text ?? '', time_expression: time?.text ?? '', time_zone: time?.time_zone ?? null };
}
