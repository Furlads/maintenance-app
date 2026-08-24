import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

type InboxConversationLayoutProps = {
  children: React.ReactNode
  params: {
    conversationId: string
  }
}

export default async function InboxConversationLayout({
  children,
  params,
}: InboxConversationLayoutProps) {
  const conversationId = String(params.conversationId || '').trim()

  if (conversationId) {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { source: true },
    })

    if (String(conversation?.source || '').toLowerCase() === 'worker-quote') {
      const quote = await prisma.quote.findFirst({
        where: {
          conversationId,
          archivedAt: null,
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
        },
      })

      if (quote?.id) {
        redirect(`/admin/quotes/${quote.id}`)
      }
    }
  }

  return children
}
