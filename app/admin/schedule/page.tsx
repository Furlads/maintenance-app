"use client";

import { useEffect, useState } from "react";

type Job = {
  id: number;
  title: string;
  jobType: string;
  customerName: string;
  postcode: string | null;
  address: string;
  startTime: string | null;
  durationMinutes: number | null;
  status: string;
};

type Worker = {
  id: number;
  name: string;
  jobs: Job[];
};

type ScheduleResponse = {
  date: string;
  workers: Worker[];
};

function getTodayDateString() {
  const today = new Date();
  return today.toISOString().split("T")[0];
}

export default function SchedulePage() {
  const [date, setDate] = useState(getTodayDateString());
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadSchedule(selectedDate: string) {
    setLoading(true);

    try {
      const res = await fetch(`/api/schedule/day?date=${selectedDate}`);
      const json = await res.json();

      setData(json);
    } catch (err) {
      console.error("Failed to load schedule", err);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSchedule(date);
  }, [date]);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>
        Schedule Board
      </h1>

      <div style={{ marginBottom: 20 }}>
        <label style={{ marginRight: 10 }}>Date:</label>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{
            padding: 6,
            fontSize: 14,
          }}
        />
      </div>

      {loading && <p>Loading schedule...</p>}

      {!loading && data && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {data.workers.map((worker) => (
            <div
              key={worker.id}
              style={{
                border: "1px solid #ddd",
                borderRadius: 6,
                padding: 16,
                background: "#fff",
              }}
            >
              <h2
                style={{
                  fontSize: 18,
                  marginBottom: 12,
                }}
              >
                {worker.name}
              </h2>

              {worker.jobs.length === 0 && (
                <p style={{ color: "#888" }}>No jobs scheduled</p>
              )}

              {worker.jobs.map((job) => (
                <div
                  key={job.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 4,
                    padding: 10,
                    marginBottom: 10,
                    background: "#fafafa",
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {job.startTime ?? "TBD"} — {job.title}
                  </div>

                  <div style={{ fontSize: 13 }}>
                    {job.customerName}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      color: "#666",
                    }}
                  >
                    {job.postcode ?? ""}
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      marginTop: 4,
                      color: "#444",
                    }}
                  >
                    {job.durationMinutes ?? 0} mins
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}