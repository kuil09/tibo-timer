# All-claim verification with at most three attempts

Every non-truncated result receives an independent check of claim, reset kind and selected delivery time, including uncertain and not-announcement results. The verifier sees source text and exact time candidates, not the initial answer. Evidence must be a literal source quote for an asserted event. A disagreement or invalid result triggers a fresh inference-plus-verification attempt. Maximum three total attempts (initial plus two retries); agreement stops immediately. Exhaustion remains uncertain/unresolved. Truncated input bypasses model calls. A failed initial inference cannot be accepted solely on a verifier result.

The local Qwen3.5-9B Q4_K_M CPU setup remains unchanged: four threads, no GPU, non-thinking, temperature zero, seed 42. First-stage v3 results were locked; 51 live verification calls produced the locked first attempts. This loop reused those first attempts and made 70 live additional calls for the 16 rejected cases. Baseline SHA-256 and all attempt results are in report.json. No claims of a fully fresh 52-case first-stage rerun or unseen acceptance are made.

| Result | Count |
| --- | --- |
| Total | 52 |
| First-attempt termination | 36 (35 agreements + 1 truncated bypass) |
| Second-attempt termination | 0 |
| Three-attempt exhaustion | 16 |
| False completed / false scheduled | 0 / 0 |
| Accepted wrong results | 0 |
| Exact correct including appropriate uncertain/bypass | 38/52 |
| Recovered by retries | 0 |

The first independent pass took 457.60 seconds; retries added 545.88 seconds and 70 calls, excluding reused initial classification time. Greedy retries did not improve this set. Repeated identical prompts/settings can repeat the same errors; repeated agreement is not proof of correctness. All-claim verification also rejected 11 initially correct cases, retaining only 6/9 true completion announcements. It trades coverage for abstention and is not approved for automated publication.

`src/verify-claim.ts` is the implementation; the existing runVerifiedClaim export now routes through this bounded all-claim loop. Historical completion-only evaluation is preserved. Sixty tests and TypeScript/build checks pass. Production automatic inference and remote scheduled collection remain disabled.

```sh
LLAMA_URL=http://127.0.0.1:8083 npm run evaluate:verification
LLAMA_URL=http://127.0.0.1:8083 npm run evaluate:verification-loop
```
