'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type UseCase } from '@/lib/supabase'
import { useRole } from '@/lib/useRole'

type Project = {
  id: string
  title: string
  description: string | null
  status: string
  client: string | null
  team: string | null
  tools_used: string | null
  project_goal: string | null
  what_worked: string | null
  what_failed: string | null
  lessons_learned: string | null
  avoid_next_time: string | null
  process_that_worked: string | null
  ai_contribution: string | null
  overall_rating: number | null
  would_repeat: string | null
  author_name: string | null
  created_at: string
}

function Section({ title }: { title: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '18px 0 10px', paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
      {title}
    </div>
  )
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>{value}</div>
    </div>
  )
}

export default function ReviewPage() {
  const router = useRouter()
  const { canAccess, loading: roleLoading } = useRole()
  useEffect(() => {
    if (!roleLoading && !canAccess('review')) router.push('/app/chat')
  }, [roleLoading, canAccess, router])

  const [items, setItems] = useState<UseCase[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')

  const load = async () => {
    const [{ data: usecases }, { data: projectsData }] = await Promise.all([
      supabase.from('use_cases').select('*').eq('status', 'review').order('updated_at', { ascending: false }),
      supabase.from('projects').select('*').eq('status', 'review').order('updated_at', { ascending: false }),
    ])
    setItems(usecases ?? [])
    setProjects(projectsData ?? [])
  }

  useEffect(() => { load() }, [])

  const publish = async (id: string) => {
    const { data: setting } = await supabase.from('app_settings').select('value').eq('key', 'revision_days').single()
    const revisionDays = parseInt(setting?.value ?? '90')
    const now = new Date()
    const revisionDueAt = new Date(now.getTime() + revisionDays * 24 * 60 * 60 * 1000)
    await supabase.from('use_cases').update({
      status: 'published',
      published_at: now.toISOString(),
      revision_due_at: revisionDueAt.toISOString(),
      revision_status: 'ok',
    }).eq('id', id)
    setSelectedUseCase(null)
    load()
    setWebhookStatus('loading')
    try {
      const res = await fetch('/api/webhook-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useCaseId: id }),
      })
      setWebhookStatus(res.ok ? 'success' : 'error')
    } catch {
      setWebhookStatus('error')
    }
    setTimeout(() => setWebhookStatus('idle'), 4000)
  }

  const reject = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'draft' }).eq('id', id)
    setSelectedUseCase(null)
    load()
  }

  const publishProject = async (id: string) => {
    await supabase.from('projects').update({ status: 'published' }).eq('id', id)
    setSelectedProject(null)
    load()
  }

  const rejectProject = async (id: string) => {
    await supabase.from('projects').update({ status: 'draft' }).eq('id', id)
    setSelectedProject(null)
    load()
  }

  const exportToHTML = (u: UseCase) => {
    const uc = u as any
    const row = (label: string, val?: string | number | null) => val ? `<h2>${label}</h2><p>${String(val).replace(/\n/g, '<br>')}</p>` : ''
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${u.title}</title><style>
      body{font-family:Arial,sans-serif;max-width:800px;margin:40px auto;padding:20px;color:#1a1916;}
      h1{color:#e02020;border-bottom:2px solid #e02020;padding-bottom:10px;}
      h2{color:#333;margin-top:24px;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;}
      p{line-height:1.6;color:#555;margin:0 0 8px;}
      .meta{color:#888;font-size:13px;margin-bottom:24px;}
      .tag{display:inline-block;background:#f0f0f0;padding:2px 8px;border-radius:10px;font-size:12px;margin:2px;}
      .score{font-size:28px;font-weight:bold;color:#e02020;}
      @media print{body{margin:20px;}}
    </style></head><body>
      <h1>${u.title}</h1>
      <div class="meta">
        ${u.tool_name ? `<strong>Nástroj:</strong> ${u.tool_name} &nbsp;` : ''}
        ${u.team ? `<strong>Tým:</strong> ${u.team} &nbsp;` : ''}
        ${u.author_name ? `<strong>Autor:</strong> ${u.author_name} &nbsp;` : ''}
        <strong>Status:</strong> ke schválení &nbsp;
        <strong>Datum:</strong> ${new Date(u.created_at).toLocaleDateString('cs-CZ')}
      </div>
      ${u.description ? `<p><em>${u.description}</em></p>` : ''}
      ${row('Účel nástroje', uc.purpose)}
      ${row('Podobné nástroje', uc.similar_tools)}
      ${row('Nejlepší pro', uc.best_for_roles)}
      ${row('Úspora času', uc.time_saved)}
      ${row('Kvalita výstupů', uc.output_quality)}
      ${row('Slabiny', uc.weaknesses)}
      ${row('Bezpečnostní rizika', uc.security_risks)}
      ${row('Limity nástroje', uc.limitations)}
      <h2>Finální verdikt</h2>
      <p>
        ${uc.recommended ? `<span class="tag">Doporučení: ${uc.recommended}</span> ` : ''}
        ${uc.rating ? `<span class="score">${uc.rating}/10</span> ` : ''}
        ${u.effort ? `<span class="tag">Náročnost: ${u.effort}</span> ` : ''}
        ${u.impact ? `<span class="tag">Dopad: ${u.impact}</span>` : ''}
      </p>
    </body></html>`
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${u.title.replace(/[^a-z0-9]/gi, '_')}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sectionHeader = (title: string) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 10, marginTop: 4 }}>
      {title}
    </div>
  )

  return (
    <>
      <div className="page-header">
        <div><h1>Kontrola</h1><p>Fronta use casů a projektů čekajících na schválení.</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={load}>⟳ Obnovit</button>
        </div>
      </div>
      {webhookStatus !== 'idle' && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          padding: '10px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: webhookStatus === 'loading' ? 'var(--bg2)' : webhookStatus === 'success' ? '#166534' : '#7f1d1d',
          color: webhookStatus === 'loading' ? 'var(--text2)' : '#fff',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          {webhookStatus === 'loading' && 'Odesílám na Make.com...'}
          {webhookStatus === 'success' && '✅ Odesláno na Make.com'}
          {webhookStatus === 'error' && '⚠️ Odeslání selhalo'}
        </div>
      )}
      <div className="page-body">

        {/* USE CASES */}
        {sectionHeader('Use casy ke kontrole')}
        {items.length === 0
          ? <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, marginBottom: 24 }}>Žádné use casy nečekají na review.</div>
          : items.map(u => (
            <div key={u.id} className="review-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedUseCase(u)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{u.title}</div>
                    <span className="tag tag-violet">AI nástroj</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                    {u.tool_name && <>{u.tool_name} · </>}{u.team && <>{u.team} · </>}autor: {u.author_name}
                  </div>
                  {u.description && <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{u.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-accent btn-sm" onClick={() => publish(u.id)}>✓ Publikovat</button>
                  <button className="btn btn-danger btn-sm" onClick={() => reject(u.id)}>← Vrátit</button>
                </div>
              </div>
            </div>
          ))
        }

        {/* PROJECTS */}
        {sectionHeader('Projekty ke kontrole')}
        {projects.length === 0
          ? <div className="card" style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>Žádné projekty nečekají na review.</div>
          : projects.map(p => (
            <div key={p.id} className="review-card" style={{ cursor: 'pointer' }} onClick={() => setSelectedProject(p)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <div style={{ fontSize: 15, fontWeight: 600 }}>{p.title}</div>
                    <span className="tag tag-amber">Projekt</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
                    {p.client && <>{p.client} · </>}{p.team && <>{p.team} · </>}autor: {p.author_name}
                  </div>
                  {p.description && <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{p.description}</div>}
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-accent btn-sm" onClick={() => publishProject(p.id)}>✓ Publikovat</button>
                  <button className="btn btn-danger btn-sm" onClick={() => rejectProject(p.id)}>← Vrátit</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

      {/* USE CASE DETAIL MODAL */}
      {selectedUseCase && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelectedUseCase(null)}>
          <div className="modal" style={{ width: 680 }}>
            <button className="modal-close" onClick={() => setSelectedUseCase(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{selectedUseCase.title}</div>
              <div className="modal-subtitle">
                {selectedUseCase.tool_name && <>{selectedUseCase.tool_name} · </>}
                {selectedUseCase.team && <>{selectedUseCase.team} · </>}
                autor: {selectedUseCase.author_name}
              </div>
            </div>

            {selectedUseCase.description && (
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>{selectedUseCase.description}</div>
            )}

            <Section title="Základní přehled" />
            <Field label="Účel nástroje" value={(selectedUseCase as any).purpose} />
            <Field label="Podobné nástroje" value={(selectedUseCase as any).similar_tools} />
            <Field label="Cena" value={(selectedUseCase as any).pricing} />

            <Section title="Přínos pro byznys" />
            <Field label="Nejlepší pro" value={(selectedUseCase as any).best_for_roles} />
            <Field label="Úspora času" value={(selectedUseCase as any).time_saved} />
            <Field label="Aha! moment" value={(selectedUseCase as any).aha_moment} />

            <Section title="Uživatelská přívětivost" />
            <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
              {(selectedUseCase as any).onboarding_score && <span className="tag">Onboarding: {(selectedUseCase as any).onboarding_score}/5</span>}
              {(selectedUseCase as any).ui_intuitive && <span className="tag">UI: {(selectedUseCase as any).ui_intuitive}</span>}
            </div>

            <Section title="Výkon AI" />
            <Field label="Kvalita výstupů" value={(selectedUseCase as any).output_quality} />
            {(selectedUseCase as any).hallucinates && (
              <div style={{ marginBottom: 12 }}>
                <span className="tag">Halucinace: {(selectedUseCase as any).hallucinates}</span>
              </div>
            )}

            <Section title="Rizika" />
            <Field label="Slabiny" value={(selectedUseCase as any).weaknesses} />
            <Field label="Bezpečnostní rizika" value={(selectedUseCase as any).security_risks} />
            <Field label="Limity nástroje" value={(selectedUseCase as any).limitations} />

            <Section title="Finální verdikt" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {(selectedUseCase as any).recommended && <span className={`tag ${(selectedUseCase as any).recommended === 'ano' ? 'tag-green' : (selectedUseCase as any).recommended === 'ne' ? 'tag-red' : 'tag-amber'}`}>Doporučení: {(selectedUseCase as any).recommended}</span>}
              {(selectedUseCase as any).rating && <span className="tag">⭐ {(selectedUseCase as any).rating}/10</span>}
              {selectedUseCase.effort && <span className="tag">Náročnost: {selectedUseCase.effort}</span>}
              {selectedUseCase.impact && <span className="tag">Dopad: {selectedUseCase.impact}</span>}
            </div>

            <div className="modal-footer">
              <button className="btn btn-danger btn-sm" onClick={() => reject(selectedUseCase.id)}>← Vrátit do draftu</button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToHTML(selectedUseCase)}>⬇ Stáhnout</button>
              <button className="btn btn-ghost" onClick={() => setSelectedUseCase(null)}>Zavřít</button>
              <button className="btn btn-accent" onClick={() => publish(selectedUseCase.id)}>✓ Publikovat</button>
            </div>
          </div>
        </div>
      )}

      {/* PROJECT DETAIL MODAL */}
      {selectedProject && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelectedProject(null)}>
          <div className="modal" style={{ width: 680 }}>
            <button className="modal-close" onClick={() => setSelectedProject(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{selectedProject.title}</div>
              <div className="modal-subtitle">
                {selectedProject.client && <>{selectedProject.client} · </>}
                {selectedProject.team && <>{selectedProject.team} · </>}
                autor: {selectedProject.author_name}
              </div>
            </div>

            {selectedProject.description && (
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>{selectedProject.description}</div>
            )}

            <Section title="Základní info" />
            <Field label="Klient" value={selectedProject.client} />
            <Field label="Tým" value={selectedProject.team} />
            <Field label="Cíl projektu" value={selectedProject.project_goal} />
            <Field label="AI nástroje" value={selectedProject.tools_used} />

            <Section title="Průběh projektu" />
            <Field label="Co fungovalo" value={selectedProject.what_worked} />
            <Field label="Výzvy a zklamání" value={selectedProject.what_failed} />
            <Field label="Osvědčený postup" value={selectedProject.process_that_worked} />

            <Section title="Poučení" />
            <Field label="Co příště jinak" value={selectedProject.lessons_learned} />
            <Field label="Čemu se vyvarovat" value={selectedProject.avoid_next_time} />
            <Field label="Příspěvek AI" value={selectedProject.ai_contribution} />

            <Section title="Hodnocení" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {selectedProject.overall_rating && <span className="tag">⭐ {selectedProject.overall_rating}/10</span>}
              {selectedProject.would_repeat && <span className="tag">{selectedProject.would_repeat}</span>}
            </div>

            <div className="modal-footer">
              <button className="btn btn-danger btn-sm" onClick={() => rejectProject(selectedProject.id)}>← Vrátit do draftu</button>
              <button className="btn btn-ghost" onClick={() => setSelectedProject(null)}>Zavřít</button>
              <button className="btn btn-accent" onClick={() => publishProject(selectedProject.id)}>✓ Publikovat</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
