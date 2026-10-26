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

The evaluation harness freezes fingerprints for the gold set, semantic layer, prompt, model, and variants. It compares generated query results with reference SQL, tests refusal/security cases, measures latency and answer grounding, and bootstraps 95% confidence intervals with 2,000 samples (seed 7). The gold set has 42 answerable and 15 adversarial questions, so confidence intervals are wide. Leakage precautions: `eval/gold.jsonl` was left unchanged; the prompt examples are generic, use different tables and phrasing, and do not reproduce evaluation questions; model prompts are built from the user's question and role-filtered semantic context. **TODO:** document dataset provenance, hardware, exact environment versions, and a reproducibility procedure.

## Experiments and results

V1 before evidence and its source runs are summarized in `results/RESULTS.md`. V1 full runs used caching; their latency is invalid for acceptance. V2's new prompt fingerprint is frozen, but the required full, b1, and answer-writer runs could not be performed because PostgreSQL at localhost:5432 and Ollama at localhost:11434 were unreachable and Docker Desktop access was denied. No v2 accuracy, correctness, grounding, security, or latency number is available. Do not compare v1 and v2 as if both had been measured.

## Limitations

The small gold set produces broad uncertainty. Four ablations are pilot-only; no model comparison or load test was run. The CPU-only 3B model can be slow. V1 did not beat B0 on hallucination rate, and its cache-enabled latency is invalid. No execution-accuracy threshold was selected. The Docker backend image was not fully verified. MLflow and DVC are not used. **TODO:** restore PostgreSQL and Ollama, run the frozen v2 protocol with cache disabled and a predeclared accuracy threshold, and analyze the actual result files. Do not fill v2 result gaps with estimates.

## Conclusion

The prototype demonstrates layered query governance and achieved zero measured cross-role exposure and complete blocking of the evaluated attack cases. Its measured execution accuracy and latency do not yet meet a deployment-ready evidentiary standard. **TODO:** incorporate literature review, rerun acceptance experiments, and write the final conclusion after reviewing those results.

## TODO before submission

- Literature review: find and verify sources on text-to-SQL evaluation, retrieval for structured data, SQL validation and least privilege, human approval, answer grounding, and prompt injection.
- Replace this draft with the final report structure and institution-specific formatting.
- Add hardware/environment details, contribution statement, and reproducibility notes.
- Explain measured gates and planned remediation with adviser feedback after v2 runs finish.
