"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Worker = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  email: string;
  jobTitle: string;
  accessLevel: string;
  active: boolean;
  createdAt?: string;
  lastLoginAt?: string | null;
};

type WorkerForm = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  jobTitle: string;
  accessLevel: string;
  active: boolean;
};

const emptyForm: WorkerForm = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  jobTitle: "",
  accessLevel: "worker",
  active: true,
};

function fmtDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function initials(firstName: string, lastName: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "W";
}

export default function WorkersAdminPage() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState<"active" | "inactive" | "all">("active");

  const [addForm, setAddForm] = useState<WorkerForm>(emptyForm);

  const [editOpen, setEditOpen] = useState(false);
  const [editingWorkerId, setEditingWorkerId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<WorkerForm>(emptyForm);

  async function loadWorkers() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/workers", { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load workers");
      }

      setWorkers(Array.isArray(data?.workers) ? data.workers : []);
    } catch (error: any) {
      setMessage(error?.message || "Failed to load workers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  const activeWorkers = useMemo(
    () => workers.filter((worker) => worker.active),
    [workers]
  );

  const inactiveWorkers = useMemo(
    () => workers.filter((worker) => !worker.active),
    [workers]
  );

  const visibleWorkers = useMemo(() => {
    if (filter === "active") return activeWorkers;
    if (filter === "inactive") return inactiveWorkers;
    return workers;
  }, [workers, activeWorkers, inactiveWorkers, filter]);

  function updateAddForm<K extends keyof WorkerForm>(key: K, value: WorkerForm[K]) {
    setAddForm((current) => ({ ...current, [key]: value }));
  }

  function updateEditForm<K extends keyof WorkerForm>(key: K, value: WorkerForm[K]) {
    setEditForm((current) => ({ ...current, [key]: value }));
  }

  async function handleAddWorker(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/admin/workers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to add worker");
      }

      setAddForm(emptyForm);
      setMessage("✅ Worker added");
      await loadWorkers();
    } catch (error: any) {
      setMessage(error?.message || "Failed to add worker");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(worker: Worker) {
    setEditingWorkerId(worker.id);
    setEditForm({
      firstName: worker.firstName || "",
      lastName: worker.lastName || "",
      phone: worker.phone || "",
      email: worker.email || "",
      jobTitle: worker.jobTitle || "",
      accessLevel: worker.accessLevel || "worker",
      active: !!worker.active,
    });
    setEditOpen(true);
    setMessage("");
  }

  function closeEdit() {
    setEditOpen(false);
    setEditingWorkerId(null);
    setEditForm(emptyForm);
  }

  async function handleSaveEdit() {
    if (!editingWorkerId) return;

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/workers/${editingWorkerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save worker");
      }

      setMessage("✅ Worker updated");
      closeEdit();
      await loadWorkers();
    } catch (error: any) {
      setMessage(error?.message || "Failed to save worker");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(worker: Worker) {
    const label = worker.active ? "deactivate" : "reactivate";
    const ok = window.confirm(
      `Are you sure you want to ${label} ${worker.fullName}?`
    );

    if (!ok) return;

    setSaving(true);
    setMessage("");

    try {
      const res = await fetch(`/api/admin/workers/${worker.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active: !worker.active,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || `Failed to ${label} worker`);
      }

      setMessage(`✅ ${worker.fullName} updated`);
      await loadWorkers();
    } catch (error: any) {
      setMessage(error?.message || `Failed to ${label} worker`);
    } finally {
      setSaving(false);
    }
  }

  function StatCard({
    label,
    value,
    active,
    onClick,
  }: {
    label: string;
    value: number;
    active: boolean;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          border: active ? "2px solid #111827" : "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          background: active ? "#111827" : "#fff",
          color: active ? "#fff" : "#111827",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.75, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 30, fontWeight: 900, marginTop: 6 }}>{value}</div>
      </button>
    );
  }

  return (
    <main style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7 }}>
            FURLADS ADMIN
          </div>
          <h1 style={{ margin: "6px 0 0", fontSize: 32, fontWeight: 950 }}>Workers</h1>
          <div style={{ opacity: 0.75, marginTop: 6 }}>
            Add workers, edit details, and reset passwords.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link
            href="/admin/reset-password"
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #111827",
              background: "#111827",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            Reset passwords
          </Link>

          <button
            type="button"
            onClick={loadWorkers}
            disabled={loading}
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid #d4d4d8",
              background: "#fff",
              cursor: "pointer",
              fontWeight: 700,
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {message ? (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            background: "#fff",
          }}
        >
          {message}
        </div>
      ) : null}

      <section
        style={{
          marginTop: 18,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        <StatCard
          label="Active workers"
          value={activeWorkers.length}
          active={filter === "active"}
          onClick={() => setFilter("active")}
        />
        <StatCard
          label="Inactive workers"
          value={inactiveWorkers.length}
          active={filter === "inactive"}
          onClick={() => setFilter("inactive")}
        />
        <StatCard
          label="Total workers"
          value={workers.length}
          active={filter === "all"}
          onClick={() => setFilter("all")}
        />
      </section>

      <section
        style={{
          marginTop: 18,
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 16,
          background: "#fff",
        }}
      >
        <div style={{ fontWeight: 900, marginBottom: 12 }}>Add worker</div>

        <form onSubmit={handleAddWorker} style={{ display: "grid", gap: 12 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            <input
              value={addForm.firstName}
              onChange={(e) => updateAddForm("firstName", e.target.value)}
              placeholder="First name"
              required
              style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
            />
            <input
              value={addForm.lastName}
              onChange={(e) => updateAddForm("lastName", e.target.value)}
              placeholder="Last name"
              required
              style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
            />
            <input
              value={addForm.phone}
              onChange={(e) => updateAddForm("phone", e.target.value)}
              placeholder="Phone"
              style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
            />
            <input
              value={addForm.email}
              onChange={(e) => updateAddForm("email", e.target.value)}
              placeholder="Email"
              style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
            />
            <input
              value={addForm.jobTitle}
              onChange={(e) => updateAddForm("jobTitle", e.target.value)}
              placeholder="Job title"
              style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
            />
            <select
              value={addForm.accessLevel}
              onChange={(e) => updateAddForm("accessLevel", e.target.value)}
              style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
            >
              <option value="worker">Worker</option>
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="office">Office</option>
              <option value="owner">Owner</option>
            </select>
          </div>

          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            <input
              type="checkbox"
              checked={addForm.active}
              onChange={(e) => updateAddForm("active", e.target.checked)}
            />
            Active worker
          </label>

          <div>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid #111827",
                background: saving ? "#f4f4f5" : "#111827",
                color: saving ? "#111827" : "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                fontWeight: 800,
              }}
            >
              {saving ? "Saving..." : "Add worker"}
            </button>
          </div>
        </form>
      </section>

      <section style={{ marginTop: 18 }}>
        <div style={{ fontWeight: 900, marginBottom: 12 }}>Workers</div>

        {loading ? (
          <div style={{ opacity: 0.7 }}>Loading...</div>
        ) : visibleWorkers.length === 0 ? (
          <div
            style={{
              padding: 14,
              borderRadius: 14,
              border: "1px dashed #d4d4d8",
              background: "#fff",
            }}
          >
            No workers found.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {visibleWorkers.map((worker) => (
              <div
                key={worker.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  background: "#fff",
                  padding: 16,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: "999px",
                      background: "#111827",
                      color: "#fff",
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 900,
                    }}
                  >
                    {initials(worker.firstName, worker.lastName)}
                  </div>

                  <div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{worker.fullName}</div>
                    <div style={{ opacity: 0.75, marginTop: 4 }}>
                      {worker.jobTitle || "No job title"} • {worker.accessLevel || "worker"}
                    </div>
                    <div style={{ opacity: 0.75, marginTop: 4 }}>
                      {worker.phone || "No phone"} {worker.email ? `• ${worker.email}` : ""}
                    </div>
                    <div style={{ opacity: 0.6, marginTop: 4, fontSize: 13 }}>
                      Last login: {fmtDateTime(worker.lastLoginAt)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => openEdit(worker)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #d4d4d8",
                      background: "#fff",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    Edit
                  </button>

                  <Link
                    href={`/admin/reset-password?workerId=${worker.id}`}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid #111827",
                      background: "#111827",
                      color: "#fff",
                      textDecoration: "none",
                      fontWeight: 700,
                    }}
                  >
                    Reset password
                  </Link>

                  <button
                    type="button"
                    onClick={() => toggleActive(worker)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: worker.active ? "1px solid #dc2626" : "1px solid #16a34a",
                      background: "#fff",
                      color: worker.active ? "#dc2626" : "#16a34a",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                  >
                    {worker.active ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {editOpen ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.35)",
            display: "grid",
            placeItems: "center",
            padding: 20,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 720,
              background: "#fff",
              borderRadius: 18,
              padding: 18,
              border: "1px solid #e5e7eb",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Edit worker</h2>

            <div
              style={{
                marginTop: 16,
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 12,
              }}
            >
              <input
                value={editForm.firstName}
                onChange={(e) => updateEditForm("firstName", e.target.value)}
                placeholder="First name"
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
              />
              <input
                value={editForm.lastName}
                onChange={(e) => updateEditForm("lastName", e.target.value)}
                placeholder="Last name"
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
              />
              <input
                value={editForm.phone}
                onChange={(e) => updateEditForm("phone", e.target.value)}
                placeholder="Phone"
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
              />
              <input
                value={editForm.email}
                onChange={(e) => updateEditForm("email", e.target.value)}
                placeholder="Email"
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
              />
              <input
                value={editForm.jobTitle}
                onChange={(e) => updateEditForm("jobTitle", e.target.value)}
                placeholder="Job title"
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
              />
              <select
                value={editForm.accessLevel}
                onChange={(e) => updateEditForm("accessLevel", e.target.value)}
                style={{ padding: "12px 14px", borderRadius: 12, border: "1px solid #d4d4d8" }}
              >
                <option value="worker">Worker</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="office">Office</option>
                <option value="owner">Owner</option>
              </select>
            </div>

            <label
              style={{
                marginTop: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              <input
                type="checkbox"
                checked={editForm.active}
                onChange={(e) => updateEditForm("active", e.target.checked)}
              />
              Active worker
            </label>

            <div style={{ marginTop: 18, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={saving}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #111827",
                  background: "#111827",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Save changes
              </button>

              <button
                type="button"
                onClick={closeEdit}
                style={{
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid #d4d4d8",
                  background: "#fff",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}