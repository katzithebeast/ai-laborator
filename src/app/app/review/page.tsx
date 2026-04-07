'use client'
import { useEffect, useState } from 'react'
import { supabase, type UseCase } from '@/lib/supabase'

export default function ReviewPage() {
  const [items, setItems] = useState<UseCase[]>([])

  const load = async () => {
    const { data } = await supabase.from('use_cases').select('*').eq('status', 'review').order('updated_at', { ascending: false })
    setItems(data ?? [])
  }

  useEffect(() => { load() }, [])

  const publish = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'published' }).eq('id', id)
    load()
  }

  const reject = async (id: string) => {
    await supabase.from('use_cases').update({ status: 'draft' }).eq('id', id)
    load()
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
            <div key={u.id} className="review-card">
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:600, marginBottom:3 }}>{u.title}</div>
                  <div style={{ fontSize:12, color:'var(--text2)', marginBottom:8 }}>
                    {u.tool_name && <>{u.tool_name} · </>}{u.team && <>{u.team} · </>}autor: {u.author_name}
                  </div>
                  {u.description && <div style={{ fontSize:13, color:'var(--text2)', lineHeight:1.5 }}>{u.description}</div>}
                </div>
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button className="btn btn-accent btn-sm" onClick={() => publish(u.id)}>✓ Publikovat</button>
                  <button className="btn btn-danger btn-sm" onClick={() => reject(u.id)}>← Vrátit</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  )
}
