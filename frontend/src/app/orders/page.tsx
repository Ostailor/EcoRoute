"use client";
import { useEffect, useState } from "react";

interface Order {
  id: number;
  customer_name: string;
  pickup_address: string;
  dropoff_address: string;
  status: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  dropoff_lat?: number | null;
  dropoff_lng?: number | null;
}

const PAGE_SIZE = 5;

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: "",
    customer_name: "",
    pickup_address: "",
    dropoff_address: "",
    status: "pending",
    pickup_lat: "",
    pickup_lng: "",
    dropoff_lat: "",
    dropoff_lng: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    customer_name: "",
    pickup_address: "",
    dropoff_address: "",
    status: "pending",
    pickup_lat: "",
    pickup_lng: "",
    dropoff_lat: "",
    dropoff_lng: "",
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Filtering and pagination state
  const [filterStatus, setFilterStatus] = useState("");
  const [filterCustomer, setFilterCustomer] = useState("");
  const [page, setPage] = useState(0);
  const [hasNext, setHasNext] = useState(false);

  // Fetch orders with filters and pagination
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.append("limit", String(PAGE_SIZE + 1)); // fetch one extra to check for next page
    params.append("offset", String(page * PAGE_SIZE));
    if (filterStatus) params.append("status", filterStatus);
    if (filterCustomer) params.append("customer_name", filterCustomer);
    fetch(`http://localhost:8000/orders?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setHasNext(data.length > PAGE_SIZE);
        setOrders(data.slice(0, PAGE_SIZE));
      })
      .catch(() => setError("Could not fetch orders"))
      .finally(() => setLoading(false));
  }, [filterStatus, filterCustomer, page]);

  // Handle filter form
  function handleFilterSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(0); // reset to first page on filter
    // useEffect will refetch
  }

  // Handle form input
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  // Handle form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.id || !form.customer_name || !form.pickup_address || !form.dropoff_address) {
      setFormError("All fields are required.");
      return;
    }
    try {
      const res = await fetch("http://localhost:8000/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          id: Number(form.id),
          pickup_lat: form.pickup_lat ? Number(form.pickup_lat) : null,
          pickup_lng: form.pickup_lng ? Number(form.pickup_lng) : null,
          dropoff_lat: form.dropoff_lat ? Number(form.dropoff_lat) : null,
          dropoff_lng: form.dropoff_lng ? Number(form.dropoff_lng) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setFormError(data.detail || "Failed to create order");
        return;
      }
      const newOrder = await res.json();
      setOrders((prev) => [...prev, newOrder]);
      setForm({ id: "", customer_name: "", pickup_address: "", dropoff_address: "", status: "pending", pickup_lat: "", pickup_lng: "", dropoff_lat: "", dropoff_lng: "" });
    } catch {
      setFormError("Failed to create order");
    }
  }

  // Handle delete
  async function handleDelete(id: number) {
    // Optimistic UI update
    setOrders((prev) => prev.filter((o) => o.id !== id));
    try {
      await fetch(`http://localhost:8000/orders/${id}`, { method: "DELETE" });
    } catch {
      // Optionally, show error or revert UI
      setError("Failed to delete order");
    }
  }

  // Handle edit button
  function startEdit(order: Order) {
    setEditingId(order.id);
    setEditForm({
      customer_name: order.customer_name,
      pickup_address: order.pickup_address,
      dropoff_address: order.dropoff_address,
      status: order.status,
      pickup_lat: order.pickup_lat?.toString() ?? "",
      pickup_lng: order.pickup_lng?.toString() ?? "",
      dropoff_lat: order.dropoff_lat?.toString() ?? "",
      dropoff_lng: order.dropoff_lng?.toString() ?? "",
    });
    setEditError(null);
  }

  // Handle edit form input
  function handleEditChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  }

  // Handle edit form submit
  async function handleEditSubmit(e: React.FormEvent, id: number) {
    e.preventDefault();
    setEditError(null);
    if (!editForm.customer_name || !editForm.pickup_address || !editForm.dropoff_address) {
      setEditError("All fields are required.");
      return;
    }
    try {
      const res = await fetch(`http://localhost:8000/orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          ...editForm,
          pickup_lat: editForm.pickup_lat ? Number(editForm.pickup_lat) : null,
          pickup_lng: editForm.pickup_lng ? Number(editForm.pickup_lng) : null,
          dropoff_lat: editForm.dropoff_lat ? Number(editForm.dropoff_lat) : null,
          dropoff_lng: editForm.dropoff_lng ? Number(editForm.dropoff_lng) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setEditError(data.detail || "Failed to update order");
        return;
      }
      const updatedOrder = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === id ? updatedOrder : o)));
      setEditingId(null);
    } catch {
      setEditError("Failed to update order");
    }
  }

  // Handle cancel edit
  function handleCancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      {/* Filter form */}
      <form onSubmit={handleFilterSubmit} className="mb-4 flex gap-2 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-800 dark:text-gray-200">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1 text-gray-800 dark:text-gray-200">Customer</label>
          <input
            type="text"
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            placeholder="Search customer"
            className="border p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded h-10">Filter</button>
      </form>
      <form onSubmit={handleSubmit} className="mb-8 space-y-2 bg-gray-50 dark:bg-gray-900 p-4 rounded">
        <div className="flex gap-2">
          <input
            name="id"
            type="number"
            placeholder="Order ID"
            value={form.id}
            onChange={handleChange}
            className="border p-2 rounded w-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <input
            name="customer_name"
            placeholder="Customer Name"
            value={form.customer_name}
            onChange={handleChange}
            className="border p-2 rounded flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex gap-2">
          <input
            name="pickup_address"
            placeholder="Pickup Address"
            value={form.pickup_address}
            onChange={handleChange}
            className="border p-2 rounded flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <input
            name="dropoff_address"
            placeholder="Dropoff Address"
            value={form.dropoff_address}
            onChange={handleChange}
            className="border p-2 rounded flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex gap-2">
          <input
            name="pickup_lat"
            type="number"
            step="any"
            placeholder="Pickup Lat"
            value={form.pickup_lat}
            onChange={handleChange}
            className="border p-2 rounded flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <input
            name="pickup_lng"
            type="number"
            step="any"
            placeholder="Pickup Lng"
            value={form.pickup_lng}
            onChange={handleChange}
            className="border p-2 rounded flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex gap-2">
          <input
            name="dropoff_lat"
            type="number"
            step="any"
            placeholder="Dropoff Lat"
            value={form.dropoff_lat}
            onChange={handleChange}
            className="border p-2 rounded flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <input
            name="dropoff_lng"
            type="number"
            step="any"
            placeholder="Dropoff Lng"
            value={form.dropoff_lng}
            onChange={handleChange}
            className="border p-2 rounded flex-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="border p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="pending">Pending</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        {formError && <div className="text-red-600 text-sm">{formError}</div>}
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Create Order</button>
      </form>
      <h2 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Order List</h2>
      {loading ? (
        <div>Loading...</div>
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : orders.length === 0 ? (
        <div>No orders found.</div>
      ) : (
        <table className="w-full border text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="border px-2 py-1">ID</th>
              <th className="border px-2 py-1">Customer</th>
              <th className="border px-2 py-1">Pickup</th>
              <th className="border px-2 py-1">Dropoff</th>
              <th className="border px-2 py-1">Status</th>
              <th className="border px-2 py-1">Pickup Lat</th>
              <th className="border px-2 py-1">Pickup Lng</th>
              <th className="border px-2 py-1">Dropoff Lat</th>
              <th className="border px-2 py-1">Dropoff Lng</th>
              <th className="border px-2 py-1">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="even:bg-gray-50 even:dark:bg-gray-800">
                <td className="border px-2 py-1">{order.id}</td>
                {editingId === order.id ? (
                  <>
                    <td className="border px-2 py-1">
                      <input
                        name="customer_name"
                        value={editForm.customer_name}
                        onChange={handleEditChange}
                        className="border p-1 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        name="pickup_address"
                        value={editForm.pickup_address}
                        onChange={handleEditChange}
                        className="border p-1 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        name="dropoff_address"
                        value={editForm.dropoff_address}
                        onChange={handleEditChange}
                        className="border p-1 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <select
                        name="status"
                        value={editForm.status}
                        onChange={handleEditChange}
                        className="border p-1 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="pending">Pending</option>
                        <option value="in_transit">In Transit</option>
                        <option value="delivered">Delivered</option>
                      </select>
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        name="pickup_lat"
                        type="number"
                        step="any"
                        value={editForm.pickup_lat}
                        onChange={handleEditChange}
                        className="border p-1 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        name="pickup_lng"
                        type="number"
                        step="any"
                        value={editForm.pickup_lng}
                        onChange={handleEditChange}
                        className="border p-1 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        name="dropoff_lat"
                        type="number"
                        step="any"
                        value={editForm.dropoff_lat}
                        onChange={handleEditChange}
                        className="border p-1 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </td>
                    <td className="border px-2 py-1">
                      <input
                        name="dropoff_lng"
                        type="number"
                        step="any"
                        value={editForm.dropoff_lng}
                        onChange={handleEditChange}
                        className="border p-1 rounded w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      />
                    </td>
                    <td className="border px-2 py-1 flex gap-1">
                      <button
                        onClick={(e) => handleEditSubmit(e, order.id)}
                        className="bg-green-600 text-white px-2 py-1 rounded text-xs"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="bg-gray-400 text-white px-2 py-1 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="border px-2 py-1">{order.customer_name}</td>
                    <td className="border px-2 py-1">{order.pickup_address}</td>
                    <td className="border px-2 py-1">{order.dropoff_address}</td>
                    <td className="border px-2 py-1">{order.status}</td>
                    <td className="border px-2 py-1">{order.pickup_lat ?? ""}</td>
                    <td className="border px-2 py-1">{order.pickup_lng ?? ""}</td>
                    <td className="border px-2 py-1">{order.dropoff_lat ?? ""}</td>
                    <td className="border px-2 py-1">{order.dropoff_lng ?? ""}</td>
                    <td className="border px-2 py-1 flex gap-1">
                      <button
                        onClick={() => startEdit(order)}
                        className="bg-yellow-500 text-white px-2 py-1 rounded text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="bg-red-600 text-white px-2 py-1 rounded text-xs"
                      >
                        Delete
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editingId && editError && <div className="text-red-600 text-sm mt-2">{editError}</div>}
      {/* Pagination controls */}
      <div className="flex justify-between mt-4">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-900 dark:text-gray-100">Page {page + 1}</span>
        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={!hasNext}
          className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
} 