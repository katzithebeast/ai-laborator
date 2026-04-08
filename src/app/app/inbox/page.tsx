'use client'
import { useEffect, useState } from 'react'
import { supabase, type Tool } from '@/lib/supabase'

export default function InboxPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [discovering, setDiscovering] = useState(false)
  const [form, setForm] = useState({ name:'', vendor:'', website_url:'', description:'', category:'', tags:'' })

  const fetchTools = async () => {
    const { data } = await supabase.from('tools').select('*').order('created_at', { ascending: false })
    setTools(data ?? [])
  }

  const load = async () => {
    await fetchTools()
    try {
      await fetch('/api/discovery', { method: 'POST' })
    } catch (e) {
      console.error('Auto-discovery failed', e)
    }
    await fetchTools()
  }

  useEffect(() => {
    load()
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const claim = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('tools').update({ status:'claimed', claimed_by: user?.id, claimed_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  const unclaim = async (id: string) => {
    await supabase.from('tools').update({ status:'new', claimed_by: null, claimed_at: null }).eq('id', id)
    load()
  }

  const addTool = async () => {
    setLoading(true)
    await supabase.from('tools').insert({
      name: form.name, vendor: form.vendor, website_url: form.website_url,
      description: form.description, category: form.category,
      tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
      status: 'new', source: 'manual',
    })
    setForm({ name:'', vendor:'', website_url:'', description:'', category:'', tags:'' })
    setShowModal(false); setLoading(false); load()
  }

  const runDiscovery = async () => {
    setDiscovering(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{
            role: 'user',
            content: 'Navrhni 5 nejnovějších a nejzajímavějších AI nástrojů které stojí za vyzkoušení ve firmě. Pro každý vrať JSON: name, vendor, website_url, description, category, tags (array). Vrať POUZE validní JSON array, bez textu okolo.'
          }],
          mode: 'chat',
        })
      })
      const { content } = await res.json()
      const parsed = JSON.parse(content.replace(/```json|```/g, '').trim())
      if (Array.isArray(parsed)) {
        await supabase.from('tools').insert(
          parsed.map((t: { name: string; vendor?: string; website_url?: string; description?: string; category?: string; tags?: string[] }) => ({
            name: t.name,
            vendor: t.vendor ?? null,
            website_url: t.website_url ?? null,
            description: t.description ?? null,
            category: t.category ?? null,
            tags: Array.isArray(t.tags) ? t.tags : [],
            status: 'new',
            source: 'discovery',
          }))
        )
      }
    } catch (e) {
      console.error('Discovery failed', e)
    } finally {
      setDiscovering(false)
      load()
    }
  }

  const scoreTag = (score: number) => score >= 70 ? 'tag-amber' : score >= 50 ? 'tag-green' : ''

  return (
    <>
      <div className="page-header">
        <div><h1>Inbox nástrojů</h1><p>Kandidáti k evaluaci. Claimni nástroj pro zahájení workflow.</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={runDiscovery} disabled={discovering}>
            {discovering ? '⟳ Hledám…' : '⟳ Spustit discovery'}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={load}>Obnovit</button>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>+ Přidat ručně</button>
        </div>
      </div>
      <div className="page-body">
        {tools.length === 0
          ? <div className="empty"><span className="empty-icon">📭</span>Inbox je prázdný. Přidej nástroje ručně.</div>
          : tools.map(t => (
            <div key={t.id} className="tool-card">
              <div style={{ flex:1 }}>
                <div className="tool-name">{t.name}</div>
                <div className="tool-vendor">
                  {t.vendor}{t.website_url && <> · <a href={t.website_url} target="_blank" rel="noopener">otevřít ↗</a></>}
                  {' · '}source: {t.source}
                </div>
                <div className="tool-tags">
                  <span className={`tag ${t.status === 'claimed' ? 'tag-violet' : ''}`}>{t.status}</span>
                  {t.category && <span className="tag">{t.category}</span>}
                  {t.legit_score > 0 && <span className={`tag ${scoreTag(t.legit_score)}`}>legit {t.legit_score}</span>}
                  {t.fit_score > 0 && <span className="tag">fit {t.fit_score}</span>}
                  {t.novelty_score > 0 && <span className="tag">nov {t.novelty_score}</span>}
                  {t.tags?.map(tag => <span key={tag} className="tag">{tag}</span>)}
                </div>
                {t.description && <div className="tool-desc">{t.description}</div>}
              </div>
              <div className="tool-actions">
                {t.status === 'claimed'
                  ? currentUserId && t.claimed_by === currentUserId
                    ? <button className="btn btn-outline btn-sm" onClick={() => unclaim(t.id)}>Unclaim</button>
                    : <span className="tag tag-violet">Claimed</span>
                  : <button className="btn btn-primary btn-sm" onClick={() => claim(t.id)}>Claim</button>
                }
              </div>
            </div>
          ))
        }
      </div>
      <div className={`modal-bg ${showModal ? 'open' : ''}`} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
        <div className="modal">
          <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
          <div className="modal-header"><div className="modal-title">Přidat nástroj</div></div>
          {(['name','vendor','website_url','category'] as const).map(f => (
            <div key={f} className="form-group">
              <label className="form-label">{{ name:'Název *', vendor:'Vendor', website_url:'URL', category:'Kategorie' }[f]}</label>
              <input className="form-input" value={form[f]} onChange={e => setForm({ ...form, [f]: e.target.value })} />
            </div>
          ))}
          <div className="form-group">
            <label className="form-label">Popis</label>
            <textarea className="form-textarea" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Tagy (čárkou)</label>
            <input className="form-input" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Zrušit</button>
            <button className="btn btn-primary" onClick={addTool} disabled={loading || !form.name}>
              {loading ? 'Přidávám…' : 'Přidat'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
