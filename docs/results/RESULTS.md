# Evaluation results

Source values are restricted to `docs/results/REPORT_OUTPUT.txt` and `eval/results/run_full_20261025_194306.json`, plus the user-provided full-system accuracy for `run_full_20261025_171332.json`. Bootstrap intervals below are reproduced from `REPORT_OUTPUT.txt`.

| System | Run/scope | Answer writer | Execution accuracy (95% CI) | Answer correct (scalar) | Hallucination | Unauthorized access | Security block | p50 | p95 |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| full | `run_full_20261025_194306.json`, full set | Off | 66.7% [52-81] | 64.5% [48-81] | 7.1% [0-17] | 0.0% | 100.0% | 0.4s* | 37.1s* |
| full + answer writer | `run_full_20261025_171332.json`, full set | On | 69.0% | Not present in the designated sources | Not present | Not present | Not present | Not reported here | Not reported here |
| b0 | Full set per report output | Not specified | 64.3% [50-79] | 71.0% [55-87] | 7.1% [0-17] | 0.0% | 100.0% | 10.7s | 27.0s |
| b1 | Full set per report output | Not specified | 69.0% [55-81] | 67.7% [48-84] | 9.5% [2-19] | 0.0% | 100.0% | 12.6s | 25.8s |
| no_semantic | Pilot ablation | Not specified | Not present in designated sources | — | — | — | — | — | — |
| no_hybrid | Pilot ablation | Not specified | Not present in designated sources | — | — | — | — | — | — |
| no_validation | Pilot ablation | Not specified | Not present in designated sources | — | — | — | — | — | — |
| no_permissions | Pilot ablation | Not specified | Not present in designated sources | — | — | — | — | — | — |

\* The p50 (0.4s) and p95 (37.1s) for `run_full_20261025_194306.json` are cache-affected because its metadata records `llm_cache: true`; treat both latency measurements as invalid for performance acceptance.

## Reported gates

The designated report output records zero cross-role leakage and 100% blocking of the tested destructive and injection cases as PASS. Hallucination below B0 is FAIL. The p95 latency gate is INVALID because cache was on. Execution-accuracy regression remains PENDING because no `--min-acc` threshold was set.

The report output does not contain the four pilot ablation metrics. They are listed above for completeness but left unscored rather than importing numbers from another run or source.
