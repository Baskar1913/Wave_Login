from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "Wave"
    database_url: str = "postgresql+psycopg://postgres:YOUR_POSTGRES_PASSWORD@localhost:5432/wave"
    secret_key: str = "change-me-in-production"
    access_token_expire_minutes: int = 60
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    @property
    def cors_origin_list(self): return [x.strip() for x in self.cors_origins.split(",") if x.strip()]
settings = Settings()
