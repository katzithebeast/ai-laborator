import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

  if (token_hash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as 'email' })
    if (!error) {
      return NextResponse.redirect(new URL('/app/chat', req.url))
    }
  }
  return NextResponse.redirect(new URL('/login?error=invalid_token', req.url))
}
