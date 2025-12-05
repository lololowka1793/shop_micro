import logging
import time
from typing import List

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, text
from sqlalchemy.orm import sessionmaker, declarative_base, Session

# ----- Логирование -----

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [catalog] %(message)s",
)
logger = logging.getLogger("catalog-service")

app = FastAPI(title="Catalog Service with SQLite + Logging")

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

# ----- БД -----

SQLALCHEMY_DATABASE_URL = "sqlite:///./catalog.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class ProductDB(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    price = Column(Float, nullable=False)
    in_stock = Column(Boolean, default=True)


class ProductBase(BaseModel):
    name: str
    price: float
    in_stock: bool = True


class ProductCreate(ProductBase):
    pass


class Product(ProductBase):
    id: int

    class Config:
        orm_mode = True


# ----- Middleware для логирования -----

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


# ----- Инициализация БД -----

@app.on_event("startup")
def on_startup():
    logger.info("Starting Catalog service, initializing DB...")
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        count = db.query(ProductDB).count()
        if count == 0:
            logger.info("Seeding initial products...")
            p1 = ProductDB(name="Smartphone X", price=699.0, in_stock=True)
            p2 = ProductDB(name="Laptop Pro", price=1299.0, in_stock=True)
            p3 = ProductDB(name="Wireless Headphones", price=199.0, in_stock=False)
            db.add_all([p1, p2, p3])
            db.commit()
    finally:
        db.close()
    logger.info("Catalog DB initialized.")


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
        "service": "catalog",
        "status": status,
        "db": {
            "status": "ok" if db_ok else "error",
            "response_time_ms": round(duration_ms, 2),
        },
    }
    if error_message:
        result["db"]["error"] = error_message

    return result


@app.get("/products", response_model=List[Product])
def list_products(db: Session = Depends(get_db)):
    return db.query(ProductDB).all()


@app.get("/products/{product_id}", response_model=Product)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = db.query(ProductDB).filter(ProductDB.id == product_id).first()
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@app.post("/products", response_model=Product, status_code=201)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    product = ProductDB(
        name=data.name,
        price=data.price,
        in_stock=data.in_stock,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    logger.info("Created new product id=%s name=%s", product.id, product.name)
    return product
