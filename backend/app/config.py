from pathlib import Path

from psycopg.conninfo import make_conninfo
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")

    postgres_user: str = "copilot"
    postgres_password: str = ""
    postgres_db: str = "copilot"
    postgres_host: str = "localhost"
    postgres_port: int = 5432

    analyst_ro_password: str = ""
    steward_ro_password: str = ""

    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "qwen2.5-coder:3b"

    jwt_secret: str = ""
    jwt_access_minutes: int = 15
    jwt_refresh_days: int = 7
    cookie_secure: bool = False
    seed_user_password: str = ""

    retrieval_mode: str = "hybrid"  # bm25 | vector | hybrid
    llm_answer: bool = True  # LLM writes a short answer, then a grounding check verifies its numbers
    llm_cache: bool = True  # set LLM_CACHE=false for latency measurements
    approval_cost_threshold: float = 100000
    approval_join_threshold: int = 4
    approval_ttl_minutes: int = 60

    def conninfo(self, user: str, password: str, timeout_ms: int | None = None) -> str:
        options = f"-c statement_timeout={timeout_ms}" if timeout_ms else None
        kwargs = {
            "host": self.postgres_host,
            "port": self.postgres_port,
            "dbname": self.postgres_db,
            "user": user,
            "password": password,
        }
        if options:
            kwargs["options"] = options
        return make_conninfo(**kwargs)

    def admin_conninfo(self) -> str:
        return self.conninfo(self.postgres_user, self.postgres_password)

    def role_conninfo(self, app_role: str, timeout_ms: int) -> str:
        creds = {
            "analyst": ("analyst_ro", self.analyst_ro_password),
            "steward": ("steward_ro", self.steward_ro_password),
        }
        if app_role not in creds:
            raise ValueError(f"unknown role: {app_role}")
        user, pw = creds[app_role]
        return self.conninfo(user, pw, timeout_ms)


settings = Settings()