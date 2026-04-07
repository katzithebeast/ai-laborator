'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [team, setTeam] = useState('')
  const [saved, setSaved] = useState(false)
  const [sidebarDefault, setSidebarDefault] = useState(false)
  const [lightMode, setLightMode] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setEmail(user?.email ?? '')
      const { data } = await supabase.from('profiles').select('*').eq('id', user?.id).single()
      if (data) { setFullName(data.full_name ?? ''); setTeam(data.team ?? '') }
    }
    load()
    setSidebarDefault(localStorage.getItem('sidebar_default_open') !== 'false')
    setLightMode(localStorage.getItem('theme') === 'light')
  }, [])

  const toggleSidebar = (val: boolean) => {
    setSidebarDefault(val)
    localStorage.setItem('sidebar_default_open', String(val))
  }

  const toggleLightMode = (val: boolean) => {
    setLightMode(val)
    const theme = val ? 'light' : 'dark'
    localStorage.setItem('theme', theme)
    document.documentElement.setAttribute('data-theme', theme)
  }

  const toggleSwitch = (active: boolean, onToggle: () => void) => (
    <button
      onClick={onToggle}
      style={{
        flexShrink: 0, width: 44, height: 24, borderRadius: 12, border: 'none',
        cursor: 'pointer', position: 'relative', padding: 0, transition: 'background 0.2s',
        background: active ? '#e02020' : 'var(--border2)',
      }}
    >
      <span style={{
        position: 'absolute', top: 3, left: active ? 23 : 3,
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }} />
    </button>
  )

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').upsert({ id: user?.id, full_name: fullName, team })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Nastavení</h1><p>Správa profilu a účtu.</p></div>
      </div>
      <div className="page-body">
        <div className="settings-grid">
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Profil</h3>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={email} disabled style={{ opacity:0.6 }} />
            </div>
            <div className="form-group">
              <label className="form-label">Jméno</label>
              <input className="form-input" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Jan Novák" />
            </div>
            <div className="form-group">
              <label className="form-label">Tým / Oddělení</label>
              <input className="form-input" value={team} onChange={e => setTeam(e.target.value)} placeholder="Marketing, IT…" />
            </div>
            <button className="btn btn-primary" onClick={save}>{saved ? '✓ Uloženo' : 'Uložit'}</button>
          </div>
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:16 }}>Předvolby zobrazení</h3>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16 }}>
              <div>
                <div style={{ fontSize:13, color:'var(--text)', marginBottom:2 }}>Boční panel otevřený po přihlášení</div>
                <div style={{ fontSize:12, color:'var(--text3)' }}>Sidebar se otevře automaticky při každém načtení</div>
              </div>
              {toggleSwitch(sidebarDefault, () => toggleSidebar(!sidebarDefault))}
            </div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginTop:16, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize:13, color:'var(--text)', marginBottom:2 }}>Světlý režim</div>
                <div style={{ fontSize:12, color:'var(--text3)' }}>Přepnout na světlé téma aplikace</div>
              </div>
              {toggleSwitch(lightMode, () => toggleLightMode(!lightMode))}
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>O aplikaci</h3>
            <p style={{ fontSize:13, color:'var(--text2)', lineHeight:1.6, marginBottom:12 }}>
              <strong>AI Laboratoř</strong> — firemní systém pro správu AI use casů.<br /><br />
              AI chatbot (Claude) má API klíč uložený na serveru (Vercel). Zaměstnanci ho nevidí ani nezadávají.
            </p>
            <div style={{ fontSize:12, color:'var(--text3)' }}>
              Model: claude-sonnet-4-20250514<br />
              Hosting: Vercel<br />
              Databáze: Supabase (PostgreSQL)
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
