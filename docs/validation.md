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

## Scheduled-run verification

The existing schedule produced [run 34221019718](https://github.com/kuil09/tibo-timer/actions/runs/34221019718) at 2026-09-08T11:30:07Z. Its collector logged `feed_http_403` at 11:30:34Z. Pages deployment succeeded and the last valid dataset was retained; the overall run failed deliberately in `Report stale upstream`. Because `continue-on-error` is used to allow preservation/deployment, the API's step conclusion alone can appear successful; the collector log and the final failure step establish the actual refresh outcome. No manual request was created to obtain this scheduled-run evidence.

The implementation, CPU comparison, manual deployment, scheduled execution and live browser checks are complete. Unattended feed acquisition is blocked by the upstream challenge, and CPU inference publication remains disabled because neither candidate passed the fixed quality gate.


## Collection pause and local publication (2026-09-08)

Remote collection was disabled before 11:50 UTC; no jobs were running at that point. Scheduled collection has been removed. Push and default manual publication now deploy stored data without a feed request. A thread follow-up is scheduled after 12:51 UTC for exactly one current-Node request (`diagnose-feed.yml`, `single=true`), followed by one local refresh and publication. Neither request retries on failure. A different runner can have a different IP, so recovery would not identify the cause. Local refresh is deferred until that point to keep the pause free of our feed requests. Automatic remote collection remains suspended regardless of that single result. The follow-up must record actual outcomes; none is claimed here.

Publication without upstream access succeeded: https://github.com/kuil09/tibo-timer/actions/runs/34222960550 . The fetch step was skipped. Production browser verification passed all nine scenarios, including one real-data smoke test and eight controlled UI fixtures. Phi CPU evaluation runs separately at https://github.com/kuil09/tibo-timer/actions/runs/34222964322 ; model download and server startup completed.

## Phi-4-mini-instruct CPU result

Run 34222964322 at e0a59b4 completed successfully as an evaluation job. Phi Q4_K_M passed the CPU speed/memory gate: cold preparation + startup + five posts 173.01 s, warm five posts 28.90 s, server peak RSS 4,329,948 KiB. Frozen holdout: 6/20 (30%), one false completion, one false time, two extraction errors. Development: 4/20. Automatic interpretation remains disabled. The model mistook an individual usage reply for a completion and a last-month retrospective for a new schedule; source-only publication is required. Raw result reports are in docs/evaluation/phi4mini-*.json.

## CPU cache verification

Run https://github.com/kuil09/tibo-timer/actions/runs/34223918223 (be10c4e) succeeded with `cache_check=true`, without repeating quality evaluation. Both runtime and model cache hits were true. After Actions restored the cache, verification/extraction took 2.32 s, server startup 3 s, first five posts 37.59 s, warm five posts 27.50 s, and no extraction errors occurred in those batches. The 42.91 s subtotal excludes Actions cache transfer time and is not a cold-download proof. `performance_passed=false` in this cached report deliberately prevents replacing the previously measured cold proof. The sanitized v2 cache was saved before inference; runtime unpacked binaries and process state are not retained in it. Latest Pages deployment 34223917381 succeeded. Automatic interpretation remains disabled due to the independent quality failure.
