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

## LFM2.5-1.2B-Instruct replacement

The active CPU candidate is official LiquidAI Q4_K_M (730,895,168 bytes), revision 6767265158422fb8a19c62ceb45f16f05363615b. Evaluation https://github.com/kuil09/tibo-timer/actions/runs/34224382560 at d7ef843 preserved the existing prompt, schema, sampling parameters and cases. Development 4/20; existing fixed evaluation 3/20, zero false completions, one false time, nine extraction errors. These previously viewed cases are comparison/regression evidence, not a new unseen release holdout. The combined model/prompt/schema failed; this does not isolate intrinsic model quality.

Verified cold preparation 201.96 s, model startup 1 s, first five posts 25.88 s, warm five posts 25.62 s, server peak RSS 1,354,556 KiB. Both five-post batches had three extraction errors, so the performance gate also failed despite latency fitting the limits. Verified model artifacts were cached before inference. Source-only publication remains enabled and automatic interpretation disabled. Prior model locks/results remain as history.

## Extraction redesign v2 / v2.1

Source spans are now deterministic candidates. The model selects type/state/sentence ID/time ID; code restores untouched evidence and time qualifiers, rejects mismatched IDs, and leaves audience empty. Raw output and parsed selections are retained even after validation failures. Production sync writes a diagnostic artifact; evaluation captures the same diagnostics. Tests cover source membership, cross-sentence mismatch, nonexistent IDs, truncated output, fallback scoring and qualifier preservation. 45 tests and build passed.

V2 regression run https://github.com/kuil09/tibo-timer/actions/runs/34225682429 at 64c9667: dev6/20, errors4; existing holdout3/20, errors6, false completion1, false time0. All times unresolved: this was not a successful extractor. The raw outputs revealed an unknown-state bias. V2.1 adds balanced examples and separates missing time from unknown state. Development-only run https://github.com/kuil09/tibo-timer/actions/runs/34226291109 at e66fed7: dev9/20, errors2, false completion/time0, unresolved15. Same v2 scoring allows the dev6-to9 comparison; old v1 accuracy is not directly comparable. V2.1 did not rerun holdout. Model and runtime caches hit.

Publication remains disabled. Remaining failures include wrong reset type, wrong supporting sentence, missing time selection, and negative/conditional classification. Source-copy failures are structurally removed, but semantic reliability is not established. A fresh unseen acceptance set and passing quality evidence are required before automatic interpretation. Prior summary docs/model-evaluation.json refers to the pre-redesign comparison; current detailed reports reside under docs/evaluation/lfm-v2 and lfm-v21.

## Local experiment loop

Prepared official b10856 macOS arm64 runtime and exactly the same LFM Q4_K_M SHA256 as Actions. Kept one CPU server loaded with four threads and GPU offload zero. Tested six development cases with/without JSON Schema, single-message layout, compact input plus a shorter prompt, a brief explanation field, and prompt-state caching disabled. None established improvement over current selection prompt. Disabling prompt caching reproduced the same six selections, so that experiment did not support a prompt-cache explanation. Template inspection showed a user-message loop; no evidence of missing user content was found. Brief direct-question controls showed some correct comprehension, but did not establish reliable reset classification.

A full local v2.1 development run completed in 25.92 s: 9/20, one selection error, zero false completion/time; CPU platform differs from Actions (which had two selection errors). No new holdout was inspected. Existing production prompt is retained rather than replacing it with an unproven variant. The local lab supports draft prompt files and reports raw requests/outputs, so future iteration needs no push or Actions dispatch. No workflow dispatch or push occurred during these local experiments.

## One-hour pause follow-up (2026-09-08)

Exactly one current-Node request ran at 12:51:57 UTC after collection had been stopped before 11:50 UTC. https://github.com/kuil09/tibo-timer/actions/runs/34228505081 : HTTP403, Content-Type text/html; charset=UTF-8, cf-mitigated challenge, body began with HTML titled Just a moment, valid_feed=false. No retry or second remote request occurred. This does not establish permanent blocking or identify the trigger; a different runner/IP is also a confound.

One local collection succeeded at 12:52:32.391 UTC and preserved 26 records with last_error=null. Data-only commit f7320bc triggered https://github.com/kuil09/tibo-timer/actions/runs/34228610625 . Local prompt-lab work was excluded from the commit. Remote collection schedules remain absent; this is a local refresh, not recovery of remote automatic collection.

Pages run 34228610625 succeeded with the fetch step skipped. The public /tibo-timer/events.json returned HTTP200, 26 records, last_success_at=2026-09-08T12:52:32.391Z and collection.last_error=null. The first verification mistakenly requested /data/events.json (HTML/404); the actual build path was inspected and corrected. No additional upstream request was involved. The one-shot heartbeat was paused after verification. This documentation remains local with the unpublished prompt-lab changes.

## Larger LFM local CPU comparison

LiquidAI/LFM2-2.6B-Exp-GGUF Q4_K_M (revision 7d9bef941a2642e1d00967564fd55e1dcecf0d6a, SHA256 95b9322dc81f577be1d966f508bc2fa3ec2cda56a556347d3cdf71cfefaba591) was verified and run locally with b10856, four CPU threads, GPU offload zero, context4096, prompt cache disabled. Production prompt v2.1, schema and greedy sampling were unchanged. Development-only result: 10/20 operational, 9/19 invoked classifications correct, four selection-validation errors, zero published false completion/time, 55.45 seconds excluding download/load. LFM2.5-1.2B local baseline:9/20, one error,25.92seconds. This is one extra correct case at roughly2.14x processing time, not evidence of a reliable upgrade. Different size/checkpoint training are jointly changed; this does not isolate parameter count. No holdout, push, or Actions run occurred. Official recommended stochastic sampling was not evaluated.

## User-supplied prompt experiment

The user-supplied English prompt was evaluated unchanged in meaning (Markdown underscore escapes rendered normally), with the same LFM2-2.6B-Exp Q4_K_M CPU server, v2 scoring and 20 development cases. Only the system prompt and matching token count input were replaced; no production instruction edit or push occurred. Result:10/20 operational,9/19 classification,one cross-sentence selection error,zero published false completion/time,99.10seconds. Prior prompt:10/20,4 selection errors,55.45seconds. The same ten cases pass. Type/state/time selection for the banked grant improved to banked_reset/scheduled/t1, but sentence_id=s0 mismatched t1's source sentence. Negation becomes unknown/unknown instead of a future claim but still misses the expected reset/unknown taxonomy. Completed and conditional statements remain misclassified. Detailed raw outputs and exact prompt hash are preserved under docs/evaluation/local-lab/user-prompt.

## Whole-post experiment

Removed sentence splitting and sentence_id from the model input/output. Scanned exact time spans directly across the original post and retained the full source as evidence. Used the user prompt with only sentence-selection requirements adapted, same LFM2-2.6B-Exp Q4_K_M CPU model and sampling. Development20 result:11/20, zero validation errors, zero published false completion/time,88.35seconds. Compared to sentence-based user prompt10/20/errors1/99.10seconds, exactly the cross-sentence banked grant case became correct (banked_reset/scheduled/t1). No previously correct case regressed. The other nine failures remain; this is development evidence and not release approval. No push or Actions run. Raw report and prompt:docs/evaluation/local-lab/whole-post/.

## Two-stage claims experiment

Implemented an experimental local path: whole-post claim/kind classification, then delivery-time selection only for scheduled claims with candidates. Frozen new gold mapping retains old development labels and reasons; original cases unchanged. LFM2-2.6B-Exp Q4_K_M, b10856 Mac ARM CPU4/ngl0, same greedy decoding. Minimal pairs20:11 correct,12 class-correct,0 schema/selection errors,7 false scheduled,1 false completed,4 false normalized times,48.42s (20 claim+12 time calls). Reviewed development20:11 correct,3 inconsistent claim/kind errors,4 false scheduled,0 false completed/normalized time,45.50s (19 claim+10 time calls; one truncated bypass). These scores use a changed taxonomy and cannot be directly compared with prior11/20.

Failure localization: negative/conditional/questions can still enter the scheduled branch; the second stage can then faithfully normalize a time from a non-announcement, as seen in minimal pairs. No first-stage quality gate passed. Production remains on the disabled inference/source-only path; experimental two-stage modules are not connected to publication. Tests50 passed. No push or Actions run. Reports:docs/evaluation/local-lab/two-stage.

## EXAONE 3.5 2.4B Q8_0 local experiment

Official model hash and chat template verified; official system sentence prepended in both stages. CPU 4 threads, no GPU. Minimal pairs: 12/20 in 37.54 s; existing development: 13/20 in 37.05 s. Eight inconsistent claim/kind errors and eight raw false-scheduled results across the two sets prevent promotion. See `evaluation/local-lab/exaone35/README.md`. Fifty tests and TypeScript checks pass. No GitHub Actions runs or publication in this experiment.

## Qwen3.5-9B Q4_K_M local experiment

Pinned Unsloth GGUF, verified SHA-256, explicit non-thinking CPU execution. Existing 40 cases: 34/40 (pairs 18/20, development 16/20), 277.51 seconds total. Three false completions and three inconsistent claim/kind results prevent promotion. See `evaluation/local-lab/qwen359b/README.md`. No publication or Actions runs.

## Qwen claim refinement v3

Combined-label v2 regressed to 13/20 pairs and was rejected. V3 preserves fields with constrained combinations and short tense rules: 36/40 existing cases versus 34/40 before; 11/12 fresh independently authored controlled cases. Validation contradictions eliminated, but three existing and one fresh false completions remain. Local-only experimental branch, no publication. See `evaluation/local-lab/qwen359b-v3/README.md`.

## Completion verification

Locked v3 baseline replay across 52 cases plus 13 live independent verification calls: false completions 4 to 0, true completions 9/9 retained, exact correctness unchanged at 47/52 because four false completions become unresolved. Added wall time 79.79 s. Separate single-case full live integration recorded. 56 tests and type checks pass; no publication. See `evaluation/local-lab/qwen359b-verified/README.md`.

## All-claim verification and three-attempt loop

User requested verification for every non-truncated claim and at most three total inference/verification attempts. Implemented and tested on locked 52-case first-stage results: 51 live verifier calls; 16 disagreements then received 70 live retry calls. 35 agreements plus one truncation bypass stop at attempt one; all 16 others exhaust three attempts, with no recoveries. Exact correctness 38/52, false completed/scheduled 0/0, accepted wrong 0. Sixty tests, type check and build pass. See `evaluation/local-lab/qwen359b-loop/README.md`. Automatic interpretation remains unapproved.
