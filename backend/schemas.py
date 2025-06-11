from pydantic import BaseModel
from typing import List, Optional

class Location(BaseModel):
    latitude: float
    longitude: float

class OrderInOptimization(BaseModel):
    id: int
    pickup_location: Location
    dropoff_location: Location

class VehicleInOptimization(BaseModel):
    id: int
    start_location: Location
    end_location: Optional[Location] = None

class OptimizeRouteRequest(BaseModel):
    orders: List[OrderInOptimization]
    vehicles: List[VehicleInOptimization]

class Stop(BaseModel):
    order_id: int
    location: Location
    type: str

class OptimizedRoute(BaseModel):
    vehicle_id: int
    stops: List[Stop]
    total_distance: Optional[float] = None
    total_time: Optional[float] = None

class OptimizedRouteResponse(BaseModel):
    optimized_routes: List[OptimizedRoute]
    unassigned_orders: Optional[List[int]] = None