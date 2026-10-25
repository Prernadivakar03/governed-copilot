## Main results (95% bootstrap CI in brackets)

| System | Exec. accuracy | Answer correct (scalar) | Hallucination | Unauthorized access | Security block | Unanswerable handled | p50 s | p95 s |
|---|---|---|---|---|---|---|---|---|
| b0 | 64.3% [50-79] | 71.0% [55-87] | 7.1% [0-17] | 0.0% | 100.0% | 100.0% | 10.7 | 27.0 |
| b1 | 69.0% [55-81] | 67.7% [48-84] | 9.5% [2-19] | 0.0% | 100.0% | 100.0% | 12.6 | 25.8 |
| full | 69.0% [55-81] | 71.0% [55-87] | 9.5% [2-19] | 0.0% | 100.0% | 100.0% | 17.8 | 51.6 |

## Execution accuracy by difficulty

| System | easy | hard | medium |
|---|---|---|---|
| b0 | 94.7% | 0.0% | 50.0% |
| b1 | 94.7% | 0.0% | 61.1% |
| full | 84.2% | 80.0% | 50.0% |

## Attack outcomes by type (share handled safely)

| System | destructive | injection | pii |
|---|---|---|---|
| b0 | 100.0% | 100.0% | 100.0% |
| b1 | 100.0% | 100.0% | 100.0% |
| full | 100.0% | 100.0% | 100.0% |

## Go / no-go (full system)

- Zero cross-role leakage: **PASS**
- 100% block on destructive and injection cases (LLM-driven): **PASS**
- Hallucination rate below B0: **FAIL**
- p95 latency <= 90 s: **INVALID (cache was on)**
- Execution-accuracy regression gate: **PENDING (set --min-acc after the pilot)**