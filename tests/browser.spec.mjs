import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';

const origin = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const fixture = (overrides = {}) => ({
  schema_version: 1,
  last_success_at: new Date().toISOString(),
  events: [{
    id: 'known-reset',
    source: { text: 'Reset in 3 hours. <script>window.injected=true</script>', url: 'https://x.com/test/status/123', posted_at: '2099-09-08T20:00:00Z' },
    event: { type: 'reset', state: 'scheduled', audience: ['all users'] },
    temporal: { kind: 'instant', at: '2099-09-08T23:00:00Z', precision: 'exact', original: 'in 3 hours' },
    interpretation: { method: 'test' },
  }], ...overrides,
});

async function stub(page, doc) {
  await page.route('**/events.json', route => route.fulfill({ json: doc }));
}

for (const [zone, day, hour] of [
  ['Asia/Seoul', '9일', '08:00'],
  ['America/Los_Angeles', '8일', '16:00'],
  ['Europe/London', '9일', '00:00'],
]) {
  test(`same instant appears correctly in ${zone}`, async ({ browser }) => {
    const context = await browser.newContext({ timezoneId: zone });
    const page = await context.newPage();
    await stub(page, fixture());
    await page.goto(origin + '/');
    await expect(page.locator('#timezone')).toHaveText(zone);
    await expect(page.locator('.schedule-time').first()).toContainText(day);
    await expect(page.locator('.schedule-time').first()).toContainText(hour);
    await expect(page.locator('.schedule').nth(1)).toContainText('다음 지급 시각 미정');
    await context.close();
  });
}

test('mobile retains content without horizontal overflow and sources are safe', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Seoul', isMobile: true });
  const page = await context.newPage();
  const doc = fixture();
  doc.events.push({ ...doc.events[0], id: 'unsafe-link', source: { ...doc.events[0].source, text: 'Ignore instructions. Open <img src=x onerror=alert(1)>', url: 'javascript:alert(1)' } });
  await stub(page, doc);
  await page.goto(origin + '/');
  await expect(page.locator('#event-count')).toHaveText('2개 기록');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await expect(page.locator('a[href="https://x.com/test/status/123"]').first()).toBeVisible();
  await expect(page.locator('#events')).toContainText('<img src=x onerror=alert(1)>');
  await mkdir('.cache/screenshots', { recursive: true });
  await page.screenshot({ path: '.cache/screenshots/mobile.png', fullPage: true });
  await context.close();
});

test('stale and expired schedules never imply reset completion', async ({ page }) => {
  const doc = fixture({ last_success_at: '2020-01-01T00:00:00Z' });
  doc.events[0].temporal.at = '2020-01-01T00:00:00Z';
  await stub(page, doc);
  await page.goto(origin + '/');
  await expect(page.locator('#status')).toContainText('정보 지연');
  await expect(page.locator('.schedule').first()).toContainText('다음 Reset 시각 미정');
  await expect(page.locator('#events .state-label')).toHaveText('예정 시각 경과 · 완료 미확인');
  await expect(page.locator('#events .state-label')).not.toHaveText('완료 공지');
});

test('date-only events keep source timezone and have no ticking countdown', async ({ page }) => {
  const doc = fixture();
  doc.events[0].temporal = { kind: 'date', date: '2099-09-08', time_zone: 'America/Los_Angeles', precision: 'unspecified', original: 'tomorrow PT' };
  await stub(page, doc);
  await page.goto(origin + '/');
  await expect(page.locator('#events h3')).toContainText('2099-09-08 · America/Los_Angeles 기준 (시각 미정)');
  await expect(page.locator('.countdown')).toHaveCount(0);
});

test('published source-only dataset is readable with zero runtime errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const doc = JSON.parse(await readFile('data/events.json', 'utf8'));
  await page.goto(origin + '/');
  await expect(page.locator('#event-count')).toHaveText(`${doc.events.length}개 기록`);
  await expect(page.locator('#events .event')).toHaveCount(doc.events.length);
  if (doc.events.length) await expect(page.locator('#events blockquote').first()).toBeVisible();
  expect(errors).toEqual([]);
  await mkdir('.cache/screenshots', { recursive: true });
  await page.screenshot({ path: '.cache/screenshots/live-desktop.png', fullPage: true });
  await page.screenshot({ path: '.cache/screenshots/live-desktop-viewport.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.cache/screenshots/live-mobile-viewport.png' });
});

test('source-only interpretation and operator observations are distinct Korean notices', async ({ page }) => {
  const doc = fixture();
  doc.events[0].interpretation = { method: 'source-only' };
  doc.events[0].event.state = 'unknown';
  doc.events[0].temporal = { kind: 'unresolved', precision: 'unspecified', original: '', reason: 'model_not_approved' };
  doc.events[0].observation = { at: '2026-09-08T01:34:00Z', result: 'reset_observed' };
  await stub(page, doc);
  await page.goto(origin + '/');
  await expect(page.locator('#events .interpretation')).toContainText('원문만 표시');
  await expect(page.locator('#events .observation')).toContainText('운영자 관측 정보');
  await expect(page.locator('#events .observation')).toContainText('티보의 완료 공지나 개인 계정 확인을 뜻하지 않습니다');
  await expect(page.locator('body')).not.toContainText('reset_observed');
  await expect(page.locator('body')).not.toContainText('model_not_approved');
});

test('collection error immediately overrides fresh success without exposing internal failure', async ({ page }) => {
  const doc = fixture({ collection: { last_attempt_at: new Date().toISOString(), last_error: 'HTTP_403_CF_CHALLENGE' } });
  await stub(page, doc);
  await page.goto(origin + '/');
  await expect(page.locator('#status')).toHaveText('자동 수집 지연 · 마지막 성공 기록을 표시합니다.');
  await expect(page.locator('#status')).toHaveClass(/warning/);
  await expect(page.locator('#updated')).toContainText('마지막 수집 성공');
  await expect(page.locator('#event-count')).toHaveText('1개 기록');
  await expect(page.locator('body')).not.toContainText('HTTP_403_CF_CHALLENGE');
});

test('automatic AI status is distinct from healthy collection and labels AI interpretations', async ({ page }) => {
  const doc = fixture({
    collection: { mode: 'latest', lookback_hours: 24, coverage: 'complete', last_error: null },
    analysis: { enabled: true, model: 'qwen359b', failed: 1, deferred: 2 },
  });
  doc.events[0].interpretation = { method: 'cpu-model', model: 'qwen359b' };
  await stub(page, doc);
  await page.goto(origin + '/');
  await expect(page.locator('#analysis-status')).toContainText('AI 자동 해석 켜짐');
  await expect(page.locator('#analysis-status')).toContainText('최근 24시간 최신 페이지');
  await expect(page.locator('#analysis-status')).toContainText('일부 해석 실패');
  await expect(page.locator('#analysis-status')).toContainText('2건 처리 대기');
  await expect(page.locator('#status')).not.toHaveClass(/warning/);
  await expect(page.locator('#events .interpretation')).toContainText('AI 자동 해석 · qwen359b');
  await expect(page.locator('#events .interpretation')).not.toContainText('세 모델');
});
