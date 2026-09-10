import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = 'https://kuil09.github.io/tibo-timer/';
for (let attempt = 0; attempt < 5; attempt++) {
  try {
    for (const path of ['version.json', 'status.json', 'index.html', 'app.mjs', 'copy.mjs', 'view.mjs', 'tibo-ascii.mjs', 'tibo-ascii-data.mjs', 'style.css']) {
      const expected = await readFile(`dist/${path}`, 'utf8');
      const response = await fetch(`${base}${path === 'index.html' ? '' : path}?verify=${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-${attempt}`, { signal: AbortSignal.timeout(20000), headers: { 'Cache-Control': 'no-cache' } });
      assert.equal(response.status, 200, `${path}: HTTP response`);
      assert.equal(await response.text(), expected, `${path}: deployed content mismatch`);
    }
    console.log('Verified deployed HTML, JavaScript, CSS, ASCII portrait, UI copy contract, version and public status against this build.');
    break;
  } catch (error) {
    if (attempt === 4) throw error;
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}
