# Qwen claim refinement: v2 and v3

Same pinned Qwen3.5-9B Q4_K_M, CPU four threads, no GPU, non-thinking, temperature zero, seed 42. Model remained loaded; no download or Actions run. Existing production selection remains disabled.

V2 combined type and state into one enum and expanded instructions. It regressed from 18/20 to 13/20 on minimal pairs, so development/fresh evaluation was not expanded for v2. Failed results preserved in the neighboring qwen359b-v2 folder.

V3 preserves claim/reset_kind fields, restricts their combinations using JSON Schema oneOf, and adds short historical/future-delivery distinctions to the original prompt. Time-selection instructions remain unchanged. Original labels and scoring have not changed.

| Set | Before | V3 | Seconds | False completed |
| --- | --- | --- | --- | --- |
| Minimal pairs | 18/20 | 18/20 | 186.86 | 1 |
| Development | 16/20 | 18/20 | 181.51 | 2 |
| Fresh independent controlled cases | Not run | 11/12 | 106.93 | 1 |

Existing-case exact accuracy improves 34/40 to 36/40; existing-case false completions remain three. There are zero validation errors and zero false-scheduled or false-normalized-time outputs in v3 across these sets. V3 is slower than v1. New fixture was authored by a separate agent without reading prior prompts/fixtures/results, frozen before fresh inference; the main agent inspected it only after the v3 prompt was fixed and did not tune against its outputs. It is a small controlled probe, not release acceptance and lacks a v1 comparison.

Remaining existing failures: future PT/PST clock announcements misclassified completed (three), and a scheduled 'soon' time dropped (one). Fresh failure: confirmed future approximate reset classified completed. Thus neither structural consistency nor this prompt change makes automated publication acceptable.

Suggested next bounded experiment: independently verify completed claims against literal past-delivery evidence, without presenting the first answer to the verifier. A disagreement stays unresolved; a firm future reinterpretation needs separate evaluation rather than silently replacing the result. Measure false completion, coverage and extra latency; never repeatedly sample until agreement.

```sh
CLAIM_VERSION=v3 LOCAL_MODEL=qwen359b LLAMA_URL=http://127.0.0.1:8083 npm run evaluate:claims -- --pairs
CLAIM_VERSION=v3 LOCAL_MODEL=qwen359b LLAMA_URL=http://127.0.0.1:8083 npm run evaluate:claims
CLAIM_VERSION=v3 LOCAL_MODEL=qwen359b LLAMA_URL=http://127.0.0.1:8083 npm run evaluate:claims -- --fresh
```
