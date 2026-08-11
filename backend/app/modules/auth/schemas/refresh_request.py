from pydantic import BaseModel, ConfigDict


class RefreshRequest(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    refresh_token: str
