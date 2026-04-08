'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const [stats, setStats] = useState({ inbox: 0, claimed: 0, review: 0, published: 0, projects: 0 })

  useEffect(() => {
    const load = async () => {
      const [{ count: inbox }, { count: claimed }, { count: review }, { count: published }, { count: projectsCount }] = await Promise.all([
        supabase.from('tools').select('*', { count: 'exact', head: true }).eq('status', 'new'),
        supabase.from('tools').select('*', { count: 'exact', head: true }).eq('status', 'claimed'),
        supabase.from('use_cases').select('*', { count: 'exact', head: true }).eq('status', 'review'),
        supabase.from('use_cases').select('*', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('projects').select('*', { count: 'exact', head: true }),
      ])
      setStats({ inbox: inbox ?? 0, claimed: claimed ?? 0, review: review ?? 0, published: published ?? 0, projects: projectsCount ?? 0 })
    }
    load()
  }, [])

  return (
    <>
      <div className="page-header">
        <div><h1>Přehled</h1><p>Stav AI laboratoře — nástroje, claimy a use casy.</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => router.push('/app/inbox')}>⟳ Discovery</button>
          <button className="btn btn-primary" onClick={() => router.push('/app/chat')}>+ Nový use case</button>
        </div>
      </div>
      <div className="page-body">
        <div className="stats-row">
          {[
            { label: 'Noví kandidáti', value: stats.inbox, sub: 'v inboxu', href: '/app/inbox' },
            { label: 'Claimnuté nástroje', value: stats.claimed, sub: 'aktivní', href: '/app/claimboard' },
            { label: 'Čeká na kontrolu', value: stats.review, sub: 'fronta', href: '/app/review' },
            { label: 'Publikované use cases', value: stats.published, sub: 'v knihovně', href: '/app/usecases?filter=published' },
            { label: 'Projekty', value: stats.projects, sub: 'zdokumentováno', href: '/app/projects' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ cursor:'pointer' }} onClick={() => router.push(s.href)}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
            </div>
          ))}
        </div>
        <div className="wf-grid">
          <div className="wf-card">
            <h3>📥 Inbox nástrojů</h3>
            <p>Přidej AI nástroje jako kandidáty a claimni je pro evaluaci.</p>
            <div className="wf-card-btns">
              <button className="btn btn-outline btn-sm" onClick={() => router.push('/app/inbox')}>Otevřít inbox</button>
            </div>
          </div>
          <div className="wf-card">
            <h3>✎ Claim → Test → Draft</h3>
            <p>Claimni nástroj, vyplň evaluaci a vygeneruj draft use case pomocí AI.</p>
            <div className="wf-card-btns">
              <button className="btn btn-outline btn-sm" onClick={() => router.push('/app/claimboard')}>Moje claimy</button>
            </div>
          </div>
          <div className="wf-card">
            <h3>💬 Chat asistent</h3>
            <p>Popiš projekt nebo problém. AI se doptá a vytvoří kompletní use case draft.</p>
            <div className="wf-card-btns">
              <button className="btn btn-outline btn-sm" onClick={() => router.push('/app/chat')}>Otevřít chat</button>
            </div>
          </div>
          <div className="wf-card">
            <h3>📁 Projekty</h3>
            <p>Zpětná analýza projektů kde byla použita AI. Co fungovalo, co ne a co příště.</p>
            <div className="wf-card-btns">
              <button className="btn btn-outline btn-sm" onClick={() => router.push('/app/projects')}>Otevřít projekty</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
