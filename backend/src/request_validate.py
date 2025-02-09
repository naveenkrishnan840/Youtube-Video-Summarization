from pydantic import BaseModel


class BotRequestQuery(BaseModel):
    query: str


class VideoUrlRequest(BaseModel):
    url: str
