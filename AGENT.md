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

5.  **LightGBM Integration for Enhanced Time/Distance Calculations:**
    *   **Objective:** The primary goal is to move beyond simple Euclidean distance to more realistic travel time and distance estimations by leveraging LightGBM's predictive capabilities. This will enable the `total_distance` and `total_time` fields in `OptimizedRoute` to be populated with meaningful data.

    *   **LightGBM Setup:**
        *   Install the `lightgbm` Python package: `pip install lightgbm`.
        *   For demonstration purposes, create a placeholder or simulated LightGBM model. This model will not be trained on real-world data initially, but will simulate predicting travel times/distances based on simple features (e.g., Euclidean distance, hypothetical road types).

    *   **Data Simulation for LightGBM (Initial):**
        *   Since real-time traffic data or extensive historical route data is out of scope for initial setup, we will create a *dummy dataset* and a *simple LightGBM model* that takes Euclidean distance as input and outputs a slightly modified "predicted" travel time or distance. This allows us to integrate the model without needing complex data pipelines immediately.

    *   **Integration into OR-Tools (Updating Callbacks):**
        *   **Modify the `distance_callback`:** The existing `distance_callback` will be updated to utilize the LightGBM model's predictions. Instead of directly returning Euclidean distance, it will pass features (like Euclidean distance) to the LightGBM model and return its prediction for travel distance/time.
        *   **Add a `time_callback` (if distinct):** If we want to optimize for both distance and time, a separate `time_callback` can be registered with OR-Tools, also leveraging LightGBM's predictions.
        *   **Update OR-Tools Dimensions:** Ensure OR-Tools dimensions (`AddDimension`) are correctly set up to use these new predictive callbacks for both distance and time.

    *   **Populating Response Models:**
        *   The `total_distance` and `total_time` fields in the `OptimizedRoute` model will be populated with the values derived from the OR-Tools solution, which will now be based on LightGBM's predictions.
