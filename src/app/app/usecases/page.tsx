'use client'
import { useEffect, useState } from 'react'
import { supabase, type UseCase } from '@/lib/supabase'

const EMPTY_FORM = {
  title: '', tool_name: '', team: '', description: '',
  purpose: '', similar_tools: '', best_for_roles: '', time_saved: '', aha_moment: '',
  onboarding_score: '', ui_intuitive: '', output_quality: '', hallucinates: '',
  weaknesses: '', security_risks: '', limitations: '',
  recommended: '', rating: '', pricing: '',
  effort: '', impact: '', tags: '',
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

  const f = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  const saveManual = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('use_cases').insert({
      title: form.title,
      tool_name: form.tool_name || null,
      team: form.team || null,
      description: form.description || null,
      purpose: form.purpose || null,
      similar_tools: form.similar_tools || null,
      best_for_roles: form.best_for_roles || null,
      time_saved: form.time_saved || null,
      aha_moment: form.aha_moment || null,
      onboarding_score: form.onboarding_score ? Number(form.onboarding_score) : null,
      ui_intuitive: form.ui_intuitive || null,
      output_quality: form.output_quality || null,
      hallucinates: form.hallucinates || null,
      weaknesses: form.weaknesses || null,
      security_risks: form.security_risks || null,
      limitations: form.limitations || null,
      recommended: form.recommended || null,
      rating: form.rating ? Number(form.rating) : null,
      pricing: form.pricing || null,
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
              <div style={{ flex: 1 }}>
                <div className="uc-title">{u.title}</div>
                <div className="uc-meta">
                  {u.tool_name && <>{u.tool_name} · </>}
                  {u.team && <>{u.team} · </>}
                  {u.author_name && <>autor: {u.author_name}</>}
                </div>
                {u.description && <div className="uc-desc">{u.description}</div>}
                <div className="uc-tags">
                  <span className={`tag ${statusTag[u.status] || ''}`}>{u.status}</span>
                  {(u as any).rating && <span className="tag">⭐ {(u as any).rating}/10</span>}
                  {(u as any).recommended && <span className="tag">{(u as any).recommended === 'ano' ? '✓ doporučeno' : (u as any).recommended === 'ne' ? '✗ nedoporučeno' : '? možná'}</span>}
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

      {/* RUČNÍ FORMULÁŘ */}
      {showForm && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ width: 620 }}>
            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
            <div className="modal-header"><div className="modal-title">Vyplnit use case ručně</div></div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Název *</label>
                <input className="form-input" value={form.title} onChange={f('title')} placeholder="Krátký výstižný název" />
              </div>
              <div className="form-group">
                <label className="form-label">Nástroj</label>
                <input className="form-input" value={form.tool_name} onChange={f('tool_name')} placeholder="např. Notion AI" />
              </div>
              <div className="form-group">
                <label className="form-label">Tým / Oddělení</label>
                <input className="form-input" value={form.team} onChange={f('team')} placeholder="např. Marketing" />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Popis (1–2 věty)</label>
                <textarea className="form-textarea" rows={2} value={form.description} onChange={f('description')} placeholder="Stručný popis use case" />
              </div>
            </div>

            <Section title="Základní přehled" />
            <div className="form-group">
              <label className="form-label">Účel nástroje</label>
              <textarea className="form-textarea" rows={2} value={form.purpose} onChange={f('purpose')} placeholder="Co nástroj umí a k čemu slouží?" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Podobné nástroje</label>
                <input className="form-input" value={form.similar_tools} onChange={f('similar_tools')} placeholder="Alternativy na trhu" />
              </div>
              <div className="form-group">
                <label className="form-label">Cena (pricing)</label>
                <input className="form-input" value={form.pricing} onChange={f('pricing')} placeholder="free / freemium / placené…" />
              </div>
            </div>

            <Section title="Přínos pro byznys" />
            <div className="form-group">
              <label className="form-label">Pro která oddělení / role</label>
              <input className="form-input" value={form.best_for_roles} onChange={f('best_for_roles')} placeholder="Marketing, HR, IT…" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Úspora času</label>
                <input className="form-input" value={form.time_saved} onChange={f('time_saved')} placeholder="např. 2 hod/týden" />
              </div>
              <div className="form-group">
                <label className="form-label">Aha! moment</label>
                <input className="form-input" value={form.aha_moment} onChange={f('aha_moment')} placeholder="Kdy nástroj překvapil?" />
              </div>
            </div>

            <Section title="Uživatelská přívětivost" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Onboarding (1–5)</label>
                <select className="form-select" value={form.onboarding_score} onChange={f('onboarding_score')}>
                  <option value="">—</option>
                  <option value="1">1 – velmi složitý</option>
                  <option value="2">2</option>
                  <option value="3">3 – střední</option>
                  <option value="4">4</option>
                  <option value="5">5 – ihned použitelný</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">UI intuitivní?</label>
                <select className="form-select" value={form.ui_intuitive} onChange={f('ui_intuitive')}>
                  <option value="">—</option>
                  <option value="ano">Ano</option>
                  <option value="částečně">Částečně</option>
                  <option value="ne">Ne</option>
                </select>
              </div>
            </div>

            <Section title="Výkon AI" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Kvalita výstupů</label>
                <textarea className="form-textarea" rows={2} value={form.output_quality} onChange={f('output_quality')} placeholder="Jsou výstupy použitelné rovnou?" />
              </div>
              <div className="form-group">
                <label className="form-label">Halucinace?</label>
                <select className="form-select" value={form.hallucinates} onChange={f('hallucinates')}>
                  <option value="">—</option>
                  <option value="ne">Ne</option>
                  <option value="občas">Občas</option>
                  <option value="ano">Ano</option>
                </select>
              </div>
            </div>

            <Section title="Rizika" />
            <div className="form-group">
              <label className="form-label">Slabiny</label>
              <textarea className="form-textarea" rows={2} value={form.weaknesses} onChange={f('weaknesses')} placeholder="Kde nástroj selhává?" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Bezpečnostní rizika</label>
                <textarea className="form-textarea" rows={2} value={form.security_risks} onChange={f('security_risks')} placeholder="Jak nakládá s daty?" />
              </div>
              <div className="form-group">
                <label className="form-label">Limity nástroje</label>
                <textarea className="form-textarea" rows={2} value={form.limitations} onChange={f('limitations')} placeholder="Co neumí nebo odmítá?" />
              </div>
            </div>

            <Section title="Finální verdikt" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Doporučení</label>
                <select className="form-select" value={form.recommended} onChange={f('recommended')}>
                  <option value="">—</option>
                  <option value="ano">Ano</option>
                  <option value="možná">Možná</option>
                  <option value="ne">Ne</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Hodnocení (1–10)</label>
                <select className="form-select" value={form.rating} onChange={f('rating')}>
                  <option value="">—</option>
                  {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Náročnost</label>
                <select className="form-select" value={form.effort} onChange={f('effort')}>
                  <option value="">—</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Dopad</label>
                <select className="form-select" value={form.impact} onChange={f('impact')}>
                  <option value="">—</option>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Tagy (čárkou)</label>
              <input className="form-input" value={form.tags} onChange={f('tags')} placeholder="ai, hr, automatizace…" />
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

      {/* DETAIL MODAL */}
      {selected && (
        <div className="modal-bg open" onClick={e => e.target === e.currentTarget && setSelected(null)}>
          <div className="modal" style={{ width: 680 }}>
            <button className="modal-close" onClick={() => setSelected(null)}>×</button>
            <div className="modal-header">
              <div className="modal-title">{selected.title}</div>
              <div className="modal-subtitle">
                {selected.tool_name && <>{selected.tool_name} · </>}
                {selected.team && <>{selected.team} · </>}
                autor: {selected.author_name}
              </div>
            </div>

            {selected.description && (
              <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 16 }}>{selected.description}</div>
            )}

            <Section title="Základní přehled" />
            <Field label="Účel nástroje" value={(selected as any).purpose} />
            <Field label="Podobné nástroje" value={(selected as any).similar_tools} />
            <Field label="Cena" value={(selected as any).pricing} />

            <Section title="Přínos pro byznys" />
            <Field label="Nejlepší pro" value={(selected as any).best_for_roles} />
            <Field label="Úspora času" value={(selected as any).time_saved} />
            <Field label="Aha! moment" value={(selected as any).aha_moment} />

            <Section title="Uživatelská přívětivost" />
            <div style={{ display: 'flex', gap: 20, marginBottom: 12 }}>
              {(selected as any).onboarding_score && <span className="tag">Onboarding: {(selected as any).onboarding_score}/5</span>}
              {(selected as any).ui_intuitive && <span className="tag">UI: {(selected as any).ui_intuitive}</span>}
            </div>

            <Section title="Výkon AI" />
            <Field label="Kvalita výstupů" value={(selected as any).output_quality} />
            {(selected as any).hallucinates && (
              <div style={{ marginBottom: 12 }}>
                <span className="tag">Halucinace: {(selected as any).hallucinates}</span>
              </div>
            )}

            <Section title="Rizika" />
            <Field label="Slabiny" value={(selected as any).weaknesses} />
            <Field label="Bezpečnostní rizika" value={(selected as any).security_risks} />
            <Field label="Limity nástroje" value={(selected as any).limitations} />

            <Section title="Finální verdikt" />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
              {(selected as any).recommended && <span className={`tag ${(selected as any).recommended === 'ano' ? 'tag-green' : (selected as any).recommended === 'ne' ? 'tag-red' : 'tag-amber'}`}>Doporučení: {(selected as any).recommended}</span>}
              {(selected as any).rating && <span className="tag">⭐ {(selected as any).rating}/10</span>}
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
