import { redirect } from 'next/navigation'

import { getCurrentUserId } from '@/lib/auth/get-current-user'

export const maxDuration = 60

export async function generateMetadata(props: {
  params: Promise<{ id: string }>
}) {
  const { id } = await props.params

  return {
    title: `Search ${id}`,
    description: 'Search results'
  }
}

export default async function SearchPage(props: {
  params: Promise<{ id: string }>
}) {
  const userId = await getCurrentUserId()
  const { id } = await props.params

  // Since we're not using Redis for chat persistence,
  // redirect to home page for now
  // You can implement a different approach for chat persistence if needed
  redirect('/')
}
