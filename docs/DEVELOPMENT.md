# Local development workflow

Run the setup steps in this order:

1. `scripts/setup` creates `.env` from the placeholder template when needed and installs the Python and frontend development dependencies.
2. `scripts/up` builds and starts PostgreSQL, the backend, and the frontend. Compose waits for PostgreSQL before starting the backend and for the backend health check before starting the frontend.
3. `scripts/load-data` loads the Olist CSV files into the `analytics` schema, then runs `setup_roles.py`. The grants can only be applied after the analytics tables exist.
4. `scripts/seed` runs `init_app_db.py` before `seed_users.py`. The seed script needs the `app.users` table created by the initializer.
5. Run `scripts/test` and `scripts/lint` for checks. Run `scripts/eval full` after the dataset, database roles, application tables, demo users, and Ollama model are available.

The PowerShell entry points use the `.ps1` suffix on Windows. The shell entry points use the `.sh` suffix on Linux and macOS. The Compose volume stores PostgreSQL data across `scripts/down`; `docker compose down -v` removes it.
