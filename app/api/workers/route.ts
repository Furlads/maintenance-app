import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const workers = await prisma.worker.findMany({
      where: {
        active: true
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true
      },
      orderBy: {
        firstName: 'asc'
      }
    })

    return new Response(JSON.stringify(workers), {
      headers: {
        'Content-Type': 'application/json'
      }
    })
  } catch (error) {
    console.error('WORKERS API ERROR:', error)

    return new Response(
      JSON.stringify({
        error: 'Failed to load workers',
        details: String(error)
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    )
  }
}