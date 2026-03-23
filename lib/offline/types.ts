export type OfflineWorker = {
  id: number | null
  name: string
  photoUrl: string
}

export type OfflineCustomer = {
  id: number
  name: string
  phone?: string | null
  email?: string | null
  address?: string | null
  postcode?: string | null
  notes?: string | null
}

export type OfflineJob = {
  id: number
  title: string
  customerId: number
  address: string
  notes?: string | null
  visitDate?: string | null
  startTime?: string | null
  durationMinutes?: number | null
  status?: string
  jobType?: string
  customer?: OfflineCustomer | null
}

export type TodayOfflineSnapshot = {
  savedAt: string
  worker: OfflineWorker
  jobs: OfflineJob[]
  customers: OfflineCustomer[]
}