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
});
