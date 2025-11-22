import { redirect } from 'next/navigation'

import { generateId } from 'ai'

import { getCurrentUser } from '@/lib/auth/get-current-user'

import { Chat } from '@/components/chat'

export const maxDuration = 60

export default async function SearchPage(props: {
  searchParams: Promise<{ q: string }>
}) {
  const { q } = await props.searchParams
  if (!q) {
    redirect('/')
  }

  const id = generateId()
  const user = await getCurrentUser()
  return <Chat id={id} query={q} user={user} />
}
