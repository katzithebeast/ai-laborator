import { NextRequest, NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function getAuthenticatedUser(request: NextRequest) {
  // Prefer explicit token from header (reliable on Vercel serverless)
  const token = request.headers.get('x-supabase-token')
  if (token) {
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const { data: { user } } = await supabase.auth.getUser(token)
    return user
  }

  // Fallback: cookie-based session (works locally and when cookies are fresh)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request)

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const secret = process.env.AI_WATCH_CRON_SECRET ?? process.env.CRON_SECRET
  const url = new URL('/api/ai-watch/run', request.url)

  // Forward mode from body if present
  let body: string | undefined
  try {
    const parsed = await request.json()
    body = JSON.stringify(parsed)
    if (parsed?.mode) url.searchParams.set('mode', parsed.mode)
  } catch { /* no body */ }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) headers['Authorization'] = `Bearer ${secret}`

  const res = await fetch(url.toString(), { method: 'POST', headers, body })
  const json = await res.json()

  return NextResponse.json(json, { status: res.status })
}
