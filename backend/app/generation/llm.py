import hashlib
import json

import httpx

from app.config import ROOT, settings

CACHE_DIR = ROOT / ".cache" / "llm"


class LLMError(Exception):
    pass


class OllamaClient:
    def __init__(self, url: str | None = None, model: str | None = None, use_cache: bool | None = None,
                 seed: int | None = None, temperature: float | None = None):
        self.url = url or settings.ollama_url
        self.model = model or settings.ollama_model
        self.use_cache = settings.llm_cache if use_cache is None else use_cache
        self.seed = settings.llm_seed if seed is None else seed
        self.temperature = settings.llm_temperature if temperature is None else temperature
        CACHE_DIR.mkdir(parents=True, exist_ok=True)

    def chat_json(self, messages: list[dict]) -> dict:
        key = hashlib.sha256(
            json.dumps([self.model, self.seed, self.temperature, messages], sort_keys=True).encode()
        ).hexdigest()
        cache_file = CACHE_DIR / f"{key}.json"
        if self.use_cache and cache_file.exists():
            return json.loads(cache_file.read_text(encoding="utf-8"))

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "format": "json",
            "options": {"temperature": self.temperature, "seed": self.seed, "num_ctx": settings.llm_num_ctx},
        }
        try:
            r = httpx.post(f"{self.url}/api/chat", json=payload, timeout=180)
            r.raise_for_status()
            content = r.json()["message"]["content"]
        except (httpx.HTTPError, KeyError) as e:
            raise LLMError(f"LLM unavailable: {e}") from e
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            raise LLMError("model returned malformed JSON") from e
        if not isinstance(data, dict):
            raise LLMError("model returned non-object JSON")
        if self.use_cache:
            cache_file.write_text(json.dumps(data), encoding="utf-8")
        return data