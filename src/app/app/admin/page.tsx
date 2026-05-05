'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useRole, type Role } from '@/lib/useRole'

type UserRow = {
  id: string
  email: string
  full_name: string | null
  role: Role
  created_at: string
}

const ROLES: Role[] = ['super_admin', 'admin', 'analyst', 'viewer']
const ROLE_LABELS: Record<Role, string> = {
  super_admin: '👑 Super Admin',
  admin: '🔧 Admin',
  analyst: '📝 Analyst',
  viewer: '👁️ Viewer',
}

export default function AdminPage() {
  const router = useRouter()
  const { role, loading: roleLoading } = useRole()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    if (!roleLoading && role !== 'super_admin') router.push('/app/chat')
  }, [roleLoading, role, router])

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const body = await res.json()
    if (!res.ok) { setError(body.error || 'Chyba při načítání'); setLoading(false); return }
    setUsers(body)
    setLoading(false)
  }

  useEffect(() => {
    if (role === 'super_admin') loadUsers()
  }, [role])  // eslint-disable-line react-hooks/exhaustive-deps

  const updateRole = async (id: string, newRole: Role) => {
    setUpdating(id)
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, role: newRole }),
    })
    if (res.ok) setUsers(prev => prev.map(u => u.id === id ? { ...u, role: newRole } : u))
    setUpdating(null)
  }

  const deleteUser = async (id: string) => {
    const token = await getToken()
    const res = await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setUsers(prev => prev.filter(u => u.id !== id))
    setDeleteConfirm(null)
  }

  if (roleLoading || role !== 'super_admin') return null

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Správa uživatelů</h1>
          <p>Přístupy a role v systému. Změny se projeví při příštím přihlášení uživatele.</p>
        </div>
      </div>
      <div className="page-body">
        {error && (
          <div className="login-error show" style={{ marginBottom: 16 }}>
            {error}
            {error.includes('SERVICE_ROLE_KEY') && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                Přidej <code>SUPABASE_SERVICE_ROLE_KEY</code> do Vercel → Settings → Environment Variables.
                Najdeš ho v Supabase → Settings → API → service_role key.
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div className="empty">Načítám uživatele…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text3)', fontWeight: 600, textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px' }}>Email</th>
                  <th style={{ padding: '8px 12px' }}>Jméno</th>
                  <th style={{ padding: '8px 12px' }}>Role</th>
                  <th style={{ padding: '8px 12px' }}>Registrace</th>
                  <th style={{ padding: '8px 12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)' }}>{u.email}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{u.full_name || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.email === 'katzithebeast@gmail.com' ? (
                        <span className="tag tag-red" style={{ fontSize: 11 }}>{ROLE_LABELS[u.role]}</span>
                      ) : (
                        <select
                          className="form-select"
                          style={{ fontSize: 12, padding: '3px 8px' }}
                          value={u.role}
                          disabled={updating === u.id}
                          onChange={e => updateRole(u.id, e.target.value as Role)}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text3)', fontSize: 12 }}>
                      {new Date(u.created_at).toLocaleDateString('cs-CZ')}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {u.email !== 'katzithebeast@gmail.com' && (
                        <button className="btn btn-danger btn-xs" onClick={() => setDeleteConfirm(u.id)}>
                          Smazat
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {deleteConfirm && (
        <div className="modal-bg open" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Smazat uživatele?</div>
              <div className="modal-subtitle">Tato akce je nevratná. Uživatel ztratí přístup.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Zrušit</button>
              <button className="btn btn-danger" onClick={() => deleteUser(deleteConfirm)}>Smazat</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
