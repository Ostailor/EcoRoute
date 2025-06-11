## Frontend Integration: Visualizing Optimized Routes on the Map

Now that the backend route optimization (including LightGBM for time/distance estimations) is functional, the next critical step is to integrate these optimized routes into the frontend map view. This will provide users with a visual representation of the planned deliveries.

### Detailed Steps:

1.  **Update `frontend/src/app/vehicles/page.tsx`:**
    *   **State Management:** Introduce new state variables to `page.tsx` to store the fetched `optimizedRoutes` and `unassignedOrders` from the backend.
    *   **User Interaction for Optimization:**
        *   Add a new button, e.g., "Optimize Routes", to the `/vehicles` page.
        *   When this button is clicked, gather the currently available orders and vehicles from the frontend state.
        *   Make a `POST` request to your backend's `/optimize_routes` endpoint, sending the gathered orders and vehicles in the format expected by `OptimizeRouteRequest`.
        *   Handle the response: Store the `optimizedRoutes` and `unassignedOrders` in the new state variables. Implement basic error handling for failed requests.

2.  **Enhance `frontend/src/app/vehicles/MapWrapper.tsx`:**
    *   **New Props:** Modify the `MapWrapperProps` interface to accept `optimizedRoutes: OptimizedRoute[]` and `unassignedOrders: number[]` as new props.
    *   **Drawing Polylines:**
        *   Use `react-leaflet`'s `<Polyline>` component to draw each optimized route. Iterate through the `optimizedRoutes` prop.
        *   For each `OptimizedRoute`, extract the `location` (latitude, longitude) of each `stop` and use these points to define the `positions` prop of the `<Polyline>`.
        *   Assign a distinct color or style to each polyline (e.g., using `vehicle_id` to generate a color, or cycling through a predefined set of colors).
        *   Consider adding tooltips or popups to polylines showing `total_distance` and `total_time`.
    *   **Visualizing Stops (Recommended):**
        *   Within each `OptimizedRoute`'s `Polyline` rendering, iterate through its `stops`.
        *   For each `stop`, render an additional `<Marker>` at its `location`.
        *   Use different icons or colors for "pickup" stops vs. "dropoff" stops (e.g., green for pickup, red for dropoff).
        *   Add a `Popup` to these stop markers to display `order_id` and `type` of stop.
    *   **Highlighting Unassigned Orders:** If `unassignedOrders` are present, consider visually highlighting the corresponding order markers on the map (e.g., with a distinct color or icon) to indicate they were not included in an optimized route.

3.  **Refine Pydantic Models (if necessary):**
    *   Review `backend/schemas.py` to ensure the `OptimizedRouteResponse` and its nested models (`OptimizedRoute`, `Stop`, `Location`) are precisely aligned with the data structure you're receiving from the backend and expect to use in the frontend. Ensure all fields are correctly typed (e.g., `total_distance` and `total_time` are `float`, not `None`).

4.  **Backend Considerations (Minor Adjustments):**
    *   Ensure your backend's `optimize_routes` endpoint is correctly populating `total_distance` and `total_time` from LightGBM's predictions, as these will be consumed by the frontend.
    *   Confirm that the `type` field in the `Stop` model (e.g., "pickup", "dropoff") is consistently set by the backend, as the frontend will use this for visualization.

By following these steps, users will be able to trigger route optimization and visually inspect the results on the map, enhancing the core value proposition of EcoRoute.
