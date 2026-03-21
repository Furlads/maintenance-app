import { generateAuthenticationOptions } from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const { phone } = await req.json();

  const worker = await prisma.worker.findFirst({
    where: { phone: phone.trim() },
    include: { webauthnCredentials: true },
  });

  if (!worker || worker.webauthnCredentials.length === 0) {
    return new Response('No Face ID set up', { status: 404 });
  }

  const options = generateAuthenticationOptions({
    rpID: process.env.WEBAUTHN_RP_ID!,
    allowCredentials: worker.webauthnCredentials.map((cred) => ({
      id: cred.id,
      type: 'public-key',
    })),
    userVerification: 'preferred',
  });

  return Response.json({
    options,
    workerId: worker.id,
  });
}