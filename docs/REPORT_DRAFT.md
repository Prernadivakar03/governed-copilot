# Governed Analytics Copilot — report draft

## Introduction

Natural-language analytics can shorten the path from business question to database query, but generated SQL creates risks around correctness, privacy, and unauthorized actions. This capstone implements a governed analytics copilot for the Olist dataset. **TODO:** add the final problem statement, research question, and institutional context.

## Related work

**TODO: complete with real papers and verified bibliographic details.** Topics to review:

- Text-to-SQL evaluation and benchmark limitations.
- Retrieval-augmented generation for structured data.
- SQL AST validation and database least privilege.
- Human approval workflows for AI-assisted analytics.
- Grounding and factuality checks for generated answers.
- Prompt injection and tool-use security.

No citations are supplied here because sources have not yet been researched and verified.

## Architecture

The React client calls a FastAPI service. The service filters semantic metadata by database role, retrieves schema and metric context, asks a local Ollama model to generate SQL, validates the SQL AST, applies a policy gate, and executes permitted queries with read-only credentials. Steward approval is required for policy-triggering queries; approval execution revalidates. Audit events are hash chained. See `SYSTEM_CARD.md`, `THREAT_MODEL.md`, and `diagrams/`.

## Method

The evaluation harness freezes fingerprints for the gold set, semantic layer, prompt, model, and variants. It compares generated query results with reference SQL, tests refusal/security cases, measures latency and answer grounding, and bootstraps 95% confidence intervals with 2,000 samples (seed 7). **TODO:** document dataset provenance, hardware, exact environment versions, and a reproducibility procedure.

## Experiments and results

The initial full pilot sampled 19 questions and took 2m38.8s. The full-system full-set run reported 69.0% execution accuracy (95% CI 55–81), 71.0% scalar correctness (55–87), 9.5% answer hallucination (2–19), 0.0% unauthorized exposure, 100.0% attack blocking, p50 17.8s and p95 51.6s. The full run elapsed 19m04s with caching enabled. Full-set b0 and b1 runs used `--no-answer`; their execution accuracies were 64.3% and 69.0%. Four ablations were pilot-only (19 cases each). Full table, ablation values, commands and gate outcomes are in `results/RESULTS.md`.

## Limitations

The small gold set produces broad uncertainty. Four ablations are sampled only; full comparisons are not available. The full system did not beat B0 on hallucination rate. Latency acceptance is invalid because caching was enabled, and no execution-accuracy threshold was selected. **TODO:** run all seven variants on the full set with a cache-disabled latency configuration and a predeclared accuracy threshold. Local CPU/model latency is substantial.

## Conclusion

The prototype demonstrates layered query governance and achieved zero measured cross-role exposure and complete blocking of the evaluated attack cases. Its measured execution accuracy and latency do not yet meet a deployment-ready evidentiary standard. **TODO:** incorporate literature review, rerun acceptance experiments, and write the final conclusion after reviewing those results.

## TODO before submission

- Replace this draft with the final report structure and institution-specific formatting.
- Add verified citations and compare against relevant systems.
- Add hardware/environment details, contribution statement, and reproducibility notes.
- Explain failed gates and planned remediation with adviser feedback.
