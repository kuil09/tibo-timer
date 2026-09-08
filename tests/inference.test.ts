import test from 'node:test';
import assert from 'node:assert/strict';
import { extract, extractionSchema } from '../src/inference.ts';
import { extractionSchema as canonicalSchema } from '../src/types.ts';

const source = 'The reset is complete.';
const valid = { event_type: 'reset', state: 'completed', audience: [], time_expression: '', evidence: source, time_zone: null };

test('inference boundary rejects unsafe and malformed requests without external calls', async t => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.LLAMA_URL;
  t.after(() => { globalThis.fetch = originalFetch; if (originalUrl === undefined) delete process.env.LLAMA_URL; else process.env.LLAMA_URL = originalUrl; });
  process.env.LLAMA_URL = 'http://127.0.0.1:8080';
  function mock(tokens: unknown, content: unknown = valid, finish_reason = 'stop') {
    const requests: { url: string; options?: RequestInit }[] = [];
    globalThis.fetch = (async (url, options) => {
      requests.push({ url: String(url), options });
      return new Response(JSON.stringify(String(url).endsWith('/tokenize') ? { tokens } : { choices: [{ finish_reason, message: { content: JSON.stringify(content) } }] }), { status: 200 });
    }) as typeof fetch;
    return requests;
  }
  await t.test('canonical schema, JSON input, local-only redirects and nonthinking mode', async () => {
    assert.equal(extractionSchema, canonicalSchema);
    const requests = mock([1, 2]);
    assert.deepEqual(await extract(source), valid);
    assert.equal(requests.length, 2);
    assert.ok(requests.every(r => r.options?.redirect === 'error'));
    const payload = JSON.parse(String(requests[1].options?.body));
    assert.equal(payload.chat_template_kwargs.enable_thinking, false);
    assert.equal(payload.max_tokens, 384);
    assert.equal(JSON.parse(payload.messages[1].content).source_text, source);
  });
  await t.test('context overflow stops before model request', async () => {
    const requests = mock(Array(3201).fill(0));
    await assert.rejects(extract(source), /input_context_exceeded/);
    assert.equal(requests.length, 1);
  });
  await t.test('invalid tokenizer response fails closed', async () => {
    mock(null);
    await assert.rejects(extract(source), /input_context_exceeded/);
  });
  await t.test('truncated output is never accepted as extraction', async () => {
    mock([], valid, 'length');
    await assert.rejects(extract(source), /output_truncated_or_missing/);
  });
  await t.test('schema errors and hallucinated evidence fail closed', async () => {
    mock([], { ...valid, state: 'verified' });
    await assert.rejects(extract(source), /Invalid classification/);
    mock([], { ...valid, evidence: '' });
    await assert.rejects(extract(source), /invalid_evidence/);
    mock([], { ...valid, evidence: 'not in original' });
    await assert.rejects(extract(source), /invalid_evidence/);
    mock([], { ...valid, time_expression: 'tomorrow' });
    await assert.rejects(extract(source), /invalid_evidence/);
  });
  await t.test('nonloopback URLs and credentials are rejected before fetch', async () => {
    for (const url of ['https://example.com', 'http://127.0.0.1.example.com', 'ftp://localhost', 'http://user:secret@localhost']) {
      process.env.LLAMA_URL = url;
      const requests = mock([]);
      await assert.rejects(extract(source), /loopback/);
      assert.equal(requests.length, 0);
    }
  });
});
