'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  tool_ratings: { tool: string; rating: number; note?: string }[]
  overall_rating: number | null
  would_repeat: string | null
  author_name: string | null
  created_at: string
}

const EMPTY_FORM = {
  title: '', description: '', client: '', team: '', duration: '', tools_used: '',
  project_goal: '', what_worked: '', what_failed: '', lessons_learned: '',
  avoid_next_time: '', process_that_worked: '', ai_contribution: '',
  overall_rating: '', would_repeat: '',
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

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Project | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const load = () => {
    supabase.from('projects').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setProjects((data ?? []) as Project[]))
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const openEdit = (p: Project) => {
    setForm({
      title: p.title ?? '', description: p.description ?? '', client: p.client ?? '',
      team: p.team ?? '', duration: '', tools_used: p.tools_used ?? '',
      project_goal: p.project_goal ?? '', what_worked: p.what_worked ?? '',
      what_failed: p.what_failed ?? '', lessons_learned: p.lessons_learned ?? '',
      avoid_next_time: p.avoid_next_time ?? '', process_that_worked: p.process_that_worked ?? '',
      ai_contribution: p.ai_contribution ?? '',
      overall_rating: p.overall_rating?.toString() ?? '', would_repeat: p.would_repeat ?? '',
    })
    setEditingId(p.id)
    setSelected(null)
    setShowForm(true)
  }

  const saveManual = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title, description: form.description || null,
      client: form.client || null, team: form.team || null,
      duration: form.duration || null, tools_used: form.tools_used || null,
      project_goal: form.project_goal || null, what_worked: form.what_worked || null,
      what_failed: form.what_failed || null, lessons_learned: form.lessons_learned || null,
      avoid_next_time: form.avoid_next_time || null, process_that_worked: form.process_that_worked || null,
      ai_contribution: form.ai_contribution || null,
      overall_rating: form.overall_rating ? Number(form.overall_rating) : null,
      would_repeat: form.would_repeat || null,
    }
    if (editingId) {
      const { error } = await supabase.from('projects').update(payload).eq('id', editingId)
      if (error) { console.error(error); alert('Chyba při ukládání: ' + error.message); setSaving(false); return }
      setProjects(prev => prev.map(p => p.id === editingId ? { ...p, ...payload } : p))
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('projects').insert({ ...payload, author_id: user?.id, author_name: user?.email?.split('@')[0], status: 'draft' })
      if (error) { console.error(error); alert('Chyba při ukládání: ' + error.message); setSaving(false); return }
      load()
    }
    setSaving(false)
    setShowForm(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const deleteProject = async (id: string) => {
    const { error } = await supabase.from('projects').delete().eq('id', id)
    if (error) { console.error(error); alert('Chyba při mazání: ' + error.message); return }
    setProjects(prev => prev.filter(p => p.id !== id))
    setDeleteConfirm(null)
    setSelected(null)
  }

  const sendToReview = async (id: string) => {
    await supabase.from('projects').update({ status: 'review' }).eq('id', id)
    setProjects(prev => prev.map(p => p.id === id ? { ...p, status: 'review' } : p))
    setSelected(null)
  }

  const filtered = projects.filter(p =>
    !q || p.title?.toLowerCase().includes(q.toLowerCase()) ||
    p.client?.toLowerCase().includes(q.toLowerCase()) ||
    p.tools_used?.toLowerCase().includes(q.toLowerCase())
  )

  const statusTag: Record<string, string> = {
    draft: '', review: 'tag-amber', published: 'tag-green'
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Projekty</h1><p>Zpětná analýza projektů kde byla použita AI.</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => { setEditingId(null); setForm(EMPTY_FORM); setShowForm(true) }}>+ Vyplnit ručně</button>
          <button className="btn btn-primary" onClick={() => router.push('/app/projects/chat')}>+ Nový projekt (chat)</button>
        </div>
      </div>
      <div className="page-body">
        <input className="search-box" placeholder="Hledat projekty…" value={q} onChange={e => setQ(e.target.value)} />
        {filtered.length === 0
          ? <div className="empty"><span className="empty-icon">📁</span>Žádné projekty. Vytvoř první přes chat.</div>
          : filtered.map(p => (
            <div key={p.id} className="uc-card">
              <div style={{ flex: 1 }}>
                <div className="uc-title">{p.title}</div>
                <div className="uc-meta">
                  {p.client && <>{p.client} · </>}
                  {p.team && <>{p.team} · </>}
                  {p.author_name && <>autor: {p.author_name}</>}
                </div>
                {p.description && <div className="uc-desc">{p.description}</div>}
                <div className="uc-tags">
                  <span className={`tag ${statusTag[p.status] || ''}`}>{p.status}</span>
                  {p.overall_rating && <span className="tag">⭐ {p.overall_rating}/10</span>}
                  {p.tools_used && <span className="tag">{p.tools_used.split(',')[0].trim()}</span>}
                </div>
              </div>
              <div className="uc-actions">
                <button className="btn btn-outline btn-sm" onClick={() => setSelected(p)}>Detail</button>
                {p.status === 'draft' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => sendToReview(p.id)}>→ Review</button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {/* FORMULÁŘ (nový i editace) */}
      {showForm && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 620 }}>
            <button className="modal-close" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}>×</button>
            <div className="modal-header"><div className="modal-title">{editingId ? 'Upravit projekt' : 'Vyplnit projekt ručně'}</div></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Název projektu *</label>
                <input className="form-input" value={form.title} onChange={f('title')} placeholder="Název projektu" />
              </div>
              <div className="form-group">
                <label className="form-label">Klient</label>
                <input className="form-input" value={form.client} onChange={f('client')} placeholder="Klient nebo interní" />
              </div>
              <div className="form-group">
                <label className="form-label">Tým</label>
                <input className="form-input" value={form.team} onChange={f('team')} placeholder="Kdo pracoval na projektu?" />
              </div>
              <div className="form-group">
                <label className="form-label">Délka projektu</label>
                <input className="form-input" value={form.duration} onChange={f('duration')} placeholder="např. 3 měsíce" />
              </div>
              <div className="form-group">
                <label className="form-label">AI nástroje</label>
                <input className="form-input" value={form.tools_used} onChange={f('tools_used')} placeholder="Claude, Midjourney…" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Popis (1–2 věty)</label>
                <textarea className="form-textarea" rows={2} value={form.description} onChange={f('description')} placeholder="Stručný popis projektu" />
              </div>
            </div>

            <Section title="Cíl a průběh" />
            <div className="form-group">
              <label className="form-label">Cíl projektu</label>
              <textarea className="form-textarea" rows={2} value={form.project_goal} onChange={f('project_goal')} placeholder="Co byl záměr projektu?" />
            </div>

            <Section title="Co fungovalo a co ne" />
            <div className="form-group">
              <label className="form-label">Co fungovalo skvěle</label>
              <textarea className="form-textarea" rows={2} value={form.what_worked} onChange={f('what_worked')} placeholder="Největší úspěchy" />
            </div>
            <div className="form-group">
              <label className="form-label">Největší výzvy</label>
              <textarea className="form-textarea" rows={2} value={form.what_failed} onChange={f('what_failed')} placeholder="Co bylo nejtěžší nebo zklamalo?" />
            </div>
            <div className="form-group">
              <label className="form-label">Osvědčený postup</label>
              <textarea className="form-textarea" rows={2} value={form.process_that_worked} onChange={f('process_that_worked')} placeholder="Jaký přístup se nejvíc osvědčil?" />
            </div>

            <Section title="Poučení" />
            <div className="form-group">
              <label className="form-label">Lessons learned</label>
              <textarea className="form-textarea" rows={2} value={form.lessons_learned} onChange={f('lessons_learned')} placeholder="Co si odnášíš z projektu?" />
            </div>
            <div className="form-group">
              <label className="form-label">Příště se vyvarovat</label>
              <textarea className="form-textarea" rows={2} value={form.avoid_next_time} onChange={f('avoid_next_time')} placeholder="Čemu se příště vyhnout?" />
            </div>

            <Section title="AI příspěvek a hodnocení" />
            <div className="form-group">
              <label className="form-label">Přínos AI</label>
              <textarea className="form-textarea" rows={2} value={form.ai_contribution} onChange={f('ai_contribution')} placeholder="Jak AI přispěla k výsledku?" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Celkové hodnocení (1–10)</label>
                <select className="form-select" value={form.overall_rating} onChange={f('overall_rating')}>
                  <option value="">—</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Zopakoval/a bys přístup?</label>
                <select className="form-select" value={form.would_repeat} onChange={f('would_repeat')}>
                  <option value="">—</option>
                  <option value="ano">Ano</option>
                  <option value="ano s úpravami">Ano, s úpravami</option>
                  <option value="ne">Ne</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM) }}>Zrušit</button>
              <button className="btn btn-primary" onClick={saveManual} disabled={saving || !form.title.trim()}>
                {saving ? 'Ukládám…' : editingId ? 'Uložit změny' : 'Uložit jako draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ width: 680 }}>
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{selected.title}</div>
              <div className="modal-subtitle">
                {selected.client && <>{selected.client} · </>}
                {selected.team && <>{selected.team} · </>}
                autor: {selected.author_name}
              </div>
            </div>

            {selected.description && (
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>{selected.description}</div>
            )}

            <Section title="Cíl a průběh" />
            <Field label="Cíl projektu" value={selected.project_goal} />
            <Field label="AI nástroje" value={selected.tools_used} />
            <Field label="Přínos AI" value={selected.ai_contribution} />

            <Section title="Co fungovalo a co ne" />
            <Field label="Co fungovalo skvěle" value={selected.what_worked} />
            <Field label="Největší výzvy" value={selected.what_failed} />
            <Field label="Osvědčený postup" value={selected.process_that_worked} />

            <Section title="Poučení" />
            <Field label="Lessons learned" value={selected.lessons_learned} />
            <Field label="Příště se vyvarovat" value={selected.avoid_next_time} />

            {selected.tool_ratings && selected.tool_ratings.length > 0 && (
              <>
                <Section title="Hodnocení nástrojů" />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {selected.tool_ratings.map((tr, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: 13.5 }}>
                      <span style={{ fontWeight: 600, color: 'var(--text)' }}>{tr.tool}</span>
                      <span className="tag">⭐ {tr.rating}/10</span>
                      {tr.note && <span style={{ color: 'var(--text2)' }}>{tr.note}</span>}
                    </div>
                  ))}
                </div>
              </>
            )}

            <Section title="Finální verdikt" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {selected.overall_rating && <span className="tag">⭐ {selected.overall_rating}/10</span>}
              {selected.would_repeat && <span className={`tag ${selected.would_repeat === 'ano' ? 'tag-green' : selected.would_repeat === 'ne' ? 'tag-red' : 'tag-amber'}`}>Zopakovat: {selected.would_repeat}</span>}
            </div>

            <div className="modal-footer">
              <button className="btn btn-danger btn-sm" onClick={() => setDeleteConfirm(selected.id)}>Smazat</button>
              <button className="btn btn-outline btn-sm" onClick={() => openEdit(selected)}>Upravit</button>
              {selected.status === 'draft' && (
                <button className="btn btn-primary" onClick={() => sendToReview(selected.id)}>→ Poslat do review</button>
              )}
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}

      {/* POTVRZENÍ SMAZÁNÍ */}
      {deleteConfirm && (
        <div className="modal-bg open" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Smazat projekt?</div>
              <div className="modal-subtitle">Tato akce je nevratná.</div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setDeleteConfirm(null)}>Zrušit</button>
              <button className="btn btn-danger" onClick={() => deleteProject(deleteConfirm)}>Smazat</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
