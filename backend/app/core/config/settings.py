from enum import Enum

from pydantic import BaseModel
from pydantic import Field
from pydantic import SecretStr

from pydantic_settings import BaseSettings
from pydantic_settings import SettingsConfigDict

class Environment(str, Enum):
    DEVELOPMENT = "development"
    TESTING = "testing" 
    PRODUCTION = "production"


class ApplicationConfig(BaseModel):
    name: str = "MobileERP"
    version: str = "0.1.0"
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = True


class DatabaseConfig(BaseModel):
    url: str
    echo: bool = False


class SecurityConfig(BaseModel):
    secret_key: SecretStr
    algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=30, gt=0)


class APIConfig(BaseModel):
    prefix: str = "/api/v1"
    cors_origins: list[str] = Field(default_factory=list)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        case_sensitive=False,
        extra="ignore",
    )

    application: ApplicationConfig = ApplicationConfig()

    database: DatabaseConfig

    security: SecurityConfig

    api: APIConfig = APIConfig()


settings = Settings()