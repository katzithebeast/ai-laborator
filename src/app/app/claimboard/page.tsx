'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Tool } from '@/lib/supabase'

const COLS = [
  { id: 'claimed',     label: 'Claimed',     dot: '#6d28d9', next: 'in_progress', nextLabel: '→ In progress' },
  { id: 'in_progress', label: 'In progress', dot: '#b45309', next: 'completed',   nextLabel: '→ Hotovo' },
  { id: 'completed',   label: 'Completed',   dot: '#1a4f2a', next: null,          nextLabel: '' },
]

export default function ClaimBoard() {
  const router = useRouter()
  const [tools, setTools] = useState<Tool[]>([])

  useEffect(() => {
    supabase.from('tools').select('*')
      .in('status', ['claimed','in_progress','completed'])
      .order('claimed_at', { ascending: false })
      .then(({ data }) => setTools(data ?? []))
  }, [])

  const move = async (id: string, status: string) => {
    await supabase.from('tools').update({ status }).eq('id', id)
    setTools(prev => prev.map(t => t.id === id ? { ...t, status: status as Tool['status'] } : t))
  }

  return (
    <>
      <div className="page-header">
        <div><h1>Claim Board</h1><p>Workflow claimnutých nástrojů.</p></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => router.push('/app/inbox')}>+ Claimnout nástroj</button>
        </div>
      </div>
      <div className="page-body">
        <div className="kanban">
          {COLS.map(col => {
            const items = tools.filter(t => t.status === col.id)
            return (
              <div key={col.id} className="kanban-col">
                <div className="kanban-col-title">
                  <span style={{ width:6, height:6, borderRadius:'50%', background:col.dot, display:'inline-block' }} />
                  {col.label}
                  {items.length > 0 && <span style={{ marginLeft:'auto', background:'var(--border)', borderRadius:8, padding:'1px 6px', fontSize:10, color:'var(--text2)', fontWeight:600 }}>{items.length}</span>}
                </div>
                {items.length === 0
                  ? <div style={{ color:'var(--text3)', fontSize:12.5, textAlign:'center', padding:'24px 0' }}>Nic tu zatím není.</div>
                  : items.map(t => (
                    <div key={t.id} className="kanban-card">
                      <div className="kanban-card-title">{t.name}</div>
                      <div className="kanban-card-desc">{t.description}</div>
                      <div className="kanban-card-actions">
                        <button className="btn btn-outline btn-xs"
                          onClick={() => router.push(`/app/chat?tool=${encodeURIComponent(t.name)}`)}>
                          💬 Use case
                        </button>
                        {col.next && (
                          <button className="btn btn-ghost btn-xs" onClick={() => move(t.id, col.next!)}>
                            {col.nextLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                }
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
