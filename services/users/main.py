import logging
import time
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sqlalchemy import create_engine, Column, Integer, String, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# ----- Логирование -----

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [users] %(message)s",
)
logger = logging.getLogger("users-service")

app = FastAPI(title="Users Service with SQLite + Logging")

# ----- CORS -----
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

# ----- Настройки БД -----

SQLALCHEMY_DATABASE_URL = "sqlite:///./users.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ----- ORM-модель -----

class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)


# ----- Pydantic-модели -----

class UserBase(BaseModel):
    username: str
    email: Optional[str] = None


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int

    class Config:
        orm_mode = True


# ----- Middleware для логирования запросов -----

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


# ----- Создание таблиц и начальное наполнение -----

@app.on_event("startup")
def on_startup():
    logger.info("Starting Users service, initializing DB...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        count = db.query(UserDB).count()
        if count == 0:
            logger.info("Seeding initial users...")
            u1 = UserDB(username="alice", email="alice@example.com")
            u2 = UserDB(username="bob", email="bob@example.com")
            db.add_all([u1, u2])
            db.commit()
    finally:
        db.close()
    logger.info("Users DB initialized.")


# ----- Зависимость для сессии БД -----

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ----- Эндпоинты -----

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
        "service": "users",
        "status": status,
        "db": {
            "status": "ok" if db_ok else "error",
            "response_time_ms": round(duration_ms, 2),
        },
    }
    if error_message:
        result["db"]["error"] = error_message

    return result


@app.get("/users", response_model=List[User])
def list_users(db: Session = Depends(get_db)):
    return db.query(UserDB).all()


@app.get("/users/{user_id}", response_model=User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.post("/users", response_model=User, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    user = UserDB(username=data.username, email=data.email)
    db.add(user)
    db.commit()
    db.refresh(user)
    logger.info("Created new user id=%s username=%s", user.id, user.username)
    return user
