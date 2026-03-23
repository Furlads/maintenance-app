import type {
  OfflineCustomer,
  OfflineJob,
  OfflineWorker,
  TodayOfflineSnapshot,
} from "./types";

const TODAY_SNAPSHOT_KEY = "furlads:today-offline-snapshot";

function isBrowser() {
  return typeof window !== "undefined";
}

export function getStoredWorker(): OfflineWorker {
  if (!isBrowser()) {
    return {
      id: null,
      name: "",
      photoUrl: "",
    };
  }

  const workerIdRaw = window.localStorage.getItem("workerId");
  const workerName = window.localStorage.getItem("workerName") || "";
  const workerPhotoUrl =
    window.localStorage.getItem("workerPhotoUrl") ||
    window.localStorage.getItem("photoUrl") ||
    "";

  const parsedWorkerId =
    workerIdRaw && !Number.isNaN(Number(workerIdRaw))
      ? Number(workerIdRaw)
      : null;

  return {
    id: parsedWorkerId,
    name: workerName,
    photoUrl: workerPhotoUrl,
  };
}

export function saveTodaySnapshot(params: {
  jobs: OfflineJob[];
  customers: OfflineCustomer[];
}) {
  if (!isBrowser()) return;

  const snapshot: TodayOfflineSnapshot = {
    savedAt: new Date().toISOString(),
    worker: getStoredWorker(),
    jobs: params.jobs,
    customers: params.customers,
  };

  window.localStorage.setItem(TODAY_SNAPSHOT_KEY, JSON.stringify(snapshot));
}

export function getTodaySnapshot(): TodayOfflineSnapshot | null {
  if (!isBrowser()) return null;

  const raw = window.localStorage.getItem(TODAY_SNAPSHOT_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as TodayOfflineSnapshot;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray(parsed.jobs) ||
      !Array.isArray(parsed.customers)
    ) {
      return null;
    }

    return parsed;
  } catch (error) {
    console.error("Failed to parse offline today snapshot:", error);
    return null;
  }
}

export function clearTodaySnapshot() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TODAY_SNAPSHOT_KEY);
}

export function getLastTodaySnapshotTime(): string {
  const snapshot = getTodaySnapshot();
  return snapshot?.savedAt || "";
}