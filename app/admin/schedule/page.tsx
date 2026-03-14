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

function parseTimeToMinutes(time: string | null) {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export default function SchedulePage() {
  const [date, setDate] = useState(getTodayDateString());
  const [data, setData] = useState<ScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const dayStart = 9 * 60; // 09:00
  const dayEnd = 16 * 60 + 30; // 16:30
  const totalMinutes = dayEnd - dayStart;

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
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Schedule Board</h1>

      <div style={{ marginBottom: 20 }}>
        <label style={{ marginRight: 10 }}>Date:</label>

        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ padding: 6, fontSize: 14 }}
        />
      </div>

      {loading && <p>Loading schedule...</p>}

      {!loading && data && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {data.workers.map((worker) => (
            <div key={worker.id}>
              <h2 style={{ marginBottom: 6 }}>{worker.name}</h2>

              <div
                style={{
                  position: "relative",
                  border: "1px solid #ddd",
                  height: 70,
                  background: "#f9f9f9",
                }}
              >
                {/* Hour markers */}
                {[9,10,11,12,13,14,15,16].map((hour) => {
                  const left =
                    ((hour * 60 - dayStart) / totalMinutes) * 100;

                  return (
                    <div
                      key={hour}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        top: 0,
                        bottom: 0,
                        width: 1,
                        background: "#ddd",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: -18,
                          fontSize: 11,
                          color: "#777",
                        }}
                      >
                        {hour}:00
                      </div>
                    </div>
                  );
                })}

                {/* Jobs */}
                {worker.jobs.map((job) => {
                  const start = parseTimeToMinutes(job.startTime);
                  const duration = job.durationMinutes ?? 60;

                  if (!start) return null;

                  const left =
                    ((start - dayStart) / totalMinutes) * 100;

                  const width =
                    (duration / totalMinutes) * 100;

                  return (
                    <div
                      key={job.id}
                      style={{
                        position: "absolute",
                        left: `${left}%`,
                        width: `${width}%`,
                        top: 10,
                        height: 50,
                        background: "#e8f3ff",
                        border: "1px solid #8db6ff",
                        borderRadius: 4,
                        padding: 6,
                        overflow: "hidden",
                        fontSize: 12,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>
                        {job.startTime} {job.title}
                      </div>

                      <div>{job.customerName}</div>

                      <div style={{ fontSize: 11, color: "#555" }}>
                        {job.postcode ?? ""}
                      </div>
                    </div>
                  );
                })}

                {worker.jobs.length === 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 10,
                      top: 25,
                      fontSize: 13,
                      color: "#888",
                    }}
                  >
                    No jobs scheduled
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}