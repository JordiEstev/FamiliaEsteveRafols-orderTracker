from datetime import datetime
from typing import List, Optional, Literal
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator, Field
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, ForeignKey,
    Text, DateTime
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session

from fastapi.middleware.cors import CORSMiddleware

# ---------- Config ----------
DATABASE_URL = "sqlite:///./orders.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()

# ---------- ORM Models ----------
class OrderORM(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    customer = Column(String, nullable=False)
    date = Column(String, index=True)  # 'YYYY-MM-DD'
    place = Column(String, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)
    items = relationship("OrderItemORM", back_populates="order", cascade="all, delete-orphan")

class OrderItemORM(Base):
    __tablename__ = "order_items"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id", ondelete="CASCADE"), index=True)
    fruit = Column(String, index=True)          # pressec_groc, pressec_vermell, albercoc, cirera, melo, sindria
    size = Column(Integer, nullable=True)       # only for pressec_*
    qty = Column(Integer, nullable=False)       # boxes / units / pieces
    weight = Column(Float, nullable=True)       # per-unit (albercoc/cirera) OR total (melo/sindria)
    order = relationship("OrderORM", back_populates="items")

Base.metadata.create_all(bind=engine)

# ---------- Pydantic Schemas ----------

FruitCode = Literal["pressec_groc", "pressec_vermell", "albercoc", "cirera", "melo", "sindria"]
PlaceName = Literal["Cantallops", "Magatzem", "Botiga Centre", "Botiga Nord"]

class FruitItemIn(BaseModel):
    fruit: FruitCode
    qty: int = Field(..., gt=0)
    size: Optional[int] = None
    weight: Optional[float] = None  # semantics depend on fruit

    @validator("size")
    def validate_size(cls, v, values):
        fruit = values.get("fruit")
        if fruit and fruit.startswith("pressec"):
            if v not in {16, 18, 20, 22, 24, 26}:
                raise ValueError("Pressec size must be one of 16,18,20,22,24,26")
        else:
            if v is not None:
                raise ValueError("Size only allowed for pressec")
        return v

    @validator("weight")
    def validate_weight(cls, v, values):
        fruit = values.get("fruit")
        if fruit in {"albercoc", "cirera"}:
            if v not in {1, 2}:
                raise ValueError("For albercoc/cirera weight must be 1 or 2 (kg per unit)")
        elif fruit in {"melo", "sindria"}:
            if v is not None and v <= 0:
                raise ValueError("Total weight for melo/sindria must be > 0")
        else:  # pressec_*
            if v is not None:
                raise ValueError("Weight not used for pressec")
        return v

class FruitItemOut(FruitItemIn):
    id: int
    class Config:
        orm_mode = True

class OrderCreate(BaseModel):
    customer: str
    date: str
    place: PlaceName
    notes: Optional[str] = ""
    fruits: List[FruitItemIn]

    @validator("date")
    def validate_date(cls, v):
        from datetime import datetime
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("date must be YYYY-MM-DD")
        return v

class OrderOut(BaseModel):
    id: int
    customer: str
    date: str
    place: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    fruits: List[FruitItemOut]

    class Config:
        orm_mode = True

# ---------- FastAPI ----------
app = FastAPI(title="Fruit Order Tracker (Simplified)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ---------- Routes ----------

@app.post("/orders", response_model=OrderOut)
def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    orm_order = OrderORM(
        customer=order.customer,
        date=order.date,
        place=order.place,
        notes=order.notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    db.add(orm_order)
    db.flush()

    for fi in order.fruits:
        item = OrderItemORM(
            order_id=orm_order.id,
            fruit=fi.fruit,
            size=fi.size,
            qty=fi.qty,
            weight=fi.weight
        )
        db.add(item)

    db.commit()
    db.refresh(orm_order)
    return orm_order

@app.get("/orders", response_model=List[OrderOut])
def list_orders(
    db: Session = Depends(get_db),
    date: Optional[str] = Query(None),
    place: Optional[str] = Query(None),
    fruit: Optional[str] = Query(None)
):
    q = db.query(OrderORM)
    if date:
        q = q.filter(OrderORM.date == date)
    if place:
        q = q.filter(OrderORM.place == place)
    orders = q.order_by(OrderORM.created_at.desc()).all()

    if fruit:
        filtered = []
        for o in orders:
            o.items = [it for it in o.items if it.fruit == fruit]
            if o.items:
                filtered.append(o)
        orders = filtered
    return orders

@app.delete("/orders/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    db.delete(order)
    db.commit()
    return None