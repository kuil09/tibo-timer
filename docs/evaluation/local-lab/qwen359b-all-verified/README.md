# All-claim first verification pass

See the adjacent qwen359b-loop/README.md for the bounded-loop design, combined results and limitations. This report reuses locked v3 initial results and performs 51 live independent verifier calls across 52 cases, bypassing one truncated source. First pass: 35 accepted correct results, zero accepted wrong results, 16 disagreements; exact correctness including uncertain outcomes is 38/52. Nine true completed events retain six. Four initial false completions become unresolved. All inputs and baseline hashes are preserved in report.json.
