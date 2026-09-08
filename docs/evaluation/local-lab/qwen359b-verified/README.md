# Independent completion verification experiment

Same pinned Qwen3.5-9B Q4_K_M, CPU four threads, no GPU, non-thinking, greedy temperature zero and seed 42. Only initial completed decisions receive one additional call. The verifier sees the full original post but not the initial decision, rationale or expected label. It must return an exact contiguous completion quote and the same delivered reset kind. Rejection, disagreement, invalid/missing evidence or call failure yields uncertain/unresolved; there are no repeated attempts or automatic schedule corrections.

The 52 locked v3 first-stage results were reused, with model hash and original prompt checked; baseline file hashes are in the report. All 13 completion-verification calls are live. The report isolates the added verifier, rather than claiming a fresh full-pipeline run over all 52. One representative full live classification-plus-verification call is saved separately as live-integration.json. These previously seen controlled cases are not unseen release acceptance.

| Metric | Before | After |
| --- | --- | --- |
| False completed | 4 | 0 |
| Correct completion retained | 9/9 | 9/9 |
| Exact whole-case accuracy | 47/52 | 47/52 |
| Additional abstentions | 0 | 4 |

Added verification: 13 calls, 79.79 seconds total wall time, zero transport/truncation errors. Four false completions became unresolved; their correct future schedules were not recovered. The pre-existing missed 'soon' expression remains. Thus false-completion protection improved in this set, but semantic coverage did not improve. No release gate was relaxed and automatic publication remains disabled.

Implementation: src/verify-completion.ts includes both the conditional verifier and live runVerifiedClaim wrapper. Tests cover source-only verifier input, exact quotes, kind mismatch, invented evidence, one-call failures, and skipping non-completed inputs. All 56 tests and TypeScript checks pass. No commits, pushes, feed calls or Actions runs.

```sh
LLAMA_URL=http://127.0.0.1:8083 node --import tsx scripts/evaluate-completion.ts
```
