# System card: Governed Analytics Copilot

## Intended use

Assist authorized analysts with read-only natural-language questions over the configured Olist analytics schema. Results are proposed by a local language model and executed through role-scoped PostgreSQL credentials after semantic retrieval and SQL validation. Sensitive/high-cost queries may require steward approval.

## Limitations and risks

- Supports only data represented in `backend/app/semantic/semantic.yaml`; it cannot answer unsupported business concepts or infer absent measures.
- Model quality depends on query phrasing, retrieval, schema metadata and local model behavior. Users must check SQL and results before relying on them.
- Small evaluation set (56 questions); four ablations were piloted on 19 questions only.
- Full model run took 19m04s; full-system p50/p95 were 17.8s/51.6s with cache enabled. Cache invalidates the configured p95 gate.
- The full system achieved 69.0% execution accuracy (95% bootstrap CI 55–81), 71.0% scalar answer correctness (55–87), 9.5% answer hallucination (2–19), 0.0% unauthorized exposure, and 100% attack blocking on this gold set.

## Acceptance criteria

Defaults from `eval/report.py`: zero cross-role leakage; 100% block on destructive and injection cases; hallucination rate below B0; p95 latency at most 90s with cache disabled; execution accuracy at least a pilot-selected `--min-acc`. Current evaluation passes the first two, fails hallucination-below-B0 (9.5% vs 7.1%), has invalid latency due to cache, and leaves the accuracy threshold pending. **Go/no-go: NO-GO pending remediation and a cache-disabled rerun.**

## Deployment decision

Research/demo use only. Do not treat outputs as audited financial reporting until the failed gates are addressed and the full evaluation is repeated with cache disabled and all variants on the full gold set.
