# EXAONE 3.5 2.4B local CPU experiment

Official Q8_0 GGUF, llama.cpp b10856 on macOS arm64; GPU layers 0, CPU threads 4, context 4096. Model SHA-256 verified. Server chat template exactly matches the official tokenizer template saved alongside this report. Both stages prepend the official system sentence: `You are EXAONE model from LG AI Research, a helpful assistant.`

The existing claims-v1 instructions, temperature 0, seed 42, 384 output token limit and scoring remain unchanged. Each case is run once; truncated source bypasses inference. These are existing development fixtures, not unseen release acceptance.

| Set | Correct | Class correct | Validation errors | False scheduled | False completed | False normalized time | Seconds |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Minimal pairs | 12/20 | 13/20 | 4 | 5 | 1 | 3 | 37.54 |
| Development | 13/20 | 13/20 | 4 | 3 | 0 | 0 | 37.05 |

All eight validation errors are inconsistent claim/kind combinations. Raw false-scheduled counts include invalid combinations. The server warned about special_eos_id at startup, but all generation responses in this run stopped normally; there were no timeout/truncation errors. This does not prove every tokenizer edge case is correct.

Download took approximately 220 seconds. Post-evaluation server RSS was 5,471,888 KiB (5.22 GiB); this is a single snapshot, not peak memory. Cached model and running server are reusable locally. Linux GitHub runner timing, cold-start deadline and new unseen acceptance remain untested. Automatic interpretation remains disabled; no Actions or publishing changes were made.

Reproduce after launching the model on localhost:8082:

```sh
LOCAL_MODEL=exaone35 LLAMA_URL=http://127.0.0.1:8082 npm run evaluate:claims -- --pairs
LOCAL_MODEL=exaone35 LLAMA_URL=http://127.0.0.1:8082 npm run evaluate:claims
```
