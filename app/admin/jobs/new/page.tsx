import { redirect } from 'next/navigation'

type PageProps = {
  searchParams?: {
    [key: string]: string | string[] | undefined
  }
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? ''
  return value ?? ''
}

export default function AdminJobsNewPage({ searchParams }: PageProps) {
  const name = firstValue(searchParams?.name)
  const summary = firstValue(searchParams?.summary)
  const address = firstValue(searchParams?.address)
  const phone = firstValue(searchParams?.phone)
  const email = firstValue(searchParams?.email)
  const postcode = firstValue(searchParams?.postcode)

  const params = new URLSearchParams()

  if (name) params.set('name', name)
  if (summary) params.set('summary', summary)
  if (address) params.set('address', address)
  if (phone) params.set('phone', phone)
  if (email) params.set('email', email)
  if (postcode) params.set('postcode', postcode)

  const query = params.toString()

  redirect(query ? `/jobs/add?${query}` : '/jobs/add')
}