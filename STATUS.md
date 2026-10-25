# Capstone submission status

Status reflects repository evidence as of 26 October 2026. `DONE` means the artifact exists; it does not imply institutional review or production readiness.

| Capstone deliverable | Status | Evidence |
|---|---|---|
| Problem brief | PARTIAL | Project intent is summarized in [README.md](README.md) and [docs/ARCHITECTURE_NOTES.md](docs/ARCHITECTURE_NOTES.md); no separate approved problem brief or rubric is present. |
| Design pack | PARTIAL | [docs/diagrams/](docs/diagrams/) has context, container and approval sequence diagrams; no separate UX/research design pack was found. |
| Prototype | DONE | FastAPI backend under `backend/app/`, React client under `frontend/`, and `docker-compose.yml`; local Postgres and Ollama reachability were verified. |
| Innovation comparison | PARTIAL | Variants and pilot/full comparisons are in [docs/results/RESULTS.md](docs/results/RESULTS.md); four ablations are pilot-only. |
| Data package | PARTIAL | Olist semantic specification and [docs/DATA_DICTIONARY.md](docs/DATA_DICTIONARY.md) are present. Dataset files are ignored and were not committed; data provenance/license package was not verified. |
| Research package | NOT DONE | [docs/REPORT_DRAFT.md](docs/REPORT_DRAFT.md) lists related-work topics, but real papers and citations remain for the author. |
| Engineering evidence | DONE | [docs/openapi.json](docs/openapi.json), [docs/THREAT_MODEL.md](docs/THREAT_MODEL.md), backend test suite, Ruff, and frontend lint/build evidence. |
| Evaluation dossier | PARTIAL | [docs/results/RESULTS.md](docs/results/RESULTS.md), [docs/results/FAILURE_ANALYSIS.md](docs/results/FAILURE_ANALYSIS.md), and [docs/SYSTEM_CARD.md](docs/SYSTEM_CARD.md). Evaluation gates include a failure and invalid/pending checks; all ablations need full-set reruns. |
| Frontend polish | PARTIAL | `frontend/src/pages/Ask.tsx`, `frontend/src/index.css`, `frontend/src/App.tsx`, and `frontend/public/governed-mark.svg` implement the refreshed Ask flow, theme persistence, logo, and responsive tokens. Dedicated confirmation dialogs, skeleton states, KPI refinements across every page, and a measured WCAG AA audit remain incomplete. |
| Deployable demo | PARTIAL | Compose configuration and frontend/backend build exist, and local dependencies responded. A complete fresh-start user demo and video were not verified. |

## Evaluation actually completed

- Frozen protocol: `eval/frozen.json`.
- Full set: `full` (answer writer on), `b0` and `b1` (answer writer disabled).
- Pilot set: initial `full`, plus `no_semantic`, `no_hybrid`, `no_validation`, `no_permissions` (all answer writer disabled).
- The initial pilot took 2m38.8s, but the full run took 19m04s and full baselines took 13m25.7s and 15m06.4s. The remaining four ablations were reduced to pilots to keep the run feasible. Logs and JSON result files are in `eval/results/`.
- Main measured gates: zero unauthorized exposure and 100% attack blocking passed on the evaluated cases; hallucination-below-B0 failed; p95 latency is invalid because cache was on; accuracy gate is pending because `--min-acc` was not set.

## Verification limits

- Postgres and Ollama were reachable and the configured Ollama model was present.
- Backend tests passed: **350 passed, 1 warning**. Ruff passed.
- Frontend `npm run lint` and `npm run build` passed; lint printed three existing warnings.
- The live FastAPI/React application was not started for an end-to-end UI session. Responsive layout was coded for narrow screens but not visually checked at exactly 375px. WCAG AA contrast was not audited with a contrast checker or assistive technology.
- No deployment was performed. `docs/openapi.json` reflects the local FastAPI app schema at export time.
- `LLM_CACHE=true` made the report's latency gate invalid. The evaluation is not a production acceptance test.

## Manual steps for the author

1. Complete the literature review using real papers and verified citations.
2. Record a 5–8 minute demo video.
3. Write and format the final report; replace the draft TODOs.
4. Complete your own contribution and hours log.
5. Run the secrets/artifact check before submission:

   ```powershell
   git ls-files | Select-String '\.env$|\.venv|\.cache|\.csv$'
   ```

   Confirm each match is expected, and remove any secret, local environment, cache, dataset or personal data from the index before submitting.
