import logging
import time
from typing import List

import httpx
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    ForeignKey,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship
import os

# ------------------ ЛОГИ ------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [orders] %(message)s",
)
logger = logging.getLogger("orders-service")

app = FastAPI(title="Orders Service with SQLite + Notifications + CORS")

# ------------------ CORS ------------------

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ БД ------------------

SQLALCHEMY_DATABASE_URL = "sqlite:///./orders.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class OrderItemDB(Base):
    __tablename__ = "order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"))
    product_id = Column(Integer, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)


class OrderDB(Base):
    __tablename__ = "orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    status = Column(String, default="created")

    items = relationship(
        "OrderItemDB", backref="order", cascade="all, delete-orphan", lazy="joined"
    )


class OrderItemBase(BaseModel):
    product_id: int
    quantity: int = 1


class OrderCreate(BaseModel):
    user_id: int
    items: List[OrderItemBase]


class OrderItemOut(OrderItemBase):
    id: int

    class Config:
        orm_mode = True


class OrderOut(BaseModel):
    id: int
    user_id: int
    status: str
    items: List[OrderItemOut]

    class Config:
        orm_mode = True


# ------------------ MIDDLEWARE ЛОГОВ ------------------

@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception("Unhandled error during request %s %s", request.method, request.url.path)
        raise
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %d (%.2f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# ------------------ ИНИЦИАЛИЗАЦИЯ БД ------------------

@app.on_event("startup")
def on_startup():
    logger.info("Starting Orders service, initializing DB...")
    Base.metadata.create_all(bind=engine)
    logger.info("Orders DB initialized.")


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ------------------ HEALTH ------------------

@app.get("/health")
async def health():
    start = time.perf_counter()
    db_ok = False
    error_message = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_ok = False
        error_message = str(e)
        logger.exception("DB health check failed: %s", e)

    duration_ms = (time.perf_counter() - start) * 1000
    status = "ok" if db_ok else "degraded"

    result = {
        "service": "orders",
        "status": status,
        "db": {
            "status": "ok" if db_ok else "error",
            "response_time_ms": round(duration_ms, 2),
        },
    }
    if error_message:
        result["db"]["error"] = error_message
    return result


# ------------------ CRUD ОРДЕРОВ ------------------

@app.get("/orders", response_model=List[OrderOut])
def list_orders(db: Session = Depends(get_db)):
    orders = db.query(OrderDB).all()
    return orders


@app.get("/orders/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(OrderDB).filter(OrderDB.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


NOTIFICATIONS_URL = os.getenv("NOTIFICATIONS_SERVICE_URL", "http://notifications:8006")


async def send_notification_async(user_id: int, message: str):
    url = f"{NOTIFICATIONS_URL}/notify"
    payload = {"user_id": user_id, "message": message}
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.post(url, json=payload)
        logger.info("Notification sent: %s -> %s (status=%s)", url, payload, resp.status_code)
    except Exception as e:
        logger.warning("Failed to send notification: %s", e)


@app.post("/orders", response_model=OrderOut, status_code=201)
async def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    if not data.items:
        raise HTTPException(status_code=400, detail="Order must have at least one item")

    order = OrderDB(user_id=data.user_id, status="created")
    db.add(order)
    db.flush()  # чтобы появился order.id

    for item in data.items:
        db_item = OrderItemDB(
            order_id=order.id,
            product_id=item.product_id,
            quantity=item.quantity,
        )
        db.add(db_item)

    db.commit()
    db.refresh(order)
    logger.info("Created order id=%s for user_id=%s", order.id, order.user_id)

    # НЕ блокируем создание заказа, если notifications упал
    await send_notification_async(order.user_id, f"Order #{order.id} created")

    return order
