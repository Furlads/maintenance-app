// lib/workers.ts
export type CompanyKey = "furlads" | "threecounties";
export type WorkerRole = "Admin" | "Worker";

export type WorkerProfile = {
  key: string;              // canonical key used everywhere (lowercase)
  name: string;             // display name (spelling controlled here)
  role: WorkerRole;
  photo: string;            // public path e.g. /workers/kelly.jpg
  landingPath: string;      // where to go after choosing worker
  schedulable: boolean;     // can be assigned to jobs / schedule engine
};

function cleanLower(s: string) {
  return (s || "").trim().toLowerCase();
}

export const WORKERS_BY_COMPANY: Record<CompanyKey, WorkerProfile[]> = {
  furlads: [
    {
      key: "trev",
      name: "Trev",
      role: "Admin",
      photo: "/workers/trev.jpg",
      landingPath: "/today",
      schedulable: true,
    },
    {
      key: "kelly",
      name: "Kelly",
      role: "Admin",
      photo: "/workers/kelly.jpg",
      landingPath: "/kelly",
      schedulable: false,
    },
    {
      key: "stephen",
      name: "Stephen",
      role: "Worker",
      photo: "/workers/stephen.jpg",
      landingPath: "/today",
      schedulable: true,
    },
    {
      key: "jacob",
      name: "Jacob",
      role: "Worker",
      photo: "/workers/jacob.jpg",
      landingPath: "/today",
      schedulable: true,
    },
  ],

  threecounties: [
    // Tweak this list to match the real Three Counties team
    {
      key: "trev",
      name: "Trev",
      role: "Admin",
      photo: "/workers/trev.jpg",
      landingPath: "/today",
      schedulable: true,
    },
    {
      key: "kelly",
      name: "Kelly",
      role: "Admin",
      photo: "/workers/kelly.jpg",
      landingPath: "/kelly",
      schedulable: false,
    },
  ],
};

export function getWorkers(company: CompanyKey): WorkerProfile[] {
  return WORKERS_BY_COMPANY[company] ?? [];
}

export function getSchedulableWorkers(company: CompanyKey): WorkerProfile[] {
  return getWorkers(company).filter((w) => w.schedulable);
}

export function findWorker(company: CompanyKey, workerKey: string): WorkerProfile | undefined {
  const k = cleanLower(workerKey);
  return getWorkers(company).find((w) => cleanLower(w.key) === k);
}

export function resolveLandingPath(company: CompanyKey, workerKey: string): string {
  const w = findWorker(company, workerKey);
  return w?.landingPath || "/today";
}