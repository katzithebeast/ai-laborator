'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Message } from '@/lib/supabase'

function md(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;margin:10px 0 4px">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;margin:8px 0 4px">$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
}

export default function InterviewPage() {
  const router = useRouter()
  const [text, setText] = useState('')
  const [tool, setTool] = useState('')
  const [team, setTeam] = useState('')
  const [running, setRunning] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  const start = async () => {
    if (!tool.trim() || !text.trim()) return
    setRunning(true)
    const userMsg = `Nástroj: ${tool}${team ? `\nTým: ${team}` : ''}\nSituace / kontext: ${text}`
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
    setInput('')
    setMessages(next)
    setLoading(true)
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
    if (saving || saved) return
    setSaving(true)
    try {
      const res = await fetch('/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })
      const data = await res.json()
      console.log('Extracted data:', data)
      if (data.error) throw new Error(data.error)

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('User:', user, userError)
      if (!user) throw new Error('Nejsi přihlášen')

      const { data: inserted, error: insertError } = await supabase
        .from('use_cases')
        .insert({
          ...data,
          author_id: user.id,
          author_name: user.email?.split('@')[0] || 'Unknown',
          status: 'draft',
          chat_history: messages,
        })
        .select()
        .single()
      console.log('Insert result:', inserted, insertError)
      if (insertError) throw insertError

      setSaved(true)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      setTimeout(() => router.push('/app/usecases'), 1500)
    } catch (e) {
      console.error('Save error:', e)
      alert('Chyba při ukládání: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── CHAT VIEW ──────────────────────────────────────────────────────────────
  if (running) return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', position: 'relative' }}>

        {/* TOP BAR */}
        <div style={{
          height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', flexShrink: 0, borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>Interview — {tool}</span>
          <button
            onClick={() => { setRunning(false); setMessages([]) }}
            style={{ background: 'transparent', border: '1px solid var(--border2)', borderRadius: 20, color: 'var(--text2)', fontSize: 13, fontFamily: 'inherit', padding: '5px 16px', cursor: 'pointer', transition: 'border-color 0.12s, color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
          >← Zpět</button>
        </div>

        {/* ZPRÁVY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ paddingTop: 16, paddingBottom: 8, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 680, width: '100%', margin: '0 auto' }}>
            {messages.map((m, i) => (
              <div key={i} className={`msg ${m.role}`}>
                <div className="msg-avatar">{m.role === 'user' ? 'T' : 'λ'}</div>
                <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: m.role === 'assistant' ? md(m.content) : m.content }} />
              </div>
            ))}
            {loading && (
              <div className="msg assistant">
                <div className="msg-avatar">λ</div>
                <div className="typing-dot"><span /><span /><span /></div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        {/* INPUT AREA */}
        <div style={{ padding: '16px 20px 20px', flexShrink: 0 }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="Napiš odpověď…"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); reply() } }}
                style={{
                  width: '100%', height: 48, borderRadius: 12,
                  background: 'var(--surface)', border: '1px solid var(--border2)',
                  padding: '12px 50px 12px 16px', color: 'var(--text)',
                  fontSize: 14, fontFamily: 'inherit', resize: 'none', outline: 'none',
                  lineHeight: '24px', transition: 'border-color 0.15s', overflowY: 'hidden',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(224,32,32,0.5)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border2)')}
              />
              <button
                onClick={reply}
                disabled={loading || !input.trim()}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 32, height: 32, borderRadius: 8, background: 'var(--surface3)',
                  border: 'none', cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  color: 'var(--text)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s', opacity: loading || !input.trim() ? 0.4 : 1,
                }}
                onMouseEnter={e => { if (!loading && input.trim()) e.currentTarget.style.background = '#e02020' }}
                onMouseLeave={e => { if (!loading && input.trim()) e.currentTarget.style.background = 'var(--surface3)' }}
              >↑</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingLeft: 2, paddingRight: 2 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {messages.length > 4 && (
                  <button onClick={save} disabled={saving || saved} style={{
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                    fontFamily: 'inherit', padding: '4px 10px', fontSize: 12,
                    transition: 'color 0.12s, background 0.12s, border-color 0.12s',
                    cursor: saving || saved ? 'default' : 'pointer',
                    color: saved ? 'rgba(34,197,94,0.9)' : 'rgba(255,255,255,0.4)',
                  }}
                    onMouseEnter={e => { if (!saving && !saved) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' } }}
                    onMouseLeave={e => { if (!saving && !saved) { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' } }}
                  >
                    {saved ? '✓ Uloženo' : saving ? '⟳ Ukládám…' : 'Uložit use case'}
                  </button>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Shift+Enter = nový řádek</span>
            </div>
          </div>
        </div>
      </div>

      {saveSuccess && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#16a34a', color: '#fff', borderRadius: 10,
          padding: '10px 20px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 9999,
        }}>
          ✓ Use case uložen jako draft
        </div>
      )}
    </>
  )

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="page-header">
        <div><h1>Interview</h1><p>Popiš AI nástroj a situaci. AI se doptá a složí use case draft.</p></div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={start} disabled={!tool.trim() || !text.trim()}>Spustit interview</button>
        </div>
      </div>
      <div className="page-body">
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <div className="interview-grid">
          <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>

            {/* SVG ikona */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ animation: 'spin 8s linear infinite' }}>
                <circle cx="40" cy="40" r="35" fill="none" stroke="#e02020" strokeWidth="1" strokeDasharray="4 4"/>
                <circle cx="40" cy="40" r="25" fill="none" stroke="rgba(224,32,32,0.5)" strokeWidth="1"/>
                <circle cx="40" cy="40" r="6" fill="#e02020"/>
                <path d="M40,8 L43,15 L50,12 L50,20 L57,20 L54,27 L61,30 L56,36 L62,40 L56,44 L61,50 L54,53 L57,60 L50,60 L50,68 L43,65 L40,72 L37,65 L30,68 L30,60 L23,60 L26,53 L19,50 L24,44 L18,40 L24,36 L19,30 L26,27 L23,20 L30,20 L30,12 L37,15 Z"
                  fill="none" stroke="#e02020" strokeWidth="1.5" opacity="0.6"/>
              </svg>
            </div>

            <div className="form-group">
              <label className="form-label">Název AI nástroje *</label>
              <input className="form-input" value={tool} onChange={e => setTool(e.target.value)} placeholder="např. Notion AI, Midjourney, Copilot…" />
            </div>
            <div className="form-group">
              <label className="form-label">Tým / Oddělení</label>
              <input className="form-input" value={team} onChange={e => setTeam(e.target.value)} placeholder="např. Marketing, IT, HR…" />
            </div>
            <div className="form-group">
              <label className="form-label">Popis situace nebo kontextu *</label>
              <textarea className="form-textarea" rows={5} value={text} onChange={e => setText(e.target.value)}
                placeholder="Popiš situaci nebo kontext, ve kterém chceš nástroj použít." />
            </div>
            <button className="btn btn-primary" onClick={start} disabled={!tool.trim() || !text.trim()}>Spustit interview</button>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Jak to funguje</h3>
            <p style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 16, lineHeight: 1.6 }}>AI projde 4 kroky a vytvoří kompletní use case draft.</p>
            {[
              ['1', 'Extract facts', 'AI vytáhne klíčové info z tvého popisu'],
              ['2', 'Missing info', 'Jednou otázkou zjistí, co chybí'],
              ['3', 'Odpovědi', 'Ty doplníš detail, AI pokračuje'],
              ['4', 'Draft', 'AI složí hotový strukturovaný use case'],
            ].map(([n, title, desc]) => (
              <div key={n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, marginBottom: 10 }}>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--text)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{n}</span>
                <span><strong>{title}</strong> — {desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
