import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceUrl, isStale, nextEvent, stateLabel, temporalLabel, countdown } from '../public/view.js';

const scheduled = (type = 'reset', at = '2026-09-08T12:00:00Z') => ({
  event: { type, state: 'scheduled' }, temporal: { kind: 'instant', at, precision: 'exact' },
});

test('expired schedule never becomes completed', () => {
  const event = scheduled();
  const now = Date.parse('2026-09-08T12:00:01Z');
  assert.match(stateLabel(event, now), /완료 미확인/);
  assert.match(countdown(event, now), /완료 미확인/);
  assert.equal(nextEvent([event], 'reset', now), null);
});

test('banked grants are selected independently of general resets', () => {
  const banked = scheduled('banked_reset');
  assert.equal(nextEvent([banked], 'reset', 0), null);
  assert.equal(nextEvent([banked], 'banked_reset', 0), banked);
});

test('date-only information retains source date and timezone', () => {
  const label = temporalLabel({ kind: 'date', date: '2026-09-08', time_zone: 'America/Los_Angeles' }, 'Asia/Seoul');
  assert.match(label, /2026-09-08/);
  assert.match(label, /America\/Los_Angeles/);
  assert.match(label, /시각 미정/);
});

test('timezone renders the same instant on either side of a date boundary', () => {
  const temporal = { kind: 'instant', at: '2026-09-08T23:00:00Z', precision: 'exact' };
  assert.match(temporalLabel(temporal, 'Asia/Seoul'), /9일/);
  assert.match(temporalLabel(temporal, 'America/Los_Angeles'), /8일/);
  assert.match(temporalLabel(temporal, 'Europe/London'), /9일/);
});

test('only secure X URLs without embedded credentials are linked', () => {
  assert.equal(sourceUrl('https://x.com/thibault/status/123'), 'https://x.com/thibault/status/123');
  for (const url of ['javascript:alert(1)', 'https://x.com.evil.test/', 'http://x.com/', 'https://evil@x.com/']) assert.equal(sourceUrl(url), null);
});

test('staleness begins after sixty minutes and absent timestamps are stale', () => {
  const at = '2026-09-08T12:00:00Z';
  assert.equal(isStale(at, Date.parse(at) + 3600000), false);
  assert.equal(isStale(at, Date.parse(at) + 3600001), true);
  assert.equal(isStale(null), true);
});

test('approximate countdown explicitly retains uncertainty', () => {
  const item = scheduled();
  item.temporal.precision = 'approximate';
  assert.match(countdown(item, Date.parse('2026-09-08T11:00:00Z')), /^예상 시각까지/);
});
