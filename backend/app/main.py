from datetime import datetime
from typing import List, Optional, Literal
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator, Field, ConfigDict
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, ForeignKey,
    Text, DateTime
)
from sqlalchemy.orm import declarative_base, relationship, sessionmaker, Session
from sqlalchemy.orm import joinedload

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


# ---- Pydantic Response Models ----

class OrderItem(BaseModel):
    fruit: str
    size: Optional[int] = None
    qty: int
    weight: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)

class Order(BaseModel):
    id: int
    customer: str
    date: str
    place: str
    notes: Optional[str] = None
    fruits: List[OrderItem]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------- Pydantic Schemas ----------

FruitCode = Literal["pressec_groc", "pressec_vermell", "pressec_barrejat", "albercoc", "cirera", "melo", "sindria"]
PlaceName = Literal["Cantallops", "Sant Pau", "Vilafranca", "La Girada"]

class FruitItemIn(BaseModel):
    fruit: FruitCode
    qty: int = Field(..., gt=0)
    size: Optional[int] = None
    weight: Optional[float] = None  # semantics depend on fruit

    @validator("size")
    def validate_size(cls, v, values):
        fruit = values.get("fruit")
        if fruit and fruit.startswith("pressec"):
            if v not in {15, 16, 18, 20, 22, 24, 26}:
                raise ValueError("Pressec size must be one of 15, 16,18,20,22,24,26")
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
    model_config = ConfigDict(from_attributes=True)


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
    allow_origins=["http://localhost:5173"],
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
    new_order = OrderORM(
        customer=order.customer,
        date=order.date,
        place=order.place,
        notes=order.notes,
        items=[
            OrderItemORM(
                fruit=item.fruit,
                size=item.size,
                qty=item.qty,
                weight=item.weight
            )
            for item in order.fruits
        ]
    )

    db.add(new_order)
    db.commit()
    db.refresh(new_order)

    return {
        "id": new_order.id,
        "customer": new_order.customer,
        "date": new_order.date,
        "place": new_order.place,
        "notes": new_order.notes,
        "created_at": new_order.created_at,
        "updated_at": new_order.updated_at,
        "fruits": new_order.items  
    }



@app.delete("/orders/{order_id}", status_code=204)
def delete_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    db.delete(order)
    db.commit()
    return None

@app.get("/orders", response_model=List[OrderOut])
def get_orders(db: Session = Depends(get_db)):
    orders = db.query(OrderORM).options(joinedload(OrderORM.items)).all()
    return [
        {
            "id": o.id,
            "customer": o.customer,
            "date": o.date,
            "place": o.place,
            "notes": o.notes,
            "created_at": o.created_at,
            "updated_at": o.updated_at,
            "fruits": o.items
        }
        for o in orders
    ]

@app.put("/orders/{order_id}", response_model=OrderOut)
def update_order(order_id: int, order: OrderCreate, db: Session = Depends(get_db)):
    db_order = db.query(OrderORM).filter(OrderORM.id == order_id).first()
    if not db_order:
        raise HTTPException(404, "Order not found")

    # Update fields
    db_order.customer = order.customer
    db_order.date = order.date
    db_order.place = order.place
    db_order.notes = order.notes
    db_order.updated_at = datetime.utcnow()

    # Clear existing items
    db.query(OrderItemORM).filter(OrderItemORM.order_id == order_id).delete()

    # Add new items
    new_items = [
        OrderItemORM(
            order_id=order_id,
            fruit=item.fruit,
            size=item.size,
            qty=item.qty,
            weight=item.weight
        )
        for item in order.fruits
    ]
    db.add_all(new_items)
    db.commit()
    db.refresh(db_order)

    return {
        "id": db_order.id,
        "customer": db_order.customer,
        "date": db_order.date,
        "place": db_order.place,
        "notes": db_order.notes,
        "created_at": db_order.created_at,
        "updated_at": db_order.updated_at,
        "fruits": db_order.items
    }
