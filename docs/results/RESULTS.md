# Evaluation results

Protocol frozen with `python eval\freeze.py` (gold fingerprint `18ffe3d3db393425`; model `qwen2.5-coder:3b`). The pilot used `full --pilot --no-answer` and took **2m38.8s**. Its 19 cases yielded 71.4% execution accuracy and 0.0% cross-role exposure. Based on that initial timing, the planned route was all seven full-set variants.

Observed runtime changed the plan: the full `full` run took **19m04s** with answer writing enabled; `b0` full set took **13m25.7s**, and `b1` full set took **15m06.4s**, both with `--no-answer`. Therefore all seven variants were not run on the full set. The remaining four were run as pilots, each with `--no-answer`. This is a deadline-driven deviation and limits cross-variant conclusions.

## Main results (95% bootstrap CI in brackets)

| System | Exec. accuracy | Answer correct (scalar) | Hallucination | Unauthorized access | Security block | Unanswerable handled | p50 s | p95 s |
|---|---|---|---|---|---|---|---:|---:|
| b0 (full set, no answer writer) | 64.3% [50-79] | 71.0% [55-87] | 7.1% [0-17] | 0.0% | 100.0% | 100.0% | 10.7 | 27.0 |
| b1 (full set, no answer writer) | 69.0% [55-81] | 67.7% [48-84] | 9.5% [2-19] | 0.0% | 100.0% | 100.0% | 12.6 | 25.8 |
| full (full set, answer writer enabled) | 69.0% [55-81] | 71.0% [55-87] | 9.5% [2-19] | 0.0% | 100.0% | 100.0% | 17.8 | 51.6 |

The CI values above are from 2,000 bootstrap resamples with seed 7. For the two baselines answer generation was disabled; scalar correctness still scores the harness's deterministic answer against numeric references. The answer-writing hallucination metric is not directly comparable across those settings.

## Pilot ablations (19 sampled cases each; no answer writer)

| System | Exec. accuracy | Hallucination | Unauthorized access | Security block | p50 s |
|---|---:|---:|---:|---:|---:|
| no_semantic | 57.1% | 7.1% | 0.0% | 100.0% | 0.4 |
| no_hybrid | 71.4% | 7.1% | 0.0% | 100.0% | 15.0 |
| no_validation | 71.4% | 7.1% | 0.0% | 100.0% | 0.4 |
| no_permissions | 71.4% | 0.0% | 0.0% | 100.0% | 15.0 |

Pilot values are descriptive only; the sampled set is too small for robust comparisons. The report go/no-go defaults (minimum accuracy unset, p95 limit 90 seconds) mark the full system's latency **INVALID** because `LLM_CACHE=true`, and accuracy regression **PENDING** because no `--min-acc` threshold was set. Hallucination was not lower than b0 (9.5% vs 7.1%), so that gate failed.

## Commands and logs

All commands were run serially from the repository root using `backend/.venv/Scripts/python.exe` and `PYTHONPATH=backend`.

```powershell
python eval\freeze.py
python eval\run_eval.py full --pilot --no-answer
python eval\run_eval.py full
python eval\run_eval.py b0 --no-answer
python eval\run_eval.py b1 --no-answer
python eval\run_eval.py no_semantic --pilot --no-answer
python eval\run_eval.py no_hybrid --pilot --no-answer
python eval\run_eval.py no_validation --pilot --no-answer
python eval\run_eval.py no_permissions --pilot --no-answer
python eval\report.py eval\results\run_full_20261025_171332.json eval\results\run_b0_20261025_172744.json eval\results\run_b1_20261025_174330.json
```

Per-run console logs and elapsed times are in `eval/results/logs/`; JSON results and frozen protocol are alongside them. No eval command failed or timed out.
