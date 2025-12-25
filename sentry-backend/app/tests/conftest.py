from app.core.config import settings

# Override settings for testing purpose to avoid actual API calls if needed
# But we want to test real integration if keys are present.

settings.OPENAI_API_KEY = settings.OPENAI_API_KEY or "sk-mock-key-for-test"
settings.E2B_API_KEY = settings.E2B_API_KEY or "e2b-mock-key"
