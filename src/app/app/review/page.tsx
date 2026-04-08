'use client'
import { useEffect, useState } from 'react'
import { supabase, type UseCase } from '@/lib/supabase'

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
  const [items, setItems] = useState<UseCase[]>([])
  const [selected, setSelected] = useState<UseCase | null>(null)

  const load = async () => {
    const { data } = await supabase.from('use_cases').select('*').eq('status', 'review').order('updated_at', { ascending: false })
    setItems(data ?? [])
  }

  useEffect(() => { load() }, [])

  const publish = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'published' }).eq('id', id)
    setSelected(null)
    load()
  }

  const reject = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'draft' }).eq('id', id)
    setSelected(null)
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

  return (
    <>
      <div className="page-header">
        <div><h1>Kontrola</h1><p>Fronta use casů čekajících na schválení.</p></div>
        <div className="page-actions">
          <button className="btn btn-outline" onClick={load}>⟳ Obnovit</button>
        </div>
      </div>
      <div className="page-body">
        {items.length === 0
          ? <div className="card" style={{ textAlign:'center', color:'var(--text3)', fontSize:13 }}>Nikdo teď nečeká na review.</div>
          : items.map(u => (
            <div key={u.id} className="review-card" style={{ cursor: 'pointer' }} onClick={() => setSelected(u)}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:600, marginBottom:3 }}>{u.title}</div>
                  <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8 }}>
                    {u.tool_name && <>{u.tool_name} · </>}{u.team && <>{u.team} · </>}autor: {u.author_name}
                  </div>
                  {u.description && <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{u.description}</div>}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-accent btn-sm" onClick={() => publish(u.id)}>✓ Publikovat</button>
                  <button className="btn btn-danger btn-sm" onClick={() => reject(u.id)}>← Vrátit</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>

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
            </div>

            <div className="modal-footer">
              <button className="btn btn-danger btn-sm" onClick={() => reject(selected.id)}>← Vrátit do draftu</button>
              <button className="btn btn-ghost btn-sm" onClick={() => exportToHTML(selected)}>⬇ Stáhnout</button>
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Zavřít</button>
              <button className="btn btn-accent" onClick={() => publish(selected.id)}>✓ Publikovat</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
