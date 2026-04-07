'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const NAV = [
  { id: 'chat',       label: 'Chat',           icon: '💬', href: '/app/chat' },
  { id: 'dashboard',  label: 'Přehled',        icon: '▦',  href: '/app' },
  { id: 'inbox',      label: 'Inbox nástrojů', icon: '⊹',  href: '/app/inbox' },
  { id: 'claimboard', label: 'Claim board',    icon: '✎',  href: '/app/claimboard' },
  { id: 'interview',  label: 'Interview',      icon: '⚙',  href: '/app/interview' },
  { id: 'usecases',   label: 'Use casy',       icon: '⧉',  href: '/app/usecases' },
  { id: 'review',     label: 'Kontrola',       icon: '✓',  href: '/app/review' },
  { id: 'settings',   label: 'Nastavení',      icon: '◈',  href: '/app/settings' },
]

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
      else { setUser(session.user); setLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.replace('/login')
      else setUser(session.user)
    })
    return () => subscription.unsubscribe()
  }, [router])

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'#aaa' }}>Načítám…</div>

  const activeId = NAV.find(n => pathname === n.href || (n.href !== '/app' && pathname.startsWith(n.href)))?.id ?? 'dashboard'

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-mark">λ</div>
          <div className="sidebar-logo-text">
            <strong>AI Laboratoř</strong>
            <span>use case systém</span>
          </div>
        </div>
        {NAV.map(n => (
          <button key={n.id} className={`nav-link ${activeId === n.id ? 'active' : ''}`}
            onClick={() => router.push(n.href)}>
            <span className="nav-icon">{n.icon}</span>{n.label}
          </button>
        ))}
        <div className="sidebar-tip">
          <strong>Tip</strong><br />
          Napiš popis v <strong>Chatu</strong> → AI se doptá → uloží use case. Nebo claimni nástroj z <strong>Inboxu</strong>.
        </div>
        <div style={{ padding:'10px 6px 0', fontSize:11, color:'var(--text3)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>{user?.email?.split('@')[0]}</span>
          <button className="btn btn-ghost btn-xs"
            onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}>
            Odhlásit
          </button>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  )
}
