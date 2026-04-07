'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

type NavItem = { id: string; label: string; icon: string; href: string }
type NavSection = { heading?: string; items: NavItem[] }

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { id: 'chat',      label: 'Chat',    icon: '💬', href: '/app/chat' },
      { id: 'dashboard', label: 'Přehled', icon: '▦',  href: '/app' },
    ],
  },
  {
    heading: 'AI NÁSTROJE',
    items: [
      { id: 'inbox',      label: 'Inbox nástrojů', icon: '⊹', href: '/app/inbox' },
      { id: 'claimboard', label: 'Claim board',    icon: '✎', href: '/app/claimboard' },
      { id: 'interview',  label: 'Interview',      icon: '⚙', href: '/app/interview' },
      { id: 'usecases',   label: 'Use casy',       icon: '⧉', href: '/app/usecases' },
    ],
  },
  {
    heading: 'PROJEKTY',
    items: [
      { id: 'projects', label: 'Projekty', icon: '⬡', href: '/app/projects' },
    ],
  },
  {
    heading: 'SPRÁVA',
    items: [
      { id: 'review',   label: 'Kontrola',  icon: '✓', href: '/app/review' },
      { id: 'settings', label: 'Nastavení', icon: '◈', href: '/app/settings' },
    ],
  },
]

const NAV = NAV_SECTIONS.flatMap(s => s.items)

const navHeadingStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.7px',
  color: 'rgba(255,255,255,0.25)',
  marginTop: 16,
  marginBottom: 4,
  paddingLeft: 11,
  whiteSpace: 'nowrap',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(true)

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

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', color: '#606060', background: '#0a0a0a' }}>
      Načítám…
    </div>
  )

  const activeId = NAV.find(n => pathname === n.href || (n.href !== '/app' && pathname.startsWith(n.href)))?.id ?? 'dashboard'

  return (
    <div className="app">
      {/* Sidebar toggle button */}
      <button
        onClick={() => setSidebarOpen(o => !o)}
        title={sidebarOpen ? 'Skrýt sidebar' : 'Zobrazit sidebar'}
        style={{
          position: 'fixed',
          top: '50%',
          left: sidebarOpen ? 208 : 0,
          transform: 'translateY(-50%)',
          zIndex: 60,
          background: 'transparent',
          border: 'none',
          borderRadius: 0,
          boxShadow: 'none',
          color: '#fff',
          fontSize: 28,
          cursor: 'pointer',
          lineHeight: 1,
          padding: '4px 2px',
          transition: 'left 0.25s ease, color 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#e02020')}
        onMouseLeave={e => (e.currentTarget.style.color = '#fff')}
      >
        {sidebarOpen ? '‹' : '›'}
      </button>

      <nav className={`sidebar${sidebarOpen ? '' : ' closed'}`}>
        <div className="sidebar-logo" onClick={() => router.push('/app/chat')} style={{ cursor: 'pointer' }}>
          <div className="sidebar-logo-mark">λ</div>
          <div className="sidebar-logo-text">
            <strong>AI Laboratoř</strong>
            <span>use case systém</span>
          </div>
        </div>
        {NAV_SECTIONS.map((section, i) => (
          <div key={i}>
            {section.heading && <div style={navHeadingStyle}>{section.heading}</div>}
            {section.items.map(n => (
              <button key={n.id} className={`nav-link ${activeId === n.id ? 'active' : ''}`}
                onClick={() => router.push(n.href)}>
                <span className="nav-icon">{n.icon}</span>{n.label}
              </button>
            ))}
          </div>
        ))}
        <div className="sidebar-tip">
          <strong>Tip</strong><br />
          Napiš popis v <strong>Chatu</strong> → AI se doptá → uloží use case. Nebo claimni nástroj z <strong>Inboxu</strong>.
        </div>
        <div style={{ padding: '10px 6px 0', fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', whiteSpace: 'nowrap' }}>
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
