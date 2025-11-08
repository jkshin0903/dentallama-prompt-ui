import { generateId } from 'ai'

import { getCurrentUser } from '@/lib/auth/get-current-user'

import { Chat } from '@/components/chat'

export default async function Page() {
  const id = generateId()
  const user = await getCurrentUser()
  return <Chat key={id} id={id} user={user} />
}
