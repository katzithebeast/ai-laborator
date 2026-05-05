import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import type { Role } from '@/lib/useRole'

const SUPER_ADMIN_EMAIL = 'katzithebeast@gmail.com'

async function verifySupperAdmin(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return false
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: { user } } = await supabase.auth.getUser(token)
  return user?.email === SUPER_ADMIN_EMAIL
}

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function GET(req: NextRequest) {
  if (!await verifySupperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený na Vercelu.' },
      { status: 503 }
    )
  }

  const { data: { users }, error } = await admin.auth.admin.listUsers()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: profiles } = await admin.from('profiles').select('id, role, full_name, team')

  const combined = users.map(u => ({
    id: u.id,
    email: u.email ?? '',
    created_at: u.created_at,
    full_name: profiles?.find(p => p.id === u.id)?.full_name ?? null,
    role: (profiles?.find(p => p.id === u.id)?.role ?? 'viewer') as Role,
  }))

  return NextResponse.json(combined)
}

export async function PATCH(req: NextRequest) {
  if (!await verifySupperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený na Vercelu.' },
      { status: 503 }
    )
  }

  const { id, role } = await req.json() as { id: string; role: Role }
  const { error } = await admin.from('profiles').update({ role }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  if (!await verifySupperAdmin(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const admin = getAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY není nastavený na Vercelu.' },
      { status: 503 }
    )
  }

  const { id } = await req.json() as { id: string }
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
