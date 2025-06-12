"use client";
import { useEffect, useState, Fragment } from "react";
import "leaflet/dist/leaflet.css";
import dynamic from "next/dynamic";
import { io } from "socket.io-client";

interface Vehicle {
  id: number;
  name: string;
  status: string;
  current_lat?: number | null;
  current_lng?: number | null;
}

interface Order {
  id: number;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
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

interface OptimizedRoute {
  vehicle_id: number;
  stops: Stop[];
  total_distance?: number | null;
  total_time?: number | null;
}

const PAGE_SIZE = 5;

const MapWrapper = dynamic(() => import("./MapWrapper"), { ssr: false });

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    status: "idle",
    current_lat: "",
    current_lng: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    status: "idle",
    current_lat: "",
    current_lng: "",
  });
  const [editError, setEditError] = useState<string | null>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [optimizedRoutes, setOptimizedRoutes] = useState<OptimizedRoute[]>([]);
  const [unassignedOrders, setUnassignedOrders] = useState<number[]>([]);

  // Filtering and pagination state
  const [filterStatus, setFilterStatus] = useState("");
  const [filterName, setFilterName] = useState("");
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  const [telemetryId, setTelemetryId] = useState<number | null>(null);
  const [telemetryForm, setTelemetryForm] = useState({
    current_lat: "",
    current_lng: "",
    status: "",
  });
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);

  useEffect(() => {
    const socket = io("http://localhost:8000"); // Connect to backend Socket.IO server

    socket.on("connect", () => {
      console.log("Connected to Socket.IO");
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from Socket.IO");
    });

    socket.on("vehicle_update", (updatedVehicle: Vehicle) => {
      console.log("Received vehicle update:", updatedVehicle);
      setVehicles((prev) =>
        prev.map((v) => (v.id === updatedVehicle.id ? updatedVehicle : v))
      );
    });

    // Clean up on component unmount
    return () => {
      socket.disconnect();
    };
  }, []); // Run once on mount

  useEffect(() => {
    fetch("http://localhost:8000/orders?limit=100")
      .then((res) => res.json())
      .then((data) => setOrders(data))
      .catch(() => console.error("Could not fetch orders"));
  }, []);

  // Fetch vehicles with filters and pagination
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.append("limit", String(PAGE_SIZE + 1));
    params.append("offset", String(page * PAGE_SIZE));
    if (filterStatus) params.append("status", filterStatus);
    if (filterName) params.append("name", filterName);
    fetch(`http://localhost:8000/vehicles?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setHasNext(data.length > PAGE_SIZE);
        setVehicles(data.slice(0, PAGE_SIZE));
      })
      .catch(() => setError("Could not fetch vehicles"))
      .finally(() => setLoading(false));
  }, [filterStatus, filterName, page]);

  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.id || !form.name) {
      setFormError("ID and name are required.");
      return;
    }
    try {
      const res = await fetch("http://localhost:8000/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: Number(form.id),
          current_lat: form.current_lat ? Number(form.current_lat) : null,
          current_lng: form.current_lng ? Number(form.current_lng) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.detail || "Failed to create vehicle");
        return;
      }
      const newVehicle = await res.json();
      setVehicles((prev) => [...prev, newVehicle]);
      setForm({ id: "", name: "", status: "idle", current_lat: "", current_lng: "" });
    } catch {
      setFormError("Failed to create vehicle");
    }
  }

  async function handleDelete(id: number) {
    setVehicles((prev) => prev.filter((v) => v.id !== id));
    try {
      await fetch(`http://localhost:8000/vehicles/${id}`, { method: "DELETE" });
    } catch {
      setError("Failed to delete vehicle");
    }
  }

  function startEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setEditForm({
      name: vehicle.name,
      status: vehicle.status,
      current_lat: vehicle.current_lat?.toString() ?? "",
      current_lng: vehicle.current_lng?.toString() ?? "",
    });
    setEditError(null);
  }

  function handleEditChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  async function handleEditSubmit(e: React.FormEvent, id: number) {
    e.preventDefault();
    setEditError(null);
    if (!editForm.name) {
      setEditError("Name is required.");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/vehicles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...editForm,
          current_lat: editForm.current_lat ? Number(editForm.current_lat) : null,
          current_lng: editForm.current_lng ? Number(editForm.current_lng) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.detail || "Failed to update vehicle");
        return;
      }
      const updatedVehicle = await res.json();
      setVehicles((prev) => prev.map((v) => (v.id === id ? updatedVehicle : v)));
      setEditingId(null);
    } catch {
      setEditError("Failed to update vehicle");
    }
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function startTelemetry(vehicle: Vehicle) {
    setTelemetryId(vehicle.id);
    setTelemetryForm({
      current_lat: vehicle.current_lat?.toString() ?? "",
      current_lng: vehicle.current_lng?.toString() ?? "",
      status: vehicle.status,
    });
    setTelemetryError(null);
  }

  function handleTelemetryChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setTelemetryForm({ ...telemetryForm, [e.target.name]: e.target.value });
  }

  async function handleTelemetrySubmit(e: React.FormEvent, id: number) {
    e.preventDefault();
    setTelemetryError(null);
    if (!telemetryForm.current_lat || !telemetryForm.current_lng) {
      setTelemetryError("Latitude and longitude are required.");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/vehicles/${id}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          current_lat: Number(telemetryForm.current_lat),
          current_lng: Number(telemetryForm.current_lng),
          status: telemetryForm.status || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setTelemetryError(data.detail || "Failed to update telemetry");
        return;
      }
      const updatedVehicle = await res.json();
      setVehicles((prev) => prev.map((v) => (v.id === id ? updatedVehicle : v)));
      setTelemetryId(null);
    } catch {
      setTelemetryError("Failed to update telemetry");
    }
  }

  function handleCancelTelemetry() {
    setTelemetryId(null);
    setTelemetryError(null);
  }

  async function handleOptimizeRoutes() {
    setError(null);
    try {
      const orderPayload = orders
        .filter(
          (o) =>
            o.pickup_lat != null &&
            o.pickup_lng != null &&
            o.dropoff_lat != null &&
            o.dropoff_lng != null
        )
        .map((o) => ({
          id: o.id,
          pickup_location: { latitude: o.pickup_lat!, longitude: o.pickup_lng! },
          dropoff_location: { latitude: o.dropoff_lat!, longitude: o.dropoff_lng! },
        }));

      const vehiclePayload = vehicles
        .filter((v) => v.current_lat != null && v.current_lng != null)
        .map((v) => ({
          id: v.id,
          start_location: { latitude: v.current_lat!, longitude: v.current_lng! },
        }));

      const res = await fetch("http://localhost:8000/optimize_routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders: orderPayload, vehicles: vehiclePayload }),
      });
      if (!res.ok) throw new Error("Failed to optimize");
      const data = await res.json();
      setOptimizedRoutes(data.optimized_routes || []);
      setUnassignedOrders(data.unassigned_orders || []);
    } catch (err) {
      console.error(err);
      setError("Failed to optimize routes");
    }
  }



  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Vehicles</h1>
      {/* Filter form */}
      <form onSubmit={handleFilterSubmit} className="mb-4 flex gap-2 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-800 dark:text-gray-200">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border rounded px-2 py-1"
          >
            <option value="">All</option>
            <option value="idle">Idle</option>
            <option value="enroute">Enroute</option>
            <option value="charging">Charging</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-800 dark:text-gray-200">Name</label>
          <input
            type="text"
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            className="border rounded px-2 py-1"
            placeholder="Search name"
          />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded">Filter</button>
      </form>
      {/* Create form */}
      <form onSubmit={handleSubmit} className="mb-6 grid grid-cols-2 gap-2 bg-gray-50 dark:bg-gray-800 p-4 rounded">
        <input
          name="id"
          value={form.id}
          onChange={handleChange}
          placeholder="ID"
          className="border rounded px-2 py-1 col-span-1"
        />
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Name"
          className="border rounded px-2 py-1 col-span-1"
        />
        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="border rounded px-2 py-1 col-span-1"
        >
          <option value="idle">Idle</option>
          <option value="enroute">Enroute</option>
          <option value="charging">Charging</option>
          <option value="maintenance">Maintenance</option>
        </select>
        <input
          name="current_lat"
          value={form.current_lat}
          onChange={handleChange}
          placeholder="Latitude"
          className="border rounded px-2 py-1 col-span-1"
        />
        <input
          name="current_lng"
          value={form.current_lng}
          onChange={handleChange}
          placeholder="Longitude"
          className="border rounded px-2 py-1 col-span-1"
        />
        <button type="submit" className="bg-green-600 text-white px-3 py-1 rounded col-span-2">Add Vehicle</button>
        {formError && <div className="text-red-600 col-span-2">{formError}</div>}
      </form>
      {/* Map and optimization */}
      <div className="mb-6 space-y-2">
        <button
          type="button"
          onClick={handleOptimizeRoutes}
          className="bg-purple-600 text-white px-3 py-1 rounded"
        >
          Optimize Routes
        </button>
        <MapWrapper
          vehicles={vehicles}
          selectedVehicleId={selectedVehicleId}
          optimizedRoutes={optimizedRoutes}
          unassignedOrders={unassignedOrders}
          orders={orders}
        />
      </div>
      {/* List vehicles */}
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : (
        <table className="w-full border rounded mb-4">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="p-2 text-left">ID</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">Lat</th>
              <th className="p-2 text-left">Lng</th>
              <th className="p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => (
              <Fragment key={vehicle.id}>
                <tr
                  className={`border-t cursor-pointer ${selectedVehicleId === vehicle.id ? 'bg-blue-100 dark:bg-blue-800' : ''}`}
                  onClick={() => setSelectedVehicleId(vehicle.id)}
                >
                  <td className="p-2">{vehicle.id}</td>
                  <td className="p-2">
                    {editingId === vehicle.id ? (
                      <input
                        name="name"
                        value={editForm.name}
                        onChange={handleEditChange}
                        className="border rounded px-2 py-1"
                      />
                    ) : (
                      vehicle.name
                    )}
                  </td>
                  <td className="p-2">
                    {editingId === vehicle.id ? (
                      <select
                        name="status"
                        value={editForm.status}
                        onChange={handleEditChange}
                        className="border rounded px-2 py-1"
                      >
                        <option value="idle">Idle</option>
                        <option value="enroute">Enroute</option>
                        <option value="charging">Charging</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                    ) : (
                      vehicle.status
                    )}
                  </td>
                  <td className="p-2">
                    {editingId === vehicle.id ? (
                      <input
                        name="current_lat"
                        value={editForm.current_lat}
                        onChange={handleEditChange}
                        className="border rounded px-2 py-1"
                      />
                    ) : (
                      vehicle.current_lat ?? ""
                    )}
                  </td>
                  <td className="p-2">
                    {editingId === vehicle.id ? (
                      <input
                        name="current_lng"
                        value={editForm.current_lng}
                        onChange={handleEditChange}
                        className="border rounded px-2 py-1"
                      />
                    ) : (
                      vehicle.current_lng ?? ""
                    )}
                  </td>
                  <td className="p-2 flex gap-2">
                    {editingId === vehicle.id ? (
                      <>
                        <button
                          onClick={(e) => handleEditSubmit(e, vehicle.id)}
                          className="bg-blue-600 text-white px-2 py-1 rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="bg-gray-400 text-white px-2 py-1 rounded"
                        >
                          Cancel
                        </button>
                        {editError && <div className="text-red-600">{editError}</div>}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(vehicle)}
                          className="bg-yellow-500 text-white px-2 py-1 rounded"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          className="bg-red-600 text-white px-2 py-1 rounded"
                        >
                          Delete
                        </button>
                        <button
                          onClick={() => startTelemetry(vehicle)}
                          className="bg-blue-700 text-white px-2 py-1 rounded"
                        >
                          Send Telemetry
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                {telemetryId === vehicle.id && (
                  <tr className="bg-blue-50 dark:bg-blue-900">
                    <td colSpan={6} className="p-2">
                      <form onSubmit={(e) => handleTelemetrySubmit(e, vehicle.id)} className="flex gap-2 items-end">
                        <input
                          name="current_lat"
                          value={telemetryForm.current_lat}
                          onChange={handleTelemetryChange}
                          placeholder="Latitude"
                          className="border rounded px-2 py-1"
                        />
                        <input
                          name="current_lng"
                          value={telemetryForm.current_lng}
                          onChange={handleTelemetryChange}
                          placeholder="Longitude"
                          className="border rounded px-2 py-1"
                        />
                        <select
                          name="status"
                          value={telemetryForm.status}
                          onChange={handleTelemetryChange}
                          className="border rounded px-2 py-1"
                        >
                          <option value="idle">Idle</option>
                          <option value="enroute">Enroute</option>
                          <option value="charging">Charging</option>
                          <option value="maintenance">Maintenance</option>
                        </select>
                        <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded">Update</button>
                        <button type="button" onClick={handleCancelTelemetry} className="bg-gray-400 text-white px-3 py-1 rounded">Cancel</button>
                        {telemetryError && <div className="text-red-600 ml-2">{telemetryError}</div>}
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      {/* Pagination */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => setPage((p) => (hasNext ? p + 1 : p))}
          disabled={!hasNext}
          className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
} 