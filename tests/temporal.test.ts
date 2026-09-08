import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTemporal } from '../src/temporal.js';
import { validateExtraction, type Extraction } from '../src/types.js';

function parse(expression: string, zone: string | null = null, posted_at = '2026-09-08T01:00:00Z', overrides: Partial<Extraction> = {}) {
  const text = `The reset lands ${expression}.`;
  return normalizeTemporal({ event_type: 'reset', state: 'scheduled', audience: [], time_expression: expression, evidence: text, time_zone: zone, ...overrides }, { text, posted_at });
}

test('relative hours cross UTC day boundaries without assuming a timezone', () => {
  assert.equal(parse('in 3 hours', null, '2026-09-08T23:30:00Z').at, '2026-09-09T02:30:00Z');
  assert.equal(parse('in ~3 hours').precision, 'approximate');
  assert.deepEqual(parse('within an hour'), { kind: 'window', precision: 'exact', original: 'within an hour', from: '2026-09-08T01:00:00Z', until: '2026-09-08T02:00:00Z' });
  assert.equal(parse('within 30 minutes').until, '2026-09-08T01:30:00Z');
});

test('PT today uses source calendar date, not UTC date', () => {
  assert.equal(parse('around 6pm PT today', 'PT').at, '2026-09-08T01:00:00Z');
  assert.equal(parse('around 6pm PT today', 'PT').precision, 'approximate');
  assert.equal(parse('by 8pm PT tomorrow', 'PT').until, '2026-09-09T03:00:00Z');
  assert.equal(parse('by 8pm PT tomorrow', 'PT').kind, 'window');
});

test('explicit PST/PDT must match regional offset', () => {
  assert.equal(parse('6pm PST today', 'PST').reason, 'timezone_abbreviation_conflict');
  assert.equal(parse('6pm PDT today', 'PDT').at, '2026-09-08T01:00:00Z');
  assert.equal(parse('6pm PST today', 'PST', '2026-01-08T20:00:00Z').at, '2026-01-09T02:00:00Z');
  assert.equal(parse('6pm PDT today', 'PDT', '2026-01-08T20:00:00Z').kind, 'unresolved');
});

test('DST nonexistent and repeated local times are rejected', () => {
  assert.equal(parse('2:30am PT 2026-03-08', 'PT').reason, 'invalid_or_ambiguous_local_time');
  assert.equal(parse('1:30am PT 2026-11-01', 'PT').reason, 'invalid_or_ambiguous_local_time');
  assert.equal(parse('3:30am PT 2026-03-08', 'PT').at, '2026-03-08T10:30:00Z');
});

test('date-only stays date-only and requires a supported timezone in evidence', () => {
  assert.deepEqual(parse('tomorrow PT', 'PT'), { kind: 'date', precision: 'unspecified', original: 'tomorrow PT', date: '2026-09-08', time_zone: 'America/Los_Angeles' });
  assert.equal(parse('tomorrow').kind, 'unresolved');
  assert.equal(parse('6pm today', 'PT').reason, 'missing_timezone_evidence');
  assert.equal(parse('6pm PT', 'PT').at, '2026-09-08T01:00:00Z');
});

test('vague, negative and unsupported language never gains exact timestamps', () => {
  for (const expression of ['soon', 'in a few hours', 'by end of day PT', 'not in 3 hours', 'in 3 hours maybe', '25pm PT today', '6:61pm PT today']) {
    assert.equal(parse(expression, 'PT').kind, 'unresolved', expression);
  }
});

test('source evidence must exactly match and truncated sources cannot be normalized', () => {
  assert.equal(parse('in 3 hours', null, undefined, { evidence: 'invented' }).reason, 'unsupported_evidence');
  assert.equal(parse('in 3 hours', null, undefined, { evidence: 'The reset lands' }).reason, 'unsupported_evidence');
  const extraction: Extraction = { event_type: 'reset', state: 'scheduled', audience: [], evidence: 'in 3 hours', time_expression: 'in 3 hours', time_zone: null };
  assert.equal(normalizeTemporal(extraction, { text: 'in 3 hours', posted_at: '2026-09-08T00:00:00Z', truncated: true }).reason, 'truncated_source');
  assert.equal(normalizeTemporal(extraction, { text: 'in 3 hours', posted_at: 'invalid' }).reason, 'invalid_posted_at');
});

test('clocks cannot promote a completed or retrospective statement into a schedule', () => {
  assert.equal(parse('in 3 hours', null, undefined, { state: 'completed' }).reason, 'not_a_schedule');
  assert.equal(parse('in 3 hours', null, undefined, { state: 'retrospective' }).reason, 'not_a_schedule');
  assert.equal(parse('in 3 hours', null, undefined, { event_type: 'unknown' }).reason, 'not_a_schedule');
});

test('schema validation rejects missing fields, invalid enums and unexpected model fields', () => {
  const value: Extraction = { event_type: 'reset', state: 'unknown', audience: [], evidence: '', time_expression: '', time_zone: null };
  assert.deepEqual(validateExtraction(value), value);
  assert.throws(() => validateExtraction({ ...value, state: 'confirmed' }));
  assert.throws(() => validateExtraction({ ...value, time_zone: undefined }));
  assert.throws(() => validateExtraction({ ...value, timestamp: 'invented' }));
});
