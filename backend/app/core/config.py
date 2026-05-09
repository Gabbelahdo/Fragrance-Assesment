from pydantic import Field
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
    ai_api_key: str  # Anthropic API key (sk-ant-...)

    # CORS — stored as a comma-separated string so Azure App Settings is simple.
    # Example: CORS_ORIGINS=http://localhost:5173,https://yourapp.azurestaticapps.net
    # We keep it as str here and expose cors_origins as a property to avoid
    # pydantic-settings trying to JSON-decode a list[str] from the env file.
    cors_origins_raw: str = Field(
        default="http://localhost:5173",
        alias="CORS_ORIGINS",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins_raw.split(",") if o.strip()]

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore",
        populate_by_name=True,  # allow field name OR alias
    )


settings = Settings()  # type: ignore[call-arg]
