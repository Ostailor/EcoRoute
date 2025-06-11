## Route Optimization Implementation Plan

The next major step is to implement the route optimization logic on the backend. This involves defining the optimization problem, integrating OR-Tools for solving the Vehicle Routing Problem (VRP), and setting up the necessary API endpoints.

### Detailed Steps:

1.  **Backend Module Structure:**
    *   Create a new directory and module, e.g., `backend/routers/optimization.py`, to house the route optimization API endpoints and logic.
    *   Integrate this new router into `backend/main.py`.

2.  **Pydantic Models for Request and Response:**
    *   Define input models in `backend/schemas.py`:
        *   `Location (latitude: float, longitude: float)`: A reusable model for geographical coordinates.
        *   `OrderInOptimization (id: int, pickup_location: Location, dropoff_location: Location)`: Represents an order with its relevant locations for optimization.
        *   `VehicleInOptimization (id: int, start_location: Location, end_location: Location = None)`: Represents a vehicle with its starting and optional ending location for optimization.
        *   `OptimizeRouteRequest (orders: List[OrderInOptimization], vehicles: List[VehicleInOptimization])`: The main request body for the optimization endpoint.
    *   Define output models in `backend/schemas.py`:
        *   `Stop (order_id: int, location: Location, type: str)`: Represents a single stop in a route (e.g., "pickup", "dropoff").
        *   `OptimizedRoute (vehicle_id: int, stops: List[Stop], total_distance: float = None, total_time: float = None)`: Represents an optimized route for a single vehicle.
        *   `OptimizedRouteResponse (optimized_routes: List[OptimizedRoute], unassigned_orders: List[int] = None)`: The overall response for the optimization endpoint.

3.  **Route Optimization Endpoint (`POST /optimize_routes`):**
    *   Implement a new asynchronous endpoint in `backend/routers/optimization.py`:
        ```python
        @router.post("/optimize_routes", response_model=OptimizedRouteResponse)
        async def optimize_routes(request: OptimizeRouteRequest):
            # Optimization logic will go here
            pass
        ```
    *   This endpoint will:
        *   Receive a list of orders and available vehicles.
        *   Utilize the OR-Tools library to solve a basic Vehicle Routing Problem (VRP) to determine the optimal sequence of pickups and dropoffs for each vehicle.
        *   Initially, use Euclidean distance for simplicity. We can integrate a proper mapping service (e.g., OpenStreetMap, Google Maps API) for real road distances in a later iteration.
        *   Map the OR-Tools solution back to the `OptimizedRouteResponse` Pydantic model.
        *   Return the optimized routes and any unassigned orders.

4.  **Initial OR-Tools Integration Logic:**
    *   Inside the `optimize_routes` endpoint, set up the OR-Tools routing model:
        *   Create a `routing_index_manager`.
        *   Create a `routing_model`.
        *   Define the transit callback (distance callback) using the locations from orders and vehicles.
        *   Add a dimension for distance (and potentially time later).
        *   Add capacity constraints if applicable (e.g., number of orders per vehicle).
        *   Add pickup and delivery pairs for orders.
        *   Set search parameters and solve the model.
        *   Parse the solution to populate the `OptimizedRouteResponse`.

5.  **LightGBM Integration (Future Consideration):**
    *   While LightGBM is part of the project's tech stack, its direct integration into the *initial* route optimization will be deferred.
    *   It could be used in future iterations for advanced features such as:
        *   Predicting more accurate travel times based on historical traffic data.
        *   Predicting delivery success rates or risks for different routes.
        *   Estimating fuel consumption or emissions for sustainability optimization.
