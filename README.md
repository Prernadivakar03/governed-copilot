# Governed Analytics Copilot

An MSc capstone that answers questions about the Olist e-commerce data through a governed analytics workflow. The system uses PostgreSQL, read-only analyst and steward roles, SQL validation, approval gates, and an audit log.

## Prerequisites

- Docker Desktop on Windows, or Docker Engine and the Compose plugin on Linux.
- An Ollama instance on the host with the model named by `OLLAMA_MODEL` downloaded. By default, containers connect to `http://host.docker.internal:11434`.
- A Kaggle account to download the Olist dataset.
- For local Python and frontend development (instead of the containers): Python 3.13, Node.js 24, and npm.

## Quickstart in five steps

1. Clone the repository and create a local environment file:

   ```sh
   cp .env.example .env
   ```

   On PowerShell, use `Copy-Item .env.example .env`. Replace the password and secret placeholders with unique random values. Keep `.env` private; it is ignored by Git.

2. Download the [Brazilian E-Commerce Public Dataset by Olist on Kaggle](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce). Extract these CSV files into `data/raw/` (create the directory if needed): `olist_customers_dataset.csv`, `olist_orders_dataset.csv`, `olist_order_items_dataset.csv`, `olist_order_payments_dataset.csv`, `olist_order_reviews_dataset.csv`, `olist_products_dataset.csv`, `olist_sellers_dataset.csv`, and `product_category_name_translation.csv`. Do not commit or share the downloaded data. The loader drops review comment text and creates synthetic email and phone values for the PII permission demo.

3. Start Ollama on the host and make sure the model in `.env` is available. The default model is `qwen2.5-coder:3b`. To use the optional Compose Ollama service instead, change `OLLAMA_URL` to `http://ollama:11434` and start the stack with `docker compose --profile ollama up --build -d`; then pull the configured model with `docker compose exec ollama ollama pull qwen2.5-coder:3b` (replace the example name if `OLLAMA_MODEL` differs).

4. Build and start PostgreSQL, backend, and frontend:

   ```sh
   docker compose up --build -d
   ```

   Then load the analytics tables and grants, followed by the app schema and demo users:

   ```sh
   bash scripts/load-data.sh
   bash scripts/seed.sh
   ```

   On Windows, run `./scripts/load-data.ps1` and `./scripts/seed.ps1` in PowerShell. The order matters: role grants depend on the loaded analytics tables, and user seeding depends on the initialized app schema.

5. Open [http://localhost:8080](http://localhost:8080) and sign in as `alice` with the `SEED_USER_PASSWORD` value from `.env`. All demo accounts share that local demo password. To stop the stack while preserving the database volume, run `docker compose down`.

The same setup and dependency order is documented in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md). It also explains why `load-data` runs `load_olist.py` before `setup_roles.py`, and why `seed` runs `init_app_db.py` before `seed_users.py`.

## Demo users and roles

`scripts/seed` creates these local demo accounts. They all share `SEED_USER_PASSWORD`; choose a local value in `.env` and do not reuse it elsewhere.

| Usernames | Role | Capabilities |
| --- | --- | --- |
| `alice`, `bob` | Analyst | Ask analytics questions with analyst database access. Customer email and phone columns are not granted. |
| `sam`, `sara` | Steward | Ask questions with steward data access and review governed approvals. |
| `adam` | Admin | Administrative application role. |
| `audrey` | Auditor | Read audit records and verify the audit chain. |

The app user roles are separate from PostgreSQL's `analyst_ro` and `steward_ro` logins. The latter are created with read-only grants by `setup_roles.py`.

## Tests and lint

After running `scripts/setup` (or `scripts/setup.ps1`), run:

```sh
bash scripts/test.sh
bash scripts/lint.sh
```

On Windows use `./scripts/test.ps1` and `./scripts/lint.ps1`. The same checks can be run directly from `backend/` as `python -m pytest` and `python -m ruff check .`.

## Evaluation

Run the full evaluation only after the Olist data is loaded, roles and demo users are initialized, and Ollama is reachable:

```sh
bash scripts/eval.sh full
```

On Windows: `./scripts/eval.ps1 full`. The eval runner writes each run under `eval/results/`, which is ignored by Git. Results are measurements from the actual run; the repository does not promise preset accuracy or latency figures. For a pilot, pass `--pilot`; use `--no-answer` to skip LLM answer writing. The eval protocol can be frozen with `python eval/freeze.py` before final runs.

## Configuration

Docker Compose reads `.env`. The database uses the host-side `POSTGRES_HOST`/`POSTGRES_PORT` values for scripts; Compose overrides the backend container's database host and port to `db:5432`. `FRONTEND_URL` controls the backend's allowed browser origin, and `VITE_API_URL` is embedded in the frontend build. Rebuild the frontend after changing `VITE_API_URL`.

The Compose `ollama` service is optional and is started only with the `ollama` profile. For host-installed Ollama, keep the default `OLLAMA_URL`. For the profile service, set `OLLAMA_URL=http://ollama:11434` in `.env` before starting with `--profile ollama`.

## Troubleshooting

- **Backend or frontend is not healthy:** run `docker compose ps` and `docker compose logs backend frontend db`. Compose waits for PostgreSQL and backend health before starting dependent services.
- **Backend cannot reach PostgreSQL:** confirm `.env` exists and check the host port is free. Inside Compose, the backend connects to service `db`; the host port in `POSTGRES_PORT` is only for local tools.
- **Backend says Ollama is unavailable:** confirm the host Ollama server is running and the model in `OLLAMA_MODEL` is present. For the Compose profile, verify `OLLAMA_URL=http://ollama:11434` and pull the model in the `ollama` service.
- **`load-data` reports a missing file:** check that all eight expected CSVs are directly in `data/raw/`, not still inside the downloaded archive's nested directory.
- **Login fails or tables are missing:** run `scripts/seed` after `scripts/load-data`, and sign in with the `SEED_USER_PASSWORD` value currently in `.env`.
- **Port already in use:** change `POSTGRES_PORT`, `BACKEND_PORT`, or `FRONTEND_PORT` in `.env`, then restart Compose. Also set `VITE_API_URL` to the backend's host URL and `FRONTEND_URL` to the frontend's browser origin when their ports change.
- **Reset the database:** `docker compose down -v` removes the persistent database volume; rerun the data loading and seed steps afterward.
