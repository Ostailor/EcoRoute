from fastapi import FastAPI, HTTPException, Depends, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import NoResultFound
from pydantic import BaseModel
from typing import List
from .models import Order as OrderModel, Vehicle as VehicleModel
from .database import async_session_maker
from .routers.optimization import router as optimization_router
from sqlalchemy import text
import socketio

app = FastAPI()
app.include_router(optimization_router)

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # or ["*"] for all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class OrderBase(BaseModel):
    customer_name: str
    pickup_address: str
    dropoff_address: str
    status: str = "pending"
    pickup_lat: float | None = None
    pickup_lng: float | None = None
    dropoff_lat: float | None = None
    dropoff_lng: float | None = None

class OrderCreate(OrderBase):
    id: int

class OrderRead(OrderBase):
    id: int

class VehicleBase(BaseModel):
    name: str
    status: str = "idle"
    current_lat: float | None = None
    current_lng: float | None = None

class VehicleCreate(VehicleBase):
    id: int

class VehicleRead(VehicleBase):
    id: int

class TelemetryUpdate(BaseModel):
    current_lat: float
    current_lng: float
    status: str | None = None

async def get_session():
    async with async_session_maker() as session:
        yield session

@sio.event
async def connect(sid, environ):
    print("connect ", sid)

@sio.event
async def disconnect(sid):
    print("disconnect ", sid)

@app.get("/")
async def health_check():
    return {"status": "ok"}

@app.post("/orders", response_model=OrderRead)
async def create_order(order: OrderCreate, session: AsyncSession = Depends(get_session)):
    db_order = await session.get(OrderModel, order.id)
    if db_order:
        raise HTTPException(status_code=400, detail="Order with this ID already exists.")
    db_order = OrderModel(**order.dict())
    session.add(db_order)
    await session.commit()
    await session.refresh(db_order)
    return db_order

@app.get("/orders", response_model=List[OrderRead])
async def list_orders(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = None,
    customer_name: str | None = None,
):
    stmt = select(OrderModel)
    if status:
        stmt = stmt.where(OrderModel.status == status)
    if customer_name:
        stmt = stmt.where(OrderModel.customer_name.ilike(f"%{customer_name}%"))
    stmt = stmt.offset(offset).limit(limit)
    result = await session.execute(stmt)
    orders = result.scalars().all()
    return orders

@app.get("/orders/{order_id}", response_model=OrderRead)
async def get_order(order_id: int, session: AsyncSession = Depends(get_session)):
    order = await session.get(OrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found.")
    return order

@app.put("/orders/{order_id}", response_model=OrderRead)
async def update_order(order_id: int, updated_order: OrderCreate, session: AsyncSession = Depends(get_session)):
    db_order = await session.get(OrderModel, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found.")
    for field, value in updated_order.dict().items():
        setattr(db_order, field, value)
    await session.commit()
    await session.refresh(db_order)
    return db_order

@app.delete("/orders/{order_id}")
async def delete_order(order_id: int, session: AsyncSession = Depends(get_session)):
    db_order = await session.get(OrderModel, order_id)
    if not db_order:
        raise HTTPException(status_code=404, detail="Order not found.")
    await session.delete(db_order)
    await session.commit()
    return {"detail": "Order deleted."}

@app.get("/orders/nearby", response_model=List[OrderRead])
async def get_orders_nearby(
    lat: float = Query(..., description="Latitude of the center point"),
    lng: float = Query(..., description="Longitude of the center point"),
    radius_km: float = Query(5, description="Radius in kilometers"),
    session: AsyncSession = Depends(get_session),
):
    # Use raw SQL for PostGIS distance query
    sql = text('''
        SELECT * FROM orders
        WHERE pickup_lat IS NOT NULL AND pickup_lng IS NOT NULL
        AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(pickup_lng, pickup_lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
            :radius_m
        )
    ''')
    result = await session.execute(sql, {"lat": lat, "lng": lng, "radius_m": radius_km * 1000})
    orders = result.fetchall()
    # Convert to list of dicts for Pydantic
    return [OrderRead(**dict(row)) for row in orders]

@app.post("/vehicles", response_model=VehicleRead)
async def create_vehicle(vehicle: VehicleCreate, session: AsyncSession = Depends(get_session)):
    db_vehicle = await session.get(VehicleModel, vehicle.id)
    if db_vehicle:
        raise HTTPException(status_code=400, detail="Vehicle with this ID already exists.")
    db_vehicle = VehicleModel(**vehicle.dict())
    session.add(db_vehicle)
    await session.commit()
    await session.refresh(db_vehicle)
    return db_vehicle

@app.get("/vehicles", response_model=List[VehicleRead])
async def list_vehicles(
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: str | None = None,
    name: str | None = None,
):
    stmt = select(VehicleModel)
    if status:
        stmt = stmt.where(VehicleModel.status == status)
    if name:
        stmt = stmt.where(VehicleModel.name.ilike(f"%{name}%"))
    stmt = stmt.offset(offset).limit(limit)
    result = await session.execute(stmt)
    vehicles = result.scalars().all()
    return vehicles

@app.get("/vehicles/{vehicle_id}", response_model=VehicleRead)
async def get_vehicle(vehicle_id: int, session: AsyncSession = Depends(get_session)):
    vehicle = await session.get(VehicleModel, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    return vehicle

@app.put("/vehicles/{vehicle_id}", response_model=VehicleRead)
async def update_vehicle(vehicle_id: int, updated_vehicle: VehicleCreate, session: AsyncSession = Depends(get_session)):
    db_vehicle = await session.get(VehicleModel, vehicle_id)
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    for field, value in updated_vehicle.dict().items():
        setattr(db_vehicle, field, value)
    await session.commit()
    await session.refresh(db_vehicle)
    return db_vehicle

@app.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: int, session: AsyncSession = Depends(get_session)):
    db_vehicle = await session.get(VehicleModel, vehicle_id)
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    await session.delete(db_vehicle)
    await session.commit()
    return {"detail": "Vehicle deleted."}

@app.post("/vehicles/{vehicle_id}/telemetry", response_model=VehicleRead)
async def update_vehicle_telemetry(
    vehicle_id: int,
    telemetry: TelemetryUpdate = Body(...),
    session: AsyncSession = Depends(get_session),
):
    db_vehicle = await session.get(VehicleModel, vehicle_id)
    if not db_vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found.")
    db_vehicle.current_lat = telemetry.current_lat
    db_vehicle.current_lng = telemetry.current_lng
    if telemetry.status is not None:
        db_vehicle.status = telemetry.status
    await session.commit()
    await session.refresh(db_vehicle)
    # Convert SQLAlchemy model to Pydantic model before emitting
    await sio.emit("vehicle_update", VehicleRead.model_validate(db_vehicle, from_attributes=True).model_dump())
    return db_vehicle 

# Mount the Socket.IO app to the FastAPI app under a specific path
app = socketio.ASGIApp(sio, other_asgi_app=app)