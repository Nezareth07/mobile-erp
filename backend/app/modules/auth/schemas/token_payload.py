from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TokenPayload(BaseModel):
    """Uso interno de AuthService para validar claims decodificados — nunca es response_model ni request body."""

    model_config = ConfigDict(from_attributes=True)

    sub: UUID
    exp: datetime
    iat: datetime
    type: str
    jti: UUID | None = None
