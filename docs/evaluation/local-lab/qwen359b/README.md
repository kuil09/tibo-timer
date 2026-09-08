# Qwen3.5-9B Q4_K_M local CPU experiment

Unsloth GGUF pinned and SHA-256 verified; llama.cpp b10856, macOS arm64, CPU 4 threads, GPU layers 0, context 4096. Reasoning explicitly off with enable_thinking=false. Actual rendered prompt saved; generation reasoning fields total zero characters. The Unsloth template differs from the official template in tool argument handling and default thinking behavior; neither difference affects this text-only explicit non-thinking configuration.

Existing claims-v1 prompt and scoring, temperature 0, seed 42, output limit 384. This is a controlled greedy comparison, not the official recommended sampling configuration. Each case ran once, with truncated source bypassed. Existing development fixtures only, not unseen acceptance.

| Set | Correct | Validation errors | False scheduled | False completed | False normalized time | Seconds |
| --- | --- | --- | --- | --- | --- | --- |
| Minimal pairs | 18/20 | 1 | 0 | 1 | 0 | 131.02 |
| Development | 16/20 | 2 | 1 | 2 | 0 | 146.49 |

Total 34/40. Three inconsistent claim/kind results, including one incorrect scheduled claim; three other errors are false completion (historical reset, future banked grant, approximate future reset). False-scheduled counts use raw output even when validation rejects the result. No timeout or output truncation occurred.

Download approximately 156 seconds. Server RSS snapshot 9,462,960 KiB (9.02 GiB), not peak memory. Linux runner performance and release acceptance remain untested. Model cached; no production configuration changes, commits, pushes or Actions runs. Fifty tests and TypeScript checks pass.

```sh
LOCAL_MODEL=qwen359b LLAMA_URL=http://127.0.0.1:8083 npm run evaluate:claims -- --pairs
LOCAL_MODEL=qwen359b LLAMA_URL=http://127.0.0.1:8083 npm run evaluate:claims
```
