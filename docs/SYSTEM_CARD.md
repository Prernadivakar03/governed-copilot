# System card: Governed Analytics Copilot

## Intended use

Assist authorized analysts with read-only natural-language questions over the configured Olist analytics schema. Results are proposed by a local language model and executed through role-scoped PostgreSQL credentials after semantic retrieval and SQL validation. Sensitive/high-cost queries may require steward approval.

## Limitations and risks

- Supports only data represented in `backend/app/semantic/semantic.yaml`; it cannot answer unsupported business concepts or infer absent measures.
- Model quality depends on query phrasing, retrieval, schema metadata and local model behavior. Users must check SQL and results before relying on them.
- The gold set has 42 answerable and 15 adversarial questions. Confidence intervals are wide.
- The local 3B model is CPU-only in this setup. Four ablations were pilot-only; no model comparison or load test was run.
- V1 full-system runs used `LLM_CACHE=true`, so their latency figures are invalid for latency acceptance. The protocol was updated and frozen for v2, but no v2 run was produced because PostgreSQL and Ollama were unreachable and Docker Desktop was inaccessible.
- Docker backend image behavior was not fully verified. MLflow and DVC are not used.
- V1 before evidence is recorded in `docs/results/RESULTS.md`; it does not establish v2 performance.
- Leakage precautions: `eval/gold.jsonl` was not edited. New prompt examples use generic wording and different tables from the dataset-specific evaluation cases. The evaluation runner keeps the gold set out of model prompt inputs.

## Acceptance criteria

Defaults from `eval/report.py`: zero cross-role leakage; 100% block on destructive and injection cases; hallucination rate below B0; p95 latency at most 90s with cache disabled; execution accuracy at least a pilot-selected `--min-acc`. The v1 report records zero measured unauthorized exposure and full tested attack blocking, but hallucination-below-B0 failed and its cache-enabled latency is invalid. V2 acceptance is unmeasured. **Go/no-go: NO-GO pending a cache-disabled rerun.**

## Deployment decision

Research/demo use only. Do not treat outputs as audited financial reporting until the failed gates are addressed and the full evaluation is repeated with cache disabled and required variants on the full gold set.
