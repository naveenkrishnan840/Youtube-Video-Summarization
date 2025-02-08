from pydantic import BaseModel


class BotRequestQuery(BaseModel):
    url: str
    query: str

