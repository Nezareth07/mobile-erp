from pydantic import BaseModel, ConfigDict, Field


class UserPasswordChange(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    current_password: str = Field(
        min_length=1,
        max_length=72,
    )

    new_password: str = Field(
        min_length=8,
        max_length=72,
    )
