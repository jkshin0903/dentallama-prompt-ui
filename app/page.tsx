import { generateId } from 'ai'

import { Chat } from '@/components/chat'
import { getCurrentUser } from '@/lib/auth/get-current-user'

export default async function Page() {
  const id = generateId()
  const user = await getCurrentUser()
  return <Chat key={id} id={id} user={user} />
}
