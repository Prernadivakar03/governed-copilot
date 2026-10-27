# MDS-25 | Governed Analytics Copilot with Semantic Layer, Tool Use and Hallucination Audits

**M.Sc. Data Science — Capstone Project (Semester III)**

An enterprise-grade, research-backed analytics copilot for governed natural language querying, AST SQL parsing, granular database RBAC enforcement, and grounded evidence synthesis over the Brazilian E-Commerce (Olist) dataset.

---

## Architecture Overview

- **Frontend**: React 19 + TypeScript + Vite + Recharts + Lucide Icons (Linear/Vercel enterprise dark/light theme)
- **Backend**: Python 3.13 + FastAPI + Pydantic v2 + sqlglot AST Parser
- **Database**: PostgreSQL 16 with pgvector + 18 analytical composite indexes
- **Retrieval Engine**: Hybrid semantic fusion (BGE-small-en embeddings + BM25 keyword retrieval)
- **LLM Engine**: Ollama (`qwen2.5-coder:3b`) with structured JSON schema outputs
- **Security & Sandbox**: PostgreSQL read-only role impersonation (`analyst_ro`, `steward_ro`), statement timeouts, AST validation, dual-authorization approval queue, SHA-256 audit hash chain

---

## 11 Complete Application Interfaces

1. **Overview Dashboard** (`/overview`): Live telemetry, dataset health, 14-day execution trends, outcome donut chart, and infrastructure status.
2. **AI Analytics Copilot** (`/ask`): Primary workspace with natural language input, scope selector, grounded answer summary, metric tiles, Recharts dynamic visualizations, interactive data table, source citations, collapsible SQL viewer, and pipeline stage tracker.
3. **Enterprise Data Catalog** (`/catalog`): Schema metadata, column types, sensitivity badges (`PUBLIC`, `INTERNAL`, `PII`), row counts, and join keys.
4. **Semantic Layer** (`/semantic`): Business metric definitions, formula expressions, verified join topologies, business rules, and dispute resolution logic.
5. **SQL Studio** (`/studio`): Server-side AST validation, explain cost estimation, and sandbox execution.
6. **Query History** (`/history`): Paginated query log with status filters, latency metrics, and one-click reload into copilot.
7. **Governance Center** (`/governance`): Human-in-the-loop approval workflow, sensitive column diffing, and dual-authorization rules.
8. **Audit Trail** (`/audit`): Cryptographically tamper-evident event log with live SHA-256 hash chain verification.
9. **Research Evaluation** (`/evals`): Experimental benchmark against frozen 57-question gold set, Wilson 95% confidence intervals, and architecture ablation studies.
10. **System Monitoring** (`/monitoring`): Real-time PostgreSQL pool health, Ollama inference status, vector cache hits, and statement timeout metrics.
11. **Settings & RBAC** (`/settings`): Role permission matrix, security session info, and Dark/Light theme toggle.

---

## Demo Roles & Credentials

| Username | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| **`alice`** | `analyst123` | **Analyst** | Core analytics, no direct PII access (`customer_email`, `customer_phone` masked/blocked) |
| **`sam`** | `steward456` | **Data Steward** | PII access allowed, approval queue governance & policy reviewer |
| **`audrey`** | `auditor789` | **Auditor** | Read-only access to audit trail, cryptographic hash verification, and evaluation benchmarks |
| **`adam`** | `admin000` | **Administrator** | Full system administration, monitoring telemetry, and configuration management |

---

## Quick Start Instructions

### 1. Start Database & Dependencies
Ensure PostgreSQL is running locally on port `5432` with database `copilot`.
Ensure Ollama is running at `http://localhost:11434` with model `qwen2.5-coder:3b`.

### 2. Run Database Optimizations (One-time)
```powershell
& .\backend\.venv\Scripts\python.exe backend\scripts\optimize_indexes.py
```

### 3. Start Backend Server
From repository root:
```powershell
& .\backend\.venv\Scripts\python.exe -m uvicorn app.main:app --app-dir backend --port 8000 --reload
```
API Documentation will be live at `http://localhost:8000/docs`.

### 4. Start Frontend
In a separate terminal:
```powershell
cd frontend
npm install
npm run dev
```
Open browser at `http://localhost:5173/`.

---

## Automated Testing & Research Evaluation

### Run Test Suite (364 Tests)
```powershell
& .\backend\.venv\Scripts\python.exe -m pytest backend/tests -v
```

### Run Frontend Type Check & Build
```powershell
cd frontend
npm run build
npm run lint
```

### Run Gold Benchmark (57 Questions)
```powershell
& .\backend\.venv\Scripts\python.exe eval\run_eval.py full
```
