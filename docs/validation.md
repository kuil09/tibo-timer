# Release validation — 2026-09-08

## CPU decision

Inference publication remains **disabled**. Frozen holdout and prompts were not relaxed after observing failure.

| Candidate | Holdout | False completion | First download + five posts | Warm five posts | Server peak RSS |
| --- | --- | --- | --- | --- | --- |
| Qwen2.5 1.5B Q4_K_M | 0/20 | 0 (19 extraction errors) | 38.0 s | 13.8 s | 2,135,228 KiB |
| Qwen3 1.7B Q8_0 | 3/20 | 3 | 70.5 s | 21.3 s | 2,359,240 KiB |
| Lexical baseline | 19/20 | 0 | not applicable | not applicable | not applicable |

These are results of this exact extraction contract, prompt, quantization and 20-case holdout, not general model benchmarks. CPU latency fits the numeric budget, but the benchmark's successful-extraction condition fails too. The lexical baseline is a comparator, not an approved substitute for source-grounded inference.

The candidate models ran on standard GitHub Linux CPU runners with `-ngl 0 -t 4 -c 4096`. Downloaded bytes were checked against `config/models.lock.json` by the workflow at commit `151d96b`. The initial prepared report did not duplicate the digests; this run's evidence is traced through its fixed code and lock. Future reports include digests directly.

- [CPU evaluation run](https://github.com/kuil09/tibo-timer/actions/runs/34220225831)
- Full per-case results: `docs/evaluation/`
- Machine-readable selection: `docs/model-evaluation.json`

Observed errors include fabricated or rewritten evidence, interpreting "There is no schedule, only resets" as scheduled, and treating a future banked grant as completed. Invalid evidence is rejected before publication. A rejection is not silently counted as a correct unresolved answer.

## Collection and deployment

The same TypeScript collector fetched 26 original posts successfully from the local network at 2026-09-08T11:22:39Z. These originals are preserved in the repository and deployed to Pages with unresolved timing. Both Node fetch and curl from the GitHub runner receive HTTP 403 with `cf-mitigated: challenge` and a Cloudflare "Just a moment" HTML response.

- [First manual collection/deployment](https://github.com/kuil09/tibo-timer/actions/runs/34220246273): collection failed; Pages deployment succeeded.
- [Explicit Cloudflare diagnosis](https://github.com/kuil09/tibo-timer/actions/runs/34220614635): both HTTP clients blocked; last valid 26-record dataset deployed.

No challenge bypass, external proxy, paid source, or unapproved account was introduced. An upstream-approved machine-accessible feed or an API allow rule is required for unattended GitHub collection. The scheduled workflow remains configured and reports failure while serving the last good dataset; a local successful fetch is not evidence that GitHub collection works.

## Browser and deterministic checks

Tests cover schema and evidence validation, loopback-only inference, output truncation, source edits/history, duplicate processing, startup failure, budget carryover, UTC date boundaries and DST conflicts. Browser scenarios cover Seoul/Los Angeles/London, mobile overflow, literal HTML in source text, safe source links, date-only display, expired schedules and source-only observations. Static and fixture tests do not prove model accuracy or upstream availability.

The custom domain remains deferred. The final release report records the live Pages verification and scheduled-run outcome separately.
