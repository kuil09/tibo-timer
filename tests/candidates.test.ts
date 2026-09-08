import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCandidates, resolveSelection } from '../src/candidates.ts';

test('candidate spans preserve decimals, newlines and source bytes', () => {
  const text = '  Reset in 1.5 hours.\nBanked reset around 9pm PT tomorrow!  ';
  const candidates = buildCandidates(text);
  assert.equal(candidates.sentences.length, 2);
  assert.deepEqual(candidates.times.map(t => t.text), ['in 1.5 hours', 'around 9pm PT tomorrow']);
  for (const span of [...candidates.sentences, ...candidates.times]) assert.equal(text.slice(span.start, span.end), span.text);
});

test('retains qualifiers and isolates eligibility timezone from delivery', () => {
  const c = buildCandidates('Lands by end of day and if you create your account by 8pm PT then you get it too.');
  assert.deepEqual(c.times.map(t => [t.text, t.time_zone]), [['by end of day', null], ['by 8pm PT', 'PT']]);
  assert.deepEqual(buildCandidates('in ~ 3 hours, within an hour, soon, tomorrow PT').times.map(t => t.text), ['in ~ 3 hours', 'within an hour', 'soon', 'tomorrow PT']);
});

test('selection derives exact evidence, linked time and no inferred audience', () => {
  const text = 'Reset in 3 hours. Another reset tomorrow PT.';
  const c = buildCandidates(text);
  assert.deepEqual(resolveSelection(text, c, { event_type: 'reset', state: 'scheduled', sentence_id: 's0', time_id: 't0' }), {
    event_type: 'reset', state: 'scheduled', audience: [], evidence: 'Reset in 3 hours.', time_expression: 'in 3 hours', time_zone: null,
  });
  assert.throws(() => resolveSelection(text, c, { event_type: 'reset', state: 'scheduled', sentence_id: 's0', time_id: 't1' }), /candidate_sentence_mismatch/);
});

test('invalid identifiers, extra fields and completion time selections are rejected', () => {
  const text = 'Reset in 3 hours.';
  const c = buildCandidates(text);
  const value = { event_type: 'reset', state: 'scheduled', sentence_id: 's0', time_id: 't0' };
  assert.throws(() => resolveSelection(text, c, { ...value, time_id: 'invented' }), /unknown_candidate_id/);
  assert.throws(() => resolveSelection(text, c, { ...value, timestamp: 'invented' }), /invalid_selection_fields/);
  assert.throws(() => resolveSelection(text, c, { ...value, state: 'completed' }), /nonscheduled_time_selection/);
  assert.throws(() => resolveSelection(text, c, { ...value, event_type: 'unknown' }), /inconsistent_unknown_state/);
  assert.throws(() => resolveSelection(text, c, { ...value, sentence_id: null, time_id: null }), /missing_evidence_sentence/);
  assert.equal(resolveSelection(text, c, { event_type: 'unknown', state: 'unknown', sentence_id: null, time_id: null }).time_expression, '');
  assert.throws(() => resolveSelection('tampered', c, value), /candidate_source_mismatch/);
});
