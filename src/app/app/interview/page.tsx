'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Message } from '@/lib/supabase'

export default function InterviewPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [tool, setTool] = useState('')
  const [team, setTeam] = useState('')
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const start = async () => {
    if (!text.trim()) return
    setRunning(true)
    const userMsg = `Projekt/situace: ${text}${tool ? `\nNástroj: ${tool}` : ''}${team ? `\nTým: ${team}` : ''}`
    const init: Message[] = [{ role: 'user', content: userMsg }]
    setMessages(init)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: init, mode: 'interview' })
      })
      const data = await res.json()
      setMessages([...init, { role: 'assistant', content: data.content }])
    } finally { setLoading(false) }
  }

  const reply = async () => {
    if (!input.trim() || loading) return
    const next: Message[] = [...messages, { role: 'user', content: input }]
    setInput(''); setMessages(next); setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, mode: 'interview' })
      })
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.content }])
    } finally { setLoading(false) }
  }

  const save = async () => {
    const res = await fetch('/api/extract', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    })
    const data = await res.json()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('use_cases').insert({
      ...data, author_id: user?.id,
      author_name: user?.email?.split('@')[0],
      status: 'draft', chat_history: messages,
    })
    router.push('/app/usecases')
  }

  if (running) return (
    <>
      <div className="page-header" style={{ paddingBottom:14 }}>
        <div><h1>Interview</h1><p>Průvodce tvorbou use case — krok za krokem.</p></div>
        <div className="page-actions">
          {messages.length > 4 && <button className="btn btn-accent btn-sm" onClick={save}>💾 Uložit use case</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => { setRunning(false); setMessages([]) }}>← Zpět</button>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop:12, display:'flex', flexDirection:'column', height:'calc(100vh - 120px)' }}>
        <div className="chat-wrap">
          <div className="chat-messages">
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className="msg-avatar">{m.role === 'user' ? 'T' : 'λ'}</div>
                <div className="msg-bubble" style={{ whiteSpace:'pre-wrap' }}>{m.content}</div>
              </div>
            ))}
            {loading && <div className="msg assistant"><div className="msg-avatar">λ</div><div className="typing-dot"><span /><span /><span /></div></div>}
          </div>
          <div className="chat-input-area">
            <textarea className="chat-textarea" placeholder="Odpověz na otázku…"
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply() } }} />
            <div className="chat-toolbar">
              <span />
              <button className="btn btn-primary btn-sm" onClick={reply} disabled={loading || !input.trim()}>Odpovědět ↵</button>
            </div>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <>
      <div className="page-header">
        <div><h1>Interview</h1><p>Popiš projekt. AI vytěží fakta, doptá se a složí draft.</p></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={start} disabled={!text.trim()}>Spustit interview</button>
        </div>
      </div>
      <div className="page-body">
        <div className="interview-grid">
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>Vstup</h3>
            <div className="form-group">
              <label className="form-label">Popis projektu / situace *</label>
              <textarea className="form-textarea" rows={6} value={text} onChange={e => setText(e.target.value)}
                placeholder="Popiš projekt nebo problém. Čím konkrétnější, tím lepší draft." />
            </div>
            <div className="form-group">
              <label className="form-label">Nástroj (volitelně)</label>
              <input className="form-input" value={tool} onChange={e => setTool(e.target.value)} placeholder="např. Notion AI, Zapier…" />
            </div>
            <div className="form-group">
              <label className="form-label">Tým / Oddělení</label>
              <input className="form-input" value={team} onChange={e => setTeam(e.target.value)} placeholder="např. Marketing, IT, HR…" />
            </div>
            <button className="btn btn-primary" onClick={start} disabled={!text.trim()}>🎯 Spustit interview</button>
          </div>
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:600, marginBottom:8 }}>Jak to funguje</h3>
            <p style={{ fontSize:12.5, color:'var(--text2)', marginBottom:16, lineHeight:1.6 }}>AI projde 4 kroky a vytvoří kompletní use case draft.</p>
            {[
              ['1', 'Extract facts', 'AI vytáhne klíčové info z tvého popisu'],
              ['2', 'Missing info', 'Jednou otázkou zjistí, co chybí'],
              ['3', 'Odpovědi', 'Ty doplníš detail, AI pokračuje'],
              ['4', 'Draft', 'AI složí hotový strukturovaný use case'],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ display:'flex', gap:10, alignItems:'flex-start', fontSize:13, marginBottom:10 }}>
                <span style={{ width:22, height:22, borderRadius:'50%', background:'var(--text)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, flexShrink:0 }}>{n}</span>
                <span><strong>{title}</strong> — {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
