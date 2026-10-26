# Capstone status

Updated 26 October 2026. Statuses describe repository evidence; they do not
imply external review or production readiness.

| Deliverable | Status | Files and evidence | Could not verify |
|---|---|---|---|
| Ambiguity prompt change and generic examples | DONE | `backend/app/generation/prompt.py`; `backend/tests/test_prompt.py` | Full backend suite did not complete. |
| Claim-level grounding check and separate counter | DONE | `backend/app/validation/grounding.py`; `backend/app/pipeline.py`; `backend/app/api/metrics.py`; `backend/app/service.py`; `backend/tests/test_grounding.py`; `eval/report.py` | No v2 answer-writer run to measure its effect. |
| Frozen v2 protocol and paired comparison | PARTIAL | `eval/frozen.json`; `eval/compare.py`; `docs/results/RESULTS.md` | No v2 full, b1, or answer-writer result files. |
| Evaluation and failure analysis | PARTIAL | `eval/results/` (v1 before evidence); `docs/results/RESULTS.md`; `docs/results/FAILURE_ANALYSIS.md` | PostgreSQL and Ollama endpoints were unreachable; Docker Desktop engine access was denied. V2 rates, paired CI, and real v2 failure examples are unavailable. |
| Ask, approvals, audit, metrics, login UI | DONE | `frontend/src/pages/`; `frontend/src/App.tsx`; `frontend/src/index.css`; `frontend/public/governed-mark.svg` | Live API flow and 375px layout were not visually exercised. |
| Frontend lint and production build | DONE | `frontend/package.json`; no new dependencies | Lint passes with two Fast Refresh warnings in `auth.tsx` and `App.tsx`. |
| Semantic data dictionary | DONE | `backend/app/semantic/semantic.yaml`; `docs/DATA_DICTIONARY.md` | Dataset provenance/license package was not verified. |
| OpenAPI export | DONE | `backend/app/main.py`; `docs/openapi.json` | Export reflects the local app schema; no deployed API was checked. |
| System card and report draft | PARTIAL | `docs/SYSTEM_CARD.md`; `docs/REPORT_DRAFT.md` | V2 result claims await the uncached runs. Literature review and final report remain author work. |
| Problem brief and design pack | PARTIAL | `README.md`; `docs/ARCHITECTURE_NOTES.md`; `docs/diagrams/` | No separately approved brief, rubric, or UX research pack. |
| Data package | PARTIAL | `backend/app/semantic/semantic.yaml`; `docs/DATA_DICTIONARY.md` | Dataset files are not committed; provenance and license are not verified. |
| Research package | NOT DONE | Related-work topic list in `docs/REPORT_DRAFT.md` | No verified papers or citations. |
| Deployable demo | PARTIAL | `docker-compose.yml`; `frontend/`; `backend/` | Fresh Docker start and complete user demo could not be verified because Docker Desktop was inaccessible. |

## Verification record

- Changed backend tests: **15 passed** (prompt and grounding tests).
- Full backend test attempt: **343 collected, 1 skipped**, then stalled on
  `backend/tests/test_api.py::test_no_token_is_401`; the configured database and
  model services were unavailable. No full-suite pass count is claimed.
- Ruff: **All checks passed** for `backend` and `eval` after the comparison
  script lint fix.
- `npm run lint`: passed with **2 warnings** (Fast Refresh export warnings in
  `frontend/src/auth.tsx` and `frontend/src/App.tsx`).
- `npm run build`: passed.
- No new frontend dependencies were added.
- V1 results are before evidence. Their cache-enabled latency is invalid for
  acceptance. V2 results were not produced; see `docs/results/RESULTS.md`.
- WCAG AA contrast was not formally measured. No browser-based end-to-end test,
  deployment, load test, model comparison, MLflow, or DVC run was performed.

## Manual steps left

1. Restore PostgreSQL and Ollama and grant Docker Desktop access; run the
   frozen v2 full, b1, and answer-writer evaluations with `LLM_CACHE=false`.
2. Run `eval/compare.py` on the selected v1 and v2 full result files, then add
   measured v2 failure examples and revise the result analysis.
3. Complete the literature review with real papers and verified citations.
4. Record the demo video and write the final report.
5. Complete the contribution log.
6. Run the secrets/artifact check before submission:

   ```powershell
   git ls-files | Select-String '\.env$|\.venv|\.cache|\.csv$'
   ```

   Review every match and ensure no secrets, local environment files, caches,
   datasets, or personal data are tracked.
