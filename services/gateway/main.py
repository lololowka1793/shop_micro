import logging
import os
import time
from typing import Any, Dict, Optional

import httpx
import jwt
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# -------------------------------------------------
# Логирование
# -------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [gateway] %(message)s",
)
logger = logging.getLogger("gateway-service")

app = FastAPI(title="Gateway Service with Logging & JWT")

# -------------------------------------------------
# CORS
# -------------------------------------------------

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------
# Конфиг сервисов
# -------------------------------------------------

SERVICES: Dict[str, str] = {
    "auth": os.getenv("AUTH_SERVICE_URL", "http://localhost:8001"),
    "users": os.getenv("USERS_SERVICE_URL", "http://localhost:8002"),
    "catalog": os.getenv("CATALOG_SERVICE_URL", "http://localhost:8003"),
    "orders": os.getenv("ORDERS_SERVICE_URL", "http://localhost:8004"),
    "notifications": os.getenv("NOTIFICATIONS_SERVICE_URL", "http://localhost:8006"),
}

# JWT-конфиг (должен совпадать с auth-сервисом)
AUTH_SECRET_KEY = os.getenv("AUTH_SECRET_KEY", "dev_secret_change_me")
AUTH_ALGORITHM = os.getenv("AUTH_ALGORITHM", "HS256")

# -------------------------------------------------
# Middleware: лог всех запросов
# -------------------------------------------------


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        logger.exception(
            "Unhandled error during request %s %s",
            request.method,
            request.url.path,
        )
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


# -------------------------------------------------
# Вспомогательные HTTP-функции
# -------------------------------------------------


async def safe_get(url: str) -> Optional[Any]:
    """
    Безопасный GET:
    - логируем успех/ошибку
    - при ошибке возвращаем None
    """
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            logger.info("HTTP GET %s -> %d", url, resp.status_code)
            return resp.json()
    except Exception as e:
        logger.warning("HTTP GET %s FAILED: %s", url, e)
        return None


# -------------------------------------------------
# Авторизация через JWT
# -------------------------------------------------


class CurrentUser(BaseModel):
    username: str
    role: str
    user_id: Optional[int] = None  # в токене может и не быть, оставим на будущее


bearer_scheme = HTTPBearer(auto_error=True)


def decode_jwt(token: str) -> CurrentUser:
    try:
        payload = jwt.decode(
            token,
            AUTH_SECRET_KEY,
            algorithms=[AUTH_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    username = payload.get("sub")
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    role = payload.get("role") or "user"
    user_id = payload.get("user_id")  # на будущее, если добавишь в токен

    return CurrentUser(username=username, role=role, user_id=user_id)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> CurrentUser:
    """
    Достаём пользователя из заголовка Authorization: Bearer <jwt>
    """
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth scheme",
        )

    token = credentials.credentials
    return decode_jwt(token)


async def require_admin(
    current_user: CurrentUser = Depends(get_current_user),
) -> CurrentUser:
    """
    Депенденси для эндпоинтов только для admin.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required",
        )
    return current_user


# -------------------------------------------------
# Эндпоинты
# -------------------------------------------------


@app.get("/health")
async def health():
    """
    Расширенный health для gateway:
    - статус gateway
    - для каждого сервиса: статус + время ответа его /health
    """
    result: Dict[str, Any] = {
        "gateway": {"status": "ok"}
    }

    for name, base_url in SERVICES.items():
        health_url = f"{base_url}/health"
        start = time.perf_counter()
        data = await safe_get(health_url)
        duration_ms = (time.perf_counter() - start) * 1000

        status_str = "ok" if data is not None else "unavailable"

        result[name] = {
            "status": status_str,
            "response_time_ms": round(duration_ms, 2),
        }

    return result


@app.get("/summary")
async def summary(current_user: CurrentUser = Depends(get_current_user)):
    """
    Защищённый эндпоинт.
    Собирает данные из users, catalog, orders.
    """
    users = await safe_get(f"{SERVICES['users']}/users")
    products = await safe_get(f"{SERVICES['catalog']}/products")
    orders = await safe_get(f"{SERVICES['orders']}/orders")

    result: Dict[str, Any] = {
        "requested_by": current_user.username,
        "role": current_user.role,
    }

    if users is not None:
        result["users"] = users
    else:
        result["users_error"] = "users_service_unavailable"

    if products is not None:
        result["products"] = products
    else:
        result["products_error"] = "catalog_service_unavailable"

    if orders is not None:
        result["orders"] = orders
    else:
        result["orders_error"] = "orders_service_unavailable"

    return result


@app.get("/me")
async def me(current_user: CurrentUser = Depends(get_current_user)):
    """
    Возвращает профиль пользователя из users-сервиса по username из токена.
    """
    users = await safe_get(f"{SERVICES['users']}/users")
    if users is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="users_service_unavailable",
        )

    for user in users:
        if user.get("username") == current_user.username:
            return user

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found",
    )


@app.get("/my-orders")
async def my_orders(current_user: CurrentUser = Depends(get_current_user)):
    """
    Возвращает только заказы текущего пользователя.
    Логика:
    1) по username ищем его в users-сервисе → берём id;
    2) забираем все заказы из orders-сервиса;
    3) фильтруем по user_id.
    """
    # 1. Находим user_id по username
    users = await safe_get(f"{SERVICES['users']}/users")
    if users is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="users_service_unavailable",
        )

    user_obj = next(
        (u for u in users if u.get("username") == current_user.username),
        None,
    )
    if user_obj is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found in users service",
        )

    user_id = user_obj.get("id")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="User has no id in users service",
        )

    # 2. Берём все заказы
    orders = await safe_get(f"{SERVICES['orders']}/orders")
    if orders is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="orders_service_unavailable",
        )

    # 3. Фильтруем по user_id
    my_orders_list = [o for o in orders if o.get("user_id") == user_id]
    return my_orders_list


# Пример: эндпоинт только для админов (на будущее, под /users, /catalog и т.п.)
@app.get("/admin/users")
async def admin_users(current_user: CurrentUser = Depends(require_admin)):
    """
    Пример админского эндпоинта: выводит всех пользователей.
    Потом можно будет перевести фронт на этот URL.
    """
    users = await safe_get(f"{SERVICES['users']}/users")
    if users is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="users_service_unavailable",
        )
    return users
