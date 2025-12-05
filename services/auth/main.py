import logging
import os
from datetime import datetime, timedelta
from typing import Optional

import httpx
import jwt
from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from sqlalchemy import Column, Integer, String, create_engine, or_
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
import bcrypt


# ---------- Логирование ----------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [auth] %(message)s",
)
logger = logging.getLogger("auth-service")

# ---------- Конфиг ----------

AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "dev_secret_change_me")
AUTH_ALGORITHM = os.getenv("AUTH_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("AUTH_ACCESS_TOKEN_EXPIRE_MINUTES", "60")
)

USERS_SERVICE_URL = os.getenv("USERS_SERVICE_URL", "http://localhost:8002")

DATABASE_URL = "sqlite:///./auth.db"

# ---------- БД ----------

engine = create_engine(
    DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class AuthUser(Base):
    __tablename__ = "auth_users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="user")  # поле роли


Base.metadata.create_all(bind=engine)

# ---------- Pydantic-модели ----------


class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------- Хэширование паролей (bcrypt) ----------

def get_password_hash(password: str) -> str:
    """
    Хэш пароля через bcrypt.
    Возвращаем строку (decode из bytes), чтобы хранить в БД как TEXT.
    """
    hashed: bytes = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Проверка пароля.
    Если хэш кривой или произошла ошибка — вернём False, а не уронӣм сервис.
    """
    try:
        return bcrypt.checkpw(
            plain.encode("utf-8"),
            hashed.encode("utf-8"),
        )
    except Exception:
        return False


# ---------- JWT ----------


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None
) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(
        to_encode, AUTH_SECRET_KEY, algorithm=AUTH_ALGORITHM
    )
    return encoded_jwt


# ---------- FastAPI + CORS ----------

app = FastAPI(title="Auth Service (JWT)")

# CORS: разрешаем запросы со всех источников (для учебного проекта ок)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Стартап: создаём admin, если его нет ----------

ADMIN_DEFAULT_USERNAME = "admin"
ADMIN_DEFAULT_PASSWORD = os.getenv("AUTH_ADMIN_PASSWORD", "admin123")
ADMIN_DEFAULT_EMAIL = "admin@example.com"


@app.on_event("startup")
def create_default_admin():
    """
    Создаём пользователя admin/admin123 с ролью admin, если его ещё нет.
    """
    db: Session = SessionLocal()
    try:
        existing = (
            db.query(AuthUser)
            .filter(AuthUser.username == ADMIN_DEFAULT_USERNAME)
            .first()
        )
        if existing:
            return

        hashed = get_password_hash(ADMIN_DEFAULT_PASSWORD)
        admin = AuthUser(
            username=ADMIN_DEFAULT_USERNAME,
            email=ADMIN_DEFAULT_EMAIL,
            password_hash=hashed,
            role="admin",
        )
        db.add(admin)
        db.commit()
        logger.info(
            "Created default admin user '%s' with password '%s'",
            ADMIN_DEFAULT_USERNAME,
            ADMIN_DEFAULT_PASSWORD,
        )
    finally:
        db.close()


# ---------- Dependency для БД ----------

def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------- Health ----------


@app.get("/health")
async def health():
    return {"service": "auth", "status": "ok"}


# ---------- Регистрация ----------


@app.post("/register", status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    # Проверка уникальности username / email
    existing = (
        db.query(AuthUser)
        .filter(
            or_(
                AuthUser.username == req.username,
                AuthUser.email == req.email,
            )
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this username or email already exists",
        )

    # Создаём пользователя в локальной БД auth
    hashed = get_password_hash(req.password)
    auth_user = AuthUser(
        username=req.username,
        email=req.email,
        password_hash=hashed,
        role="user",  # при регистрации обычный пользователь
    )
    db.add(auth_user)
    db.commit()
    db.refresh(auth_user)

    # Пытаемся создать пользователя в users-сервисе
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.post(
                f"{USERS_SERVICE_URL}/users",
                json={"username": req.username, "email": req.email},
            )
            resp.raise_for_status()
    except Exception as e:
        logger.warning(
            "Failed to sync user to users-service: %s", e
        )
        # Регистрацию не роняем из-за ошибки в другом сервисе

    return {"detail": "registered"}


# ---------- Логин ----------


@app.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    user: Optional[AuthUser] = (
        db.query(AuthUser)
        .filter(AuthUser.username == req.username)
        .first()
    )
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )

    # сюда кладём и username, и role
    access_token = create_access_token(
        {
            "sub": user.username,
            "role": user.role or "user",
        }
    )

    # БЫЛО: return LoginResponse(access_token=token) – переменная token не существует
    return LoginResponse(access_token=access_token)
