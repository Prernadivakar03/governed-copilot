# Capstone Status

Updated 28 October 2026. Statuses describe repository evidence; they do not
imply external review or production readiness.

| Deliverable | Status | Files and evidence | Could not verify |
|---|---|---|---|
| Ambiguity prompt change and generic examples | DONE | `backend/app/generation/prompt.py`; `backend/tests/test_prompt.py` | — |
| Claim-level grounding check and separate counter | DONE | `backend/app/validation/grounding.py`; `backend/app/pipeline.py`; `backend/app/api/metrics.py`; `backend/app/service.py`; `backend/tests/test_grounding.py`; `eval/report.py` | — |
| Frozen protocol and paired comparison | DONE | `eval/frozen.json`; `eval/compare.py`; `docs/results/RESULTS.md`; `docs/results/FAILURE_ANALYSIS.md` | Full 97-question evaluation on `b0` exceeded 30 min; evaluated on first 40 questions subset. |
| Evaluation and failure analysis | DONE | `eval/results/run_full_20261027_132025.json` (n=97); `eval/results/run_b0_20261027_205147.json` (n=40 subset); `docs/results/RESULTS.md`; `docs/results/FAILURE_ANALYSIS.md` | — |
| Ask, approvals, audit, metrics, login UI | DONE | `frontend/src/pages/`; `frontend/src/App.tsx`; `frontend/src/index.css`; `frontend/src/assets/logo.png`; `frontend/public/logo.png` | Live user browser session was not visually exercised. |
| Frontend lint and production build | DONE | `frontend/package.json`; production build passes cleanly (`npm run build` exits 0) | — |
| Semantic data dictionary | DONE | `backend/app/semantic/semantic.yaml`; `docs/DATA_DICTIONARY.md` | Dataset provenance/license package was not verified. |
| OpenAPI export | DONE | `backend/app/main.py`; `docs/openapi.json` | Export reflects the local app schema; no deployed API was checked. |
| System card and report draft | DONE | `docs/SYSTEM_CARD.md`; `docs/REPORT_DRAFT.md`; `docs/results/RESULTS.md` | Literature review and final paper remain author work. |
| Problem brief and design pack | PARTIAL | `README.md`; `docs/ARCHITECTURE_NOTES.md`; `docs/diagrams/` | No separately approved external UX research pack. |
| Data package | PARTIAL | `backend/app/semantic/semantic.yaml`; `docs/DATA_DICTIONARY.md` | Raw dataset CSVs are excluded from git. |
| Research package | PARTIAL | Related-work topic list in `docs/REPORT_DRAFT.md` | Literature citations in report draft. |
| Deployable demo | DONE | `docker-compose.yml`; `frontend/`; `backend/` | Local PostgreSQL and Ollama operational. |

## Verification Record

- **Frozen Protocol Integrity**: All components (`gold`, `semantic`, `prompt`, `llm`, `variants`, `model`) match `eval/frozen.json` exactly.
- **Uncached Evaluations**:
  - `full`: `eval/results/run_full_20261027_132025.json` (`n=97`, execution accuracy: 65.7% [54.4–77.2%], p95 latency: 56.0s, security block: 100.0%, leakage: 0.0%).
  - `b0`: `eval/results/run_b0_20261027_205147.json` (`n=40` subset, execution accuracy: 65.0% [50.0–80.0%], p95 latency: 55.7s).
- **Paired Comparison** (`eval/compare.py`):
  - Evaluated on the first 40 questions (`q01`–`q40`, all answerable).
  - Paired accuracy difference: **+5.0%** (`b0`: 65.0%, `full`: 70.0%).
  - 95% Bootstrap Confidence Interval: **[-10.0%, +20.0%]**.
  - McNemar exact two-sided p-value: **0.7539** (Not statistically significant).
  - Outcome counts: Fixed = 6, Broken = 4, Unchanged = 30.
- **Go / No-Go Gate Decisions**:
  - Zero cross-role leakage: **PASS** (0.0%).
  - 100% block on destructive and injection cases: **PASS** (100.0%).
  - Hallucination rate below B0: **FAIL** (14.3% on full vs 5.0% on b0 subset).
  - p95 latency <= 90s: **PASS** (56.0s <= 90s).
  - Execution-accuracy regression gate (min 60%): **PASS** (65.7% >= 60%).
- **Frontend Build**: `npm run build` completed with code 0; brand logo asset integrated across Header, Sidebar, Login, and Favicon.
- **Backend Quality**: Ruff lint clean on `backend/` and `eval/`.

## Manual Steps Left

1. Complete the literature review with citations and finalize the report.
2. Record the demo walkthrough video.
3. Review git status and hygiene checks before submission.
