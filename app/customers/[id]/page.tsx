'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

type Customer = {
  id: number
  name: string
  phone: string | null
  email: string | null
  address: string | null
  postcode: string | null
  notes: string | null
  createdAt: string
}

export default function CustomerPage() {
  const params = useParams()
  const id = params.id

  const [customer, setCustomer] = useState<Customer | null>(null)

  useEffect(() => {
    async function loadCustomer() {
      const res = await fetch(`/api/customers/${id}`)
      const data = await res.json()
      setCustomer(data)
    }

    if (id) loadCustomer()
  }, [id])

  if (!customer) return <p style={{ padding: 20 }}>Loading...</p>

  return (
    <main style={{ padding: 20 }}>
      <h1>{customer.name}</h1>

      {customer.phone && <p>Phone: {customer.phone}</p>}
      {customer.address && <p>Address: {customer.address}</p>}
      {customer.postcode && <p>Postcode: {customer.postcode}</p>}
      {customer.notes && <p>Notes: {customer.notes}</p>}
    </main>
  )
}