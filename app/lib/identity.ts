export type CompanyKey = "furlads" | "threecounties";

const COMPANY_KEY = "company";
const WORKER_KEY = "worker";
const LEGACY_WORKER_KEY = "workerName";

export function ensureLegacyMigration() {
  if (typeof window === "undefined") return;

  const worker = localStorage.getItem(WORKER_KEY);
  const legacy = localStorage.getItem(LEGACY_WORKER_KEY);

  if (!worker && legacy) {
    localStorage.setItem(WORKER_KEY, legacy.trim().toLowerCase());
    localStorage.removeItem(LEGACY_WORKER_KEY);
  }
}

export function getCompany(): CompanyKey | "" {
  if (typeof window === "undefined") return "";
  return (localStorage.getItem(COMPANY_KEY) as CompanyKey) || "";
}

export function getWorker(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(WORKER_KEY) || "";
}

export function setCompany(company: CompanyKey) {
  localStorage.setItem(COMPANY_KEY, company);
}

export function setWorker(worker: string) {
  localStorage.setItem(WORKER_KEY, worker.trim().toLowerCase());
}

export function resetIdentity() {
  localStorage.removeItem(COMPANY_KEY);
  localStorage.removeItem(WORKER_KEY);
  localStorage.removeItem(LEGACY_WORKER_KEY);
}