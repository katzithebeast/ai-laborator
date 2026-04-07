'use client'
import { useEffect, useState } from 'react'
import { supabase, type UseCase } from '@/lib/supabase'

const EMPTY_FORM = {
  title: '', tool_name: '', team: '', problem: '', solution: '',
  benefits: '', risks: '', effort: '', impact: '', tags: '',
}

export default function UseCasesPage() {
  const [usecases, setUsecases] = useState<UseCase[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<UseCase | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = () => {
    supabase.from('use_cases').select('*').order('created_at', { ascending: false })
      .then(({ data }) => setUsecases(data ?? []))
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const saveManual = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('use_cases').insert({
      title: form.title,
      tool_name: form.tool_name || null,
      team: form.team || null,
      problem: form.problem || null,
      solution: form.solution || null,
      benefits: form.benefits || null,
      risks: form.risks || null,
      effort: form.effort || null,
      impact: form.impact || null,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      author_id: user?.id,
      author_name: user?.email?.split('@')[0],
      status: 'draft',
    })
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY_FORM)
    load()
  }

  const sendToReview = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'review' }).eq('id', id)
    setUsecases(prev => prev.map(u => u.id === id ? { ...u, status: 'review' } : u))
    setSelected(null)
  }

  const filtered = usecases.filter(u =>
    !q || u.title?.toLowerCase().includes(q.toLowerCase()) ||
    u.tool_name?.toLowerCase().includes(q.toLowerCase()) ||
    u.team?.toLowerCase().includes(q.toLowerCase())
  )

  const statusTag: Record<string, string> = {
    draft: '', review: 'tag-amber', published: 'tag-green', archived: ''
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Use casy</h1><p>Knihovna use casů. Drafty pošli do review a publikuj.</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={() => setShowForm(true)}>+ Vyplnit ručně</button>
          <button className="btn btn-primary" onClick={() => window.location.href = '/app/chat'}>+ Nový use case</button>
        </div>
      </div>
      <div className="page-body">
        <input className="search-box" placeholder="Hledat use casy…" value={q} onChange={e => setQ(e.target.value)} />
        {filtered.length === 0
          ? <div className="empty"><span className="empty-icon">📋</span>Žádné use casy. Vytvoř první v Chatu.</div>
          : filtered.map(u => (
            <div key={u.id} className="uc-card">
              <div style={{ flex:1 }}>
                <div className="uc-title">{u.title}</div>
                <div className="uc-meta">
                  {u.tool_name && <>{u.tool_name} · </>}
                  {u.team && <>{u.team} · </>}
                  {u.author_name && <>autor: {u.author_name}</>}
                </div>
                {u.description && <div className="uc-desc">{u.description}</div>}
                <div className="uc-tags">
                  <span className={`tag ${statusTag[u.status] || ''}`}>{u.status}</span>
                  {u.effort && <span className="tag">effort: {u.effort}</span>}
                  {u.impact && <span className="tag">impact: {u.impact}</span>}
                  {u.tags?.map(t => <span key={t} className="tag">{t}</span>)}
                </div>
              </div>
              <div className="uc-actions">
                <button className="btn btn-outline btn-sm" onClick={() => setSelected(u)}>Detail</button>
                {u.status === 'draft' && (
                  <button className="btn btn-ghost btn-sm" onClick={() => sendToReview(u.id)}>→ Review</button>
                )}
              </div>
            </div>
          ))
        }
      </div>

      {showForm && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 560 }}>
            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            <div className="modal-header"><div className="modal-title">Vyplnit use case ručně</div></div>
            <div className="form-group">
              <label className="form-label">Název *</label>
              <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Krátký výstižný název" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Nástroj</label>
                <input className="form-input" value={form.tool_name} onChange={e => setForm({ ...form, tool_name: e.target.value })} placeholder="např. Notion AI" />
              </div>
              <div className="form-group">
                <label className="form-label">Tým / Oddělení</label>
                <input className="form-input" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} placeholder="např. Marketing" />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Problém</label>
              <textarea className="form-textarea" value={form.problem} onChange={e => setForm({ ...form, problem: e.target.value })} placeholder="Jaký problém řeší?" />
            </div>
            <div className="form-group">
              <label className="form-label">Řešení</label>
              <textarea className="form-textarea" value={form.solution} onChange={e => setForm({ ...form, solution: e.target.value })} placeholder="Jak AI nástroj pomáhá?" />
            </div>
            <div className="form-group">
              <label className="form-label">Přínosy</label>
              <textarea className="form-textarea" rows={2} value={form.benefits} onChange={e => setForm({ ...form, benefits: e.target.value })} placeholder="Klíčové přínosy" />
            </div>
            <div className="form-group">
              <label className="form-label">Rizika</label>
              <textarea className="form-textarea" rows={2} value={form.risks} onChange={e => setForm({ ...form, risks: e.target.value })} placeholder="Možná rizika" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Náročnost</label>
                <select className="form-select" value={form.effort} onChange={e => setForm({ ...form, effort: e.target.value })}>
                  <option value="">—</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dopad</label>
                <select className="form-select" value={form.impact} onChange={e => setForm({ ...form, impact: e.target.value })}>
                  <option value="">—</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tagy (čárkou)</label>
                <input className="form-input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="ai, hr, …" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}>Zrušit</button>
              <button className="btn btn-primary" onClick={saveManual} disabled={saving || !form.title.trim()}>
                {saving ? 'Ukládám…' : 'Uložit jako draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ width:640 }}>
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{selected.title}</div>
              <div className="modal-subtitle">{selected.tool_name} · {selected.team} · {selected.author_name}</div>
            </div>
            {[
              ['Problém', selected.problem],
              ['Řešení', selected.solution],
              ['Přínosy', selected.benefits],
              ['Rizika', selected.risks],
            ].filter(([, v]) => v).map(([label, val]) => (
              <div key={label as string} style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:600, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>{label}</div>
                <div style={{ fontSize:13.5, color:'var(--text2)', lineHeight:1.6 }}>{val}</div>
              </div>
            ))}
            <div style={{ display:'flex', gap:12, marginTop:8 }}>
              {selected.effort && <span className="tag">Náročnost: {selected.effort}</span>}
              {selected.impact && <span className="tag">Dopad: {selected.impact}</span>}
              {selected.confidence_score > 0 && <span className="tag">Confidence: {selected.confidence_score}%</span>}
            </div>
            <div className="modal-footer">
              {selected.status === 'draft' && (
                <button className="btn btn-primary" onClick={() => sendToReview(selected.id)}>→ Poslat do review</button>
              )}
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Zavřít</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
