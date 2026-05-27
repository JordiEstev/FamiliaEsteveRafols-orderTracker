import os
import traceback
from datetime import date, datetime, timezone
from typing import List, Optional, Literal

from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict
from pydantic_settings import BaseSettings
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, Text, DateTime, Date, text
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session, joinedload
from pathlib import Path
from pydantic import BaseModel, Field, model_validator, ConfigDict, field_validator


class Settings(BaseSettings):
    database_url: str = "sqlite:///./orders.db"
    cors_origins: str = "http://localhost:5173"

    class Config:
        env_file = Path(__file__).parent.parent / ".env"

settings = Settings()

# ---------- Base de datos ----------
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {}
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


# ---------- ORM Models ----------
class OrderORM(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    customer = Column(String, nullable=False)
    date = Column(Date, index=True)
    place = Column(String, index=True)
    notes = Column(Text, nullable=True)
    status = Column(String, nullable=False, default="pending")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    items = relationship("OrderItemORM", back_populates="order", cascade="all, delete-orphan")


class OrderItemORM(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    fruit = Column(String, index=True)
    size = Column(Integer, nullable=True)
    qty = Column(Integer, nullable=False)
    weight = Column(Float, nullable=True)
    order = relationship("OrderORM", back_populates="items")


Base.metadata.create_all(bind=engine)

# Migrate existing DBs that lack the status column
with engine.connect() as _conn:
    try:
        _conn.execute(text("ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'"))
        _conn.commit()
    except Exception:
        pass  # column already exists


# ---------- Pydantic models ----------
StatusLiteral = Literal["pending", "ready", "picked_up", "cancelled"]

FruitCode = Literal[
    "pressec_groc", "pressec_vermell", "pressec_barrejat",
    "albercoc", "cirera", "melo", "sindria"
]
PlaceName = Literal["Cantallops", "Sant Pau", "La Girada", "El Pla", "Puigdalber"]

class FruitItemIn(BaseModel):
    fruit: FruitCode
    qty: int = Field(..., gt=0)
    size: Optional[int] = None
    weight: Optional[float] = None

    @model_validator(mode="after")
    def validate_fruit_fields(self):
        fruit = self.fruit
        size = self.size
        weight = self.weight

        if fruit.startswith("pressec"):
            if size not in {15, 16, 18, 20, 22, 24, 26}:
                raise ValueError("El calibre del pressec ha de ser 15, 16, 18, 20, 22, 24 o 26")
            if weight is not None:
                raise ValueError("El pressec no usa el camp weight")
        elif fruit in {"albercoc", "cirera"}:
            if size is not None:
                raise ValueError("Albercoc/cirera no usen calibre")
            if weight not in {1, 2}:
                raise ValueError("El pes per unitat ha de ser 1 o 2 kg")
        elif fruit in {"melo", "sindria"}:
            if size is not None:
                raise ValueError("Meló/síndria no usen calibre")
            if weight is not None and weight <= 0:
                raise ValueError("El pes total ha de ser > 0")
        return self


class FruitItemOut(FruitItemIn):
    id: int
    model_config = ConfigDict(from_attributes=True)


class OrderCreate(BaseModel):
    customer: str
    date: date
    place: PlaceName
    notes: Optional[str] = ""
    status: StatusLiteral = "pending"
    fruits: List[FruitItemIn]


class StatusUpdate(BaseModel):
    status: StatusLiteral


class OrderOut(BaseModel):
    id: int
    customer: str
    date: date
    place: str
    notes: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime
    fruits: List[FruitItemOut] = []

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def map_items_to_fruits(cls, data):
        if hasattr(data, "items"):
            data.__dict__["fruits"] = data.items
        return data

# ---------- FastAPI ----------
app = FastAPI()

# Punto 10: CORS desde variable de entorno
origins = [o.strip() for o in settings.cors_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@app.get("/orders", response_model=List[OrderOut])
def get_orders(
    date_filter: Optional[date] = Query(None, alias="date"),
    place: Optional[str] = Query(None),
    customer: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    q = db.query(OrderORM).options(joinedload(OrderORM.items))
    if date_filter:
        q = q.filter(OrderORM.date == date_filter)
    if place:
        q = q.filter(OrderORM.place == place)
    if customer:
        q = q.filter(OrderORM.customer.ilike(f"%{customer}%"))
    if status:
        q = q.filter(OrderORM.status == status)
    orders = q.order_by(OrderORM.created_at.desc()).all()
    return orders


@app.post("/orders", response_model=OrderOut)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    try:
        new_order = OrderORM(
            customer=order.customer,
            date=order.date,
            place=order.place,
            notes=order.notes,
            status=order.status,
            items=[
                OrderItemORM(fruit=i.fruit, size=i.size, qty=i.qty, weight=i.weight)
                for i in order.fruits
            ]
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        return new_order
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error intern en crear la comanda")


@app.put("/orders/{order_id}", response_model=OrderOut)
def update_order(order_id: int, order: OrderCreate, db: Session = Depends(get_db)):
    try:
        db_order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
        if not db_order:
            raise HTTPException(404, "Comanda no trobada")
        db_order.customer = order.customer
        db_order.date = order.date
        db_order.place = order.place
        db_order.notes = order.notes
        db_order.status = order.status
        db_order.updated_at = datetime.now(timezone.utc)
        for item in db_order.items:
            db.delete(item)
        db.flush()
        db_order.items = [
            OrderItemORM(order_id=order_id, fruit=i.fruit, size=i.size, qty=i.qty, weight=i.weight)
            for i in order.fruits
        ]
        db.commit()
        db.refresh(db_order)
        return db_order
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error intern en actualitzar la comanda")


@app.delete("/orders/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    try:
        order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
        if not order:
            raise HTTPException(404, "Comanda no trobada")
        db.delete(order)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error intern en eliminar la comanda")


@app.patch("/orders/{order_id}/status", response_model=OrderOut)
def update_order_status(order_id: int, update: StatusUpdate, db: Session = Depends(get_db)):
    try:
        order = db.query(OrderORM).options(joinedload(OrderORM.items)).filter(OrderORM.id == order_id).first()
        if not order:
            raise HTTPException(404, "Comanda no trobada")
        order.status = update.status
        order.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(order)
        return order
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Error intern en actualitzar l'estat")