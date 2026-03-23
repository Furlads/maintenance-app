export type OfflineCustomer = {
  id: number;
  name: string;
  phone: string | null;
  email?: string | null;
  address: string | null;
  postcode: string | null;
};

export type OfflineWorker = {
  id: number | null;
  name: string;
  photoUrl: string;
};

export type OfflineJobAssignment = {
  id: number;
  workerId: number;
  worker: {
    id: number;
    firstName: string;
    lastName: string;
  };
};

export type OfflineJob = {
  id: number;
  title: string;
  address: string;
  notes: string | null;
  status: string;
  jobType: string;
  createdAt: string;
  customer: OfflineCustomer;
  assignments: OfflineJobAssignment[];
  visitDate?: string | null;
  startTime?: string | null;
  durationMinutes?: number | null;
  overrunMins?: number | null;
  pausedMinutes?: number | null;
  arrivedAt?: string | null;
  pausedAt?: string | null;
  finishedAt?: string | null;
};

export type TodayOfflineSnapshot = {
  savedAt: string;
  worker: OfflineWorker;
  jobs: OfflineJob[];
  customers: OfflineCustomer[];
};

export type OfflineStatus = "idle" | "online" | "offline";