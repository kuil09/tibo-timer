import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COPY } from '../public/copy.mjs';

const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.mjs', import.meta.url), 'utf8');
const snapshot = JSON.parse(await readFile(new URL('./ui-copy.snapshot.json', import.meta.url), 'utf8'));

function visibleBodyText(html) {
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
  return [...body.replace(/<!--[\s\S]*?-->/g, '').matchAll(/>([^<>]+)</g)]
    .map(match => match[1].replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

test('static visible copy matches the approved snapshot', () => {
  assert.deepEqual(visibleBodyText(index), snapshot.html,
    'Visible HTML copy changed. Update the approved copy snapshot only for an intentional product-copy change.');
});

test('runtime visible copy matches the approved snapshot', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(COPY)), snapshot.runtime,
    'Runtime UI copy changed. Update the approved copy snapshot only for an intentional product-copy change.');
});

test('runtime DOM copy is routed through the copy contract', () => {
  const directLiterals = [...app.matchAll(/\.textContent\s*=\s*(['"`])([^'"`]*)\1/g)]
    .map(match => match[2])
    .filter(Boolean);
  assert.deepEqual(directLiterals, [],
    'Do not hardcode user-visible strings in app.mjs; declare approved runtime copy in public/copy.mjs.');
  assert.doesNotMatch(app, /\.innerHTML\s*=|insertAdjacentHTML\s*\(/,
    'Runtime HTML injection bypasses the user-visible copy contract.');
});

test('portrait implementation metadata is not user-visible copy', () => {
  assert.doesNotMatch(index, /LIVE ASCII PROFILE|WebGL\s*·\s*Tibo/);
});
