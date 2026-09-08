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

## Published browser check

At the deployed `/tibo-timer/` URL, all 9 Playwright scenarios passed. Eight use controlled JSON fixtures over the real deployed frontend; the live-data smoke scenario reads the actual 26-record public document and checks source links and console errors. The publication includes immediate collection failure status as well as the last successful check time. Unit/integration checks: 36 passed; TypeScript and static build passed.

[Pages deployment with collection-health UI](https://github.com/kuil09/tibo-timer/actions/runs/34220940737) deployed successfully; the overall workflow correctly reports the upstream collection failure. The extra diagnostic curl request was removed after capturing the challenge response, so routine runs make only the collector request.

## Bounded same-runner HTTP comparison

[Diagnosis run 34221287228](https://github.com/kuil09/tibo-timer/actions/runs/34221287228), 2026-09-08T11:33:27Z, runner `GitHub Actions 1000010963`, Node v22.23.2:

| Probe | HTTP | Content-Type | cf-mitigated | Valid feed |
| --- | --- | --- | --- | --- |
| Current Node fetch | 403 | text/html; charset=UTF-8 | challenge | no |
| curl, same application-specified headers | 403 | text/html; charset=UTF-8 | challenge | no |
| Node, application/json + generic browser User-Agent | 403 | text/html; charset=UTF-8 | challenge | no |

All three bodies began with HTML containing `<title>Just a moment...</title>`. The current collector already requests `Accept: application/json`; the third probe changes only the explicit User-Agent. Client-added transport headers and HTTP/TLS fingerprints remain client-dependent. This experiment does **not** identify IP reputation as the cause, nor exhaust every possible browser/client characteristic. It establishes that these bounded header/client combinations do not solve access from this runner.

Exactly three requests were issued. No successful combination existed, so no confirmation request was made. No further diagnostic retries, IP changes, browser-cookie copying or challenge-solving were attempted. The normal collector headers were not changed based on unsuccessful evidence. Machine-readable headers, excerpts, timestamps and schema decisions are preserved in `docs/feed-diagnosis.json`.

Upstream-approved automated API access is required to unblock unattended collection under the project's constraints. Collection failure remains visible and the last valid dataset remains preserved. Successful Pages deployment and successful diagnostic execution are **not** successful automatic collection.
