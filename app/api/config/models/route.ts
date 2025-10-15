import { NextResponse } from 'next/server'

export async function GET() {
  // Since we're using a custom model gateway, return empty models array
  return NextResponse.json(
    { models: [] },
    {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60', // Cache for 1 minute
        'Content-Type': 'application/json'
      }
    }
  )
}
