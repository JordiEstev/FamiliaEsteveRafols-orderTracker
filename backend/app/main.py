from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import sqlite3

app = FastAPI()

# Allow frontend to connect (Vite runs on port 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create DB and orders table if not exists
conn = sqlite3.connect("database.db")
cursor = conn.cursor()
cursor.execute("""
    CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        fruits TEXT NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'pending'
    )
""")
conn.commit()


@app.get("/orders")
def get_orders():
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    cursor.execute("SELECT id, customer_name, fruits, notes, status FROM orders")
    rows = cursor.fetchall()
    orders = []
    for row in rows:
        orders.append({
            "id": row[0],
            "customer_name": row[1],
            "fruits": row[2],
            "notes": row[3],
            "status": row[4]
        })
    return orders


@app.post("/orders")
def create_order(order: dict):
    conn = sqlite3.connect("database.db")
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO orders (customer_name, fruits, notes, status)
        VALUES (?, ?, ?, ?)
    """, (order["customer_name"], order["fruits"], order.get("notes", ""), order.get("status", "pending")))
    conn.commit()
    return {"message": "Order created successfully"}