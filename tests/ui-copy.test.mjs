import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COPY } from '../public/copy.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
const view = await readFile(new URL('../public/view.mjs', import.meta.url), 'utf8');
const domain = await readFile(new URL('../src/domain.mjs', import.meta.url), 'utf8');
const snapshot = JSON.parse(await readFile(new URL('./ui-copy.snapshot.json', import.meta.url), 'utf8'));

function visibleBodyText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  return [...body.replace(/<!--[\s\S]*?-->/g, '').matchAll(/>([^<>]+)</g)]
    .map(match => match[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function strings(value) {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test('static visible copy matches the audited snapshot', () => {
  assert.deepEqual(visibleBodyText(index), snapshot.html,
    'Visible HTML copy changed. A snapshot update records a change; it does not by itself approve the product copy.');
});

test('runtime visible copy matches the audited snapshot', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(COPY)), snapshot.runtime,
    'Runtime UI copy changed. A snapshot update records a change; it does not by itself approve the product copy.');
});

test('runtime DOM copy is routed through the copy contract', () => {
  const directLiterals = [...app.matchAll(/\.textContent\s*=\s*(['"`])([^'"`]*)\1/g)]
    .map(match => match[2])
    .filter(Boolean);
  assert.deepEqual(directLiterals, [],
    'Do not hardcode user-visible strings in app.mjs; declare intentional runtime copy in public/copy.mjs.');
  assert.doesNotMatch(app, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/,
    'Runtime HTML injection bypasses the user-visible copy contract.');
  assert.doesNotMatch(view, /\btitle\s*:/,
    'view.mjs should return presentation state, not user-facing headline copy.');
});

test('audited copy excludes implementation, developer, criteria and debug narration', () => {
  const visible = [...visibleBodyText(index), ...strings(COPY)].join('\n');
  const forbidden = [
    /OpenRouter/i,
    /WebGL/i,
    /Three\.js/i,
    /(?:3개|세\s*모델|3\/3)/,
    /모델\s*(?:해석|응답|별|이용)/,
    /AI\s*:/i,
    /LIVE ASCII PROFILE/i,
    /마지막\s*수집/,
    /약\s*20분/,
    /기기\s*설정\s*기준/,
    /최신\s*페이지/,
    /운영\s*설정/,
    /무료\s*호출/,
    /UTC\s*(?:날짜|재개)?/i
  ];
  for (const pattern of forbidden) assert.doesNotMatch(visible, pattern, `Leaked internal narration matched ${pattern}`);
});

test('browser UI does not render internal analysis surfaces', () => {
  assert.doesNotMatch(app, /analysis_status|checked_at|last_success_at|\.votes\b|vote\.model|createElement\(['"]details['"]\)|\bbadge\b/,
    'Internal analysis, freshness metadata, model votes, or status badges must not be rendered in the product UI.');
});

test('public snapshot omits analysis and model internals not needed by the browser', () => {
  const projection = domain.match(/export function publicSnapshot[\s\S]*$/)?.[0] ?? '';
  assert.doesNotMatch(projection, /analysis_status|checked_at|\bmodels\b|\bvotes\b|\btruncated\b|\bstatus\b/,
    'Public status.json must not expose model, vote, processing-status, or collection-debug metadata that the UI does not need.');
});

test('portrait implementation metadata is not user-visible copy', () => {
  assert.doesNotMatch(index, /LIVE ASCII PROFILE|WebGL\s*·\s*Tibo/);
});
