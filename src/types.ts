export type EventType = 'reset' | 'banked_reset' | 'unknown';
export type AnnouncementState = 'scheduled' | 'completed' | 'retrospective' | 'unknown';
export interface Extraction {
  event_type: EventType;
  state: AnnouncementState;
  audience: string[];
  time_expression: string;
  evidence: string;
  time_zone: string | null;
}
export interface TemporalValue {
  kind: 'instant' | 'window' | 'date' | 'unresolved';
  precision: 'exact' | 'approximate' | 'unspecified';
  original: string;
  at?: string;
  from?: string;
  until?: string;
  date?: string;
  time_zone?: string;
  reason?: string;
}
export interface EventRecord {
  id: string;
  source: { url: string; text: string; posted_at: string; truncated?: boolean };
  event: { type: EventType; state: AnnouncementState; audience: string[] };
  temporal: TemporalValue;
  interpretation: { method: string; model?: string };
  observation?: unknown;
}
export const extractionSchema = {
  type: 'object', additionalProperties: false,
  required: ['event_type', 'state', 'audience', 'time_expression', 'evidence', 'time_zone'],
  properties: {
    event_type: { type: 'string', enum: ['reset', 'banked_reset', 'unknown'] },
    state: { type: 'string', enum: ['scheduled', 'completed', 'retrospective', 'unknown'] },
    audience: { type: 'array', items: { type: 'string' }, maxItems: 10 },
    time_expression: { type: 'string', maxLength: 500 },
    evidence: { type: 'string', maxLength: 3000 },
    time_zone: { type: ['string', 'null'] },
  },
} as const;
export const EXTRACTION_SCHEMA = extractionSchema;

export function validateExtraction(value: unknown): Extraction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Extraction must be an object');
  const x = value as Record<string, unknown>;
  if (Object.keys(x).some(k => !extractionSchema.required.includes(k as typeof extractionSchema.required[number]))) throw new Error('Unexpected extraction field');
  if (!['reset', 'banked_reset', 'unknown'].includes(String(x.event_type)) || !['scheduled', 'completed', 'retrospective', 'unknown'].includes(String(x.state))) throw new Error('Invalid classification');
  if (!Array.isArray(x.audience) || x.audience.length > 10 || !x.audience.every(a => typeof a === 'string' && a.length <= 200)) throw new Error('Invalid audience');
  if (typeof x.time_expression !== 'string' || x.time_expression.length > 500 || typeof x.evidence !== 'string' || x.evidence.length > 3000 || !(x.time_zone === null || (typeof x.time_zone === 'string' && x.time_zone.length <= 100))) throw new Error('Invalid extraction evidence');
  return x as unknown as Extraction;
}
