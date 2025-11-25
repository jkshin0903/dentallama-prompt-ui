import { generateId } from 'ai'

import { Chat } from '@/components/chat'

export default async function Page() {
  const id = generateId()
  // Remove getCurrentUser() call to avoid blocking and duplicate getUser() calls
  // User will be fetched client-side in Chat component
  return <Chat key={id} id={id} />
}
