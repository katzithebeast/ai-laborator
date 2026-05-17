import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = process.env.AI_WATCH_CRON_SECRET ?? process.env.CRON_SECRET
  const url = new URL('/api/ai-watch/run', request.url)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) headers['Authorization'] = `Bearer ${secret}`

  const res = await fetch(url.toString(), { method: 'POST', headers })
  const json = await res.json()

  return NextResponse.json(json, { status: res.status })
}
