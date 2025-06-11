"use client";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import L, { LatLngExpression, Marker as LeafletMarker } from "leaflet";
import globeUrl from '/public/globe.svg';

interface Vehicle {
  id: number;
  name: string;
  status: string;
  current_lat: number | null;
  current_lng: number | null;
}

interface MapWrapperProps {
  vehicles: Vehicle[];
  selectedVehicleId: number | null;
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

export default function MapWrapper({ vehicles, selectedVehicleId }: MapWrapperProps) {
  const center: LatLngExpression = [0, 0]; // Default center

  // Store refs to LeafletMarker instances
  const markerRefs = useRef<{ [id: number]: LeafletMarker | null }>({});

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
    }, [selectedVehicleId, map, vehicles]);

    // Effect for updating all markers' positions, icons, and open popup content
    useEffect(() => {
      vehicles.forEach(v => {
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
    }, [vehicles, selectedVehicleId, map]);

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
          ref={(instance: any) => {
            if (instance && instance.leafletElement) {
              markerRefs.current[v.id] = instance.leafletElement as LeafletMarker; // Explicitly cast to LeafletMarker
            } else {
              delete markerRefs.current[v.id];
            }
          }}
        >
          {/* Key on Popup to force re-mount and re-render when vehicle status/location changes */}
          <Popup key={`${v.id}-${v.status}-${v.current_lat}-${v.current_lng}`}>
            <div>
              <div className="font-bold">{v.name}</div>
              <div>Status: {v.status}</div>
              <div>Lat: {v.current_lat}, Lng: {v.current_lng}</div>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
} 