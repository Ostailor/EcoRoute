"use client";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, Fragment } from "react";
import L, { LatLngExpression, Marker as LeafletMarker } from "leaflet";

interface Vehicle {
  id: number;
  name: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
}

interface Location {
  latitude: number;
  longitude: number;
}

interface Stop {
  order_id: number;
  location: Location;
  type: string;
}

interface Order {
  id: number;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
}

interface OptimizedRoute {
  vehicle_id: number;
  stops: Stop[];
  total_distance?: number | null;
  total_time?: number | null;
}

interface MapWrapperProps {
  vehicles: Vehicle[];
  selectedVehicleId: number | null;
  optimizedRoutes: OptimizedRoute[];
  unassignedOrders: number[];
  orders: Order[];
}

// Move getDivIcon outside the component to avoid it being recreated on every render
function getDivIcon(name: string, highlight: boolean) {
  return L.divIcon({
    className: '',
    html: `
      <div style="display: flex; align-items: center; gap: 4px;">
        <svg width="28" height="38" viewBox="0 0 28 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M14 0C6.268 0 0 6.268 0 14c0 9.94 12.25 23.25 12.75 23.75a2 2 0 0 0 2.5 0C15.75 37.25 28 23.94 28 14 28 6.268 21.732 0 14 0zm0 19a5 5 0 1 1 0-10 5 5 0 0 1 0 10z" fill="${highlight ? '#2563eb' : '#ef4444'}"/>
        </svg>
        <span style="background: white; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-weight: 600; color: #222; box-shadow: 0 1px 4px rgba(0,0,0,0.08);">` + name + `</span>
      </div>
    `,
    iconAnchor: [14, 38],
    popupAnchor: [0, -38],
  });
}

export default function MapWrapper({ vehicles, selectedVehicleId, optimizedRoutes, unassignedOrders, orders }: MapWrapperProps) {
  const center: LatLngExpression = [0, 0]; // Default center

  // Store refs to LeafletMarker instances
  const markerRefs = useRef<{ [id: number]: LeafletMarker | null }>({});

  useEffect(() => {
    if (unassignedOrders.length > 0) {
      console.log("Unassigned orders", unassignedOrders);
    }
  }, [unassignedOrders]);

  function MapEffectsAndUpdates() {
    const map = useMap();

    // Effect for centering map on selected vehicle and opening its popup
    useEffect(() => {
      if (selectedVehicleId) {
        const v = vehicles.find(v => v.id === selectedVehicleId);
        if (v && v.current_lat != null && v.current_lng != null) {
          map.setView([v.current_lat, v.current_lng], map.getZoom(), { animate: true });
          const markerInstance = markerRefs.current[v.id];
          if (markerInstance) {
            markerInstance.openPopup();
          }
        }
      }
    }, 
    [selectedVehicleId, map, vehicles]);

    // Effect for updating all markers' positions, icons, and open popup content
    useEffect(() => {
      vehicles.forEach((v) => {
        const markerInstance = markerRefs.current[v.id];
        if (markerInstance && v.current_lat != null && v.current_lng != null) {
          const newLatLng: LatLngExpression = [v.current_lat, v.current_lng];
          const newIcon = getDivIcon(v.name, selectedVehicleId === v.id);

          // Update position if changed
          if (!markerInstance.getLatLng().equals(newLatLng)) {
            markerInstance.setLatLng(newLatLng);
          }

          // Update icon (important for label and color)
          markerInstance.setIcon(newIcon);

          // Explicitly update popup content if the popup is currently open
          const popup = markerInstance.getPopup();
          if (popup && popup.isOpen()) {
            popup.setContent(`
              <div>
                <div class="font-bold">${v.name}</div>
                <div>Status: ${v.status}</div>
                <div>Lat: ${v.current_lat}, Lng: ${v.current_lng}</div>
              </div>
            `);
            // Re-open the popup to ensure it re-renders with new content
            markerInstance.openPopup();
          }
        }
      });
    }, 
    [vehicles, selectedVehicleId, map]);

    useEffect(() => {
      const points: LatLngExpression[] = [];

      vehicles.forEach((v) => {
        if (v.current_lat != null && v.current_lng != null) {
          points.push([v.current_lat, v.current_lng]);
        }
      });

      optimizedRoutes.forEach((route) => {
        route.stops.forEach((stop) => {
          points.push([stop.location.latitude, stop.location.longitude]);
        });
      });

      orders
        .filter((o) => unassignedOrders.includes(o.id))
        .forEach((o) => {
          if (o.pickup_lat != null && o.pickup_lng != null) {
            points.push([o.pickup_lat, o.pickup_lng]);
          }
          if (o.dropoff_lat != null && o.dropoff_lng != null) {
            points.push([o.dropoff_lat, o.dropoff_lng]);
          }
        });

      if (points.length === 1) {
        map.setView(points[0], map.getZoom(), { animate: true });
      } else if (points.length > 1) {
        // Convert to LatLngTuple array for fitBounds
        map.fitBounds(points as [number, number][], { padding: [20, 20] });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optimizedRoutes, unassignedOrders, vehicles]);


    return null;
  }

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "350px", width: "100%" }}
      scrollWheelZoom={true}
    >
      <MapEffectsAndUpdates />
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {vehicles.filter(v => v.current_lat != null && v.current_lng != null).map(v => (
        <Marker
          key={v.id} // Key for Marker to force re-render if vehicle ID changes (rare)
          position={[v.current_lat!, v.current_lng!] as LatLngExpression}
          icon={getDivIcon(v.name, selectedVehicleId === v.id)}
          ref={(instance: LeafletMarker | null) => {
            if (instance) {
              markerRefs.current[v.id] = instance;
            } else {
              delete markerRefs.current[v.id];
            }
          }}
        >
          {/* Popup content will be updated via useEffect when vehicle data changes */}
          <Popup>
            <div>
              <div className="font-bold">{v.name}</div>
              <div>Status: {v.status}</div>
              <div>Lat: {v.current_lat}, Lng: {v.current_lng}</div>
            </div>
          </Popup>
        </Marker>
      ))}

      {optimizedRoutes.map((route, idx) => {
        const positions = route.stops.map((s) => [s.location.latitude, s.location.longitude] as LatLngExpression);
        const colors = ["#1d4ed8", "#15803d", "#b91c1c", "#a21caf", "#be123c"];
        const color = colors[idx % colors.length];
        return (
          <Fragment key={route.vehicle_id}>
            <Polyline positions={positions} pathOptions={{ color }}>
              <Popup>
                <div>
                  <div className="font-bold">Vehicle {route.vehicle_id}</div>
                  {route.total_distance != null && (
                    <div>Distance: {route.total_distance.toFixed(2)} km</div>
                  )}
                  {route.total_time != null && (
                    <div>Time: {route.total_time.toFixed(2)} hr</div>
                  )}
                </div>
              </Popup>
            </Polyline>
            {route.stops.map((stop, sidx) => (
              <CircleMarker
                key={`${route.vehicle_id}-${sidx}`}
                center={[stop.location.latitude, stop.location.longitude] as LatLngExpression}
                pathOptions={{ color: stop.type === "pickup" ? "green" : "red" }}
                radius={6}
              >
                <Popup>
                  Order {stop.order_id} ({stop.type})
                </Popup>
              </CircleMarker>
            ))}
          </Fragment>
        );
      })}

      {orders
        .filter((o) => unassignedOrders.includes(o.id))
        .map((o) => (
          <Fragment key={`unassigned-${o.id}`}>
            {o.pickup_lat != null && o.pickup_lng != null && (
              <CircleMarker
                center={[o.pickup_lat, o.pickup_lng] as LatLngExpression}
                pathOptions={{ color: "#eab308" }}
                radius={5}
              >
                <Popup>Order {o.id} pickup (unassigned)</Popup>
              </CircleMarker>
            )}
            {o.dropoff_lat != null && o.dropoff_lng != null && (
              <CircleMarker
                center={[o.dropoff_lat, o.dropoff_lng] as LatLngExpression}
                pathOptions={{ color: "#f59e0b" }}
                radius={5}
              >
                <Popup>Order {o.id} dropoff (unassigned)</Popup>
              </CircleMarker>
            )}
          </Fragment>
        ))}
    </MapContainer>
  );
}
