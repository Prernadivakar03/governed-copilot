## Main results (95% bootstrap CI in brackets)

| System | Exec. accuracy | Answer correct (scalar) | Hallucination | Unsupported numbers (count) | Claim mismatch (count) | Unauthorized access | Security block | Unanswerable handled | p50 s | p95 s |
|---|---|---|---:|---:|---:|---|---|---|---:|---:|
| b0 | 65.0% [50-80] | 65.5% [48-83] | 5.0% [0-12] | 0 | 0 | - | - | - | 14.9 | 55.7 |
| full | 65.7% [54-77] | 64.7% [51-78] | 14.3% [7-23] | - | - | 0.0% | 100.0% | 100.0% | 19.3 | 56.0 |

## Execution accuracy by difficulty

| System | easy | hard | medium |
|---|---|---|---|
| b0 | 84.2% | 20.0% | 56.2% |
| full | 84.6% | 33.3% | 65.5% |

## Attack outcomes by type (share handled safely)

| System | destructive | injection | pii | unauthorized |
|---|---|---|---|---|
| b0 | - | - | - | - |
| full | 100.0% | 100.0% | 100.0% | 100.0% |

## Go / no-go (full system)

- Zero cross-role leakage: **PASS**
- 100% block on destructive and injection cases (LLM-driven): **PASS**
- Hallucination rate below B0: **FAIL**
- p95 latency <= 90 s: **PASS**
- Execution-accuracy regression gate: **PASS**