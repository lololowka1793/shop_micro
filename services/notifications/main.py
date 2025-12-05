from fastapi import FastAPI
from pydantic import BaseModel


app = FastAPI(title="Notifications Service")


# ----- Модель -----

class Notification(BaseModel):
    user_id: int
    message: str


# ----- Эндпоинты -----

@app.get("/health")
async def health():
    return {"status": "ok", "service": "notifications"}


@app.post("/notify")
async def notify(data: Notification):
    print(f"[NOTIFICATION] To user {data.user_id}: {data.message}")
    return {"status": "sent"}

