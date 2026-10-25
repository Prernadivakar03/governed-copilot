from app.config import settings
from app.main import app


def test_configured_frontend_origin_is_allowed():
    cors = next(middleware for middleware in app.user_middleware
                if middleware.cls.__name__ == "CORSMiddleware")
    assert settings.frontend_url in cors.kwargs["allow_origins"]
