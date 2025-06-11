from fastapi import APIRouter
from typing import List
from ..schemas import (
    OptimizeRouteRequest,
    OptimizedRouteResponse,
    OptimizedRoute,
    Stop,
    VehicleInOptimization,
    OrderInOptimization,
)
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
import math

router = APIRouter()


def euclidean_distance(p1, p2):
    """Return approximate great-circle distance in kilometers."""
    lat1 = math.radians(p1.latitude)
    lon1 = math.radians(p1.longitude)
    lat2 = math.radians(p2.latitude)
    lon2 = math.radians(p2.longitude)
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return 6371.0 * c


@router.post("/optimize_routes", response_model=OptimizedRouteResponse)
async def optimize_routes(request: OptimizeRouteRequest):
    orders = request.orders
    vehicles = request.vehicles

    # Build list of all locations
    locations = []
    start_indices = []
    end_indices = []
    for v in vehicles:
        start_indices.append(len(locations))
        locations.append(v.start_location)
        if v.end_location:
            end_indices.append(len(locations))
            locations.append(v.end_location)
        else:
            end_indices.append(start_indices[-1])

    pickup_drop_indices = []
    for o in orders:
        pickup_index = len(locations)
        locations.append(o.pickup_location)
        dropoff_index = len(locations)
        locations.append(o.dropoff_location)
        pickup_drop_indices.append((pickup_index, dropoff_index, o.id))

    # Distance matrix
    size = len(locations)
    distance_matrix = [[0]*size for _ in range(size)]
    for i in range(size):
        for j in range(size):
            if i != j:
                distance_matrix[i][j] = int(euclidean_distance(locations[i], locations[j]) * 1000)

    manager = pywrapcp.RoutingIndexManager(size, len(vehicles), start_indices, end_indices)
    routing = pywrapcp.RoutingModel(manager)

    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    routing.AddDimension(
        transit_callback_index, 0, 1000000, True, "Distance"
    )
    distance_dimension = routing.GetDimensionOrDie("Distance")

    for pickup_idx, drop_idx, oid in pickup_drop_indices:
        pickup_i = manager.NodeToIndex(pickup_idx)
        drop_i = manager.NodeToIndex(drop_idx)
        routing.AddPickupAndDelivery(pickup_i, drop_i)
        routing.solver().Add(
            routing.VehicleVar(pickup_i) == routing.VehicleVar(drop_i)
        )
        routing.solver().Add(
            distance_dimension.CumulVar(pickup_i)
            <= distance_dimension.CumulVar(drop_i)
        )

    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_parameters.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_parameters)

    optimized_routes: List[OptimizedRoute] = []
    unassigned_orders: List[int] = []

    if solution:
        order_assigned = {o.id: False for o in orders}
        for vehicle_id in range(len(vehicles)):
            index = routing.Start(vehicle_id)
            stops: List[Stop] = []
            while not routing.IsEnd(index):
                node = manager.IndexToNode(index)
                # Check if node corresponds to pickup or dropoff
                for p_idx, d_idx, oid in pickup_drop_indices:
                    if node == p_idx:
                        stops.append(Stop(order_id=oid, location=locations[node], type="pickup"))
                        order_assigned[oid] = True
                    elif node == d_idx:
                        stops.append(Stop(order_id=oid, location=locations[node], type="dropoff"))
                index = solution.Value(routing.NextVar(index))
            total_dist = solution.Value(distance_dimension.CumulVar(routing.End(vehicle_id))) / 1000.0
            optimized_routes.append(
                OptimizedRoute(
                    vehicle_id=vehicles[vehicle_id].id,
                    stops=stops,
                    total_distance=total_dist,
                )
            )
        unassigned_orders = [oid for oid, assigned in order_assigned.items() if not assigned]
    else:
        unassigned_orders = [o.id for o in orders]

    return OptimizedRouteResponse(optimized_routes=optimized_routes, unassigned_orders=unassigned_orders)