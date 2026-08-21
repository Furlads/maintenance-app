import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

try {
  const workers = await prisma.worker.findMany({
    where: {
      firstName: {
        equals: 'Luke',
        mode: 'insensitive',
      },
    },
    select: { id: true, firstName: true, lastName: true },
  })

  for (const worker of workers) {
    await prisma.$transaction([
      prisma.webAuthnCredential.deleteMany({ where: { workerId: worker.id } }),
      prisma.worker.update({
        where: { id: worker.id },
        data: {
          active: false,
          passwordHash: null,
          pinHash: null,
          lockedUntil: null,
          failedLoginAttempts: 0,
        },
      }),
    ])

    console.log(`Deactivated worker: ${worker.firstName} ${worker.lastName}`)
  }

  if (workers.length === 0) {
    console.log('No Luke worker record found; nothing to deactivate.')
  }
} finally {
  await prisma.$disconnect()
}
