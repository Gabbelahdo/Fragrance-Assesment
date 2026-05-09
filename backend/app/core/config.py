from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # MongoDB — local uses docker-compose URL, Azure uses Cosmos DB connection string
    mongodb_url: str
    db_name: str = "fragrance_db"

    # Auth
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 30  # 30 days

    # External APIs
    fragrance_api_url: str
    fragrance_api_key: str
    ai_api_key: str

    # CORS — comma-separated list of allowed origins
    cors_origins: list[str] = ["http://localhost:5173"]

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()  # type: ignore[call-arg]
