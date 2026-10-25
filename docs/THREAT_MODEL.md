# Threat model

Assets: analytics rows, PII columns, database integrity, approval decisions, credentials and audit integrity. Trust boundary: natural-language questions, retrieved catalog text and model output are untrusted. Evidence below names existing implementation and tests; it does not claim formal assurance.

| STRIDE | Threat | Mitigation in code | Tests |
|---|---|---|---|
| Spoofing | Unauthorized user submits queries | JWT auth and role dependencies | `test_auth.py`, `test_api.py` |
| Tampering | Generated SQL changes data or chains statements | SQL AST allowlist, single SELECT, read-only DB roles | `test_validator.py`, `test_security_destructive.py`, `test_security_api.py` |
| Repudiation | User denies actions | Append-only hash-chained audit events | `test_audit.py`, `test_api.py` |
| Information disclosure | Analyst asks for customer email/phone | Role-filtered retrieval, validator restrictions, DB grants, PII approval gate | `test_retrieval.py`, `test_grants.py`, `test_security_matrix.py` |
| Denial of service | Expensive SQL or long model requests | EXPLAIN cost policy, statement timeout, bounded attempts/result rows | `test_policy.py`, `test_failure_scenarios.py` |
| Elevation of privilege | Approval endpoint bypass or self-approval | Steward/admin decision role, separation of requester/decider, atomic decision and revalidation before execution | `test_approvals.py`, `test_api.py`, `test_security_api.py` |

## Misuse and abuse cases

- **Prompt injection** (including “ignore previous instructions” or fake system text): prompts are not trusted as policy; SQL validator and database role remain enforcement boundaries. Catalog text is scanned for injection patterns. See `backend/app/semantic/loader.py`, `backend/app/generation/prompt.py`, `backend/app/validation/sql_validator.py`, `test_catalog_poison.py`, `test_failure_scenarios.py`.
- **PII leakage** through retrieval or SQL: analyst retriever excludes PII before indexing; validator and DB permissions independently restrict access; sensitive reads can trigger approval. See `retriever.py`, `sql_validator.py`, `governance/policy.py`, `test_retrieval.py`, `test_grants.py`, `test_security_matrix.py`.
- **Excessive tool permissions**: the pipeline invokes only registered names in `ALLOWED_TOOLS`; tools execute SELECT-only queries. See `governance/tools.py`, `sandbox/executor.py`, `test_tools.py`, `test_validator.py`.
- **Approval bypass**: an approval is role-checked, expires, prevents self-approval, and execution revalidates the SQL. See `api/approvals.py`, `governance/approvals.py`, `service.py`, `test_approvals.py`.
- **Unsupported claims**: unsupported questions can return clarify/cannot-answer; generated answer numbers are checked against result values. See `pipeline.py`, `validation/grounding.py`, `test_grounding.py`, `test_failure_scenarios.py`.

Residual risk: tests exercise expected cases but do not prove absence of undiscovered attacks. The local model, dependencies, host and DB configuration remain part of the trusted computing base.
