'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Message } from '@/lib/supabase'

type Session = {
  id: string
  title: string
  messages: Message[]
  created_at: string
  updated_at: string
}

type Attachment = {
  name: string
  kind: 'image' | 'doc'
  mediaType: string
  data: string
  preview: string
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

function md(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:15px;margin:10px 0 4px">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="font-size:14px;margin:8px 0 4px">$1</h3>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')
}

export default function ProjectChatPage() {
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [titleGenerated, setTitleGenerated] = useState(false)
  const [tooltip, setTooltip] = useState<{ text: string; y: number } | null>(null)
  const [hoveredHistoryId, setHoveredHistoryId] = useState<string | null>(null)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { loadSessions() }, [])

  const loadSessions = async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at, messages')
      .order('updated_at', { ascending: false })
    setSessions((data ?? []) as Session[])
  }

  const renameSession = async (id: string, title: string) => {
    const trimmed = title.trim()
    if (!trimmed) { setEditingSessionId(null); return }
    await supabase.from('chat_sessions').update({ title: trimmed }).eq('id', id)
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: trimmed } : s))
    setEditingSessionId(null)
  }

  const newAnalysis = () => {
    setMessages([])
    setSessionId(null)
    setSaved(false)
    setInput('')
    setAttachment(null)
    setTitleGenerated(false)
  }

  const openSession = (s: Session) => {
    setMessages(s.messages ?? [])
    setSessionId(s.id)
    setSaved(false)
    setAttachment(null)
    setTitleGenerated(true)
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const isImage = IMAGE_TYPES.includes(file.type)
    const reader = new FileReader()
    if (isImage) {
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        setAttachment({ name: file.name, kind: 'image', mediaType: file.type, data: dataUrl.split(',')[1], preview: dataUrl })
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = ev => {
        setAttachment({ name: file.name, kind: 'doc', mediaType: '', data: ev.target?.result as string, preview: '' })
      }
      reader.readAsText(file)
    }
  }

  const send = async (text?: string) => {
    const userText = text ?? input.trim()
    if ((!userText && !attachment) || loading) return
    setInput('')

    const displayText = userText || `📎 ${attachment!.name}`
    const next: Message[] = [...messages, { role: 'user', content: displayText }]
    setMessages(next)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiMessages: any[] = next.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
    if (attachment) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks: any[] = []
      if (attachment.kind === 'image') {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: attachment.mediaType, data: attachment.data } })
        if (userText) blocks.push({ type: 'text', text: userText })
      } else {
        blocks.push({ type: 'text', text: `[Obsah souboru: ${attachment.name}]\n${attachment.data}${userText ? '\n\n' + userText : ''}` })
      }
      apiMessages.push({ role: 'user', content: blocks })
    } else {
      apiMessages.push({ role: 'user', content: displayText })
    }

    setAttachment(null)
    setLoading(true)

    let currentSessionId = sessionId
    if (!currentSessionId) {
      const { data: { user } } = await supabase.auth.getUser()
      const title = (userText || attachment?.name || 'Projekt').slice(0, 50)
      const { data } = await supabase
        .from('chat_sessions')
        .insert({ user_id: user?.id, title, messages: next })
        .select('id')
        .single()
      if (data) { currentSessionId = data.id; setSessionId(data.id); loadSessions() }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, mode: 'project' })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const withReply: Message[] = [...next, { role: 'assistant', content: data.content }]
      setMessages(withReply)
      if (currentSessionId) {
        await supabase.from('chat_sessions')
          .update({ messages: withReply, updated_at: new Date().toISOString() })
          .eq('id', currentSessionId)
        loadSessions()
      }
      // Název po 4. zprávě, jen jednou
      if (currentSessionId && withReply.length >= 4 && !titleGenerated) {
        setTitleGenerated(true)
        fetch('/api/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [
              ...withReply.slice(0, 6).map(m => ({ role: m.role, content: m.content })),
              { role: 'user', content: 'Vygeneruj název této konverzace.' },
            ],
            mode: 'title',
          }),
        }).then(r => r.json()).then(({ content }) => {
          if (content) {
            const smartTitle = content.trim().replace(/['"]/g, '').slice(0, 60)
            supabase.from('chat_sessions').update({ title: smartTitle }).eq('id', currentSessionId!)
              .then(() => loadSessions())
          }
        }).catch(() => {/* noop */})
      }
    } catch {
      setMessages([...next, { role: 'assistant', content: '⚠️ Chyba AI. Zkontroluj API klíč na Vercelu.' }])
    } finally { setLoading(false) }
  }

  const save = async () => {
    if (saving || saved) return
    setSaving(true)
    try {
      const res = await fetch('/api/extract-project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })
      const data = await res.json()
      console.log('Extracted project data:', data)
      if (data.error) throw new Error(data.error)

      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log('User:', user, userError)
      if (!user) throw new Error('Nejsi přihlášen')

      const { data: inserted, error: insertError } = await supabase
        .from('projects')
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
      setTimeout(() => router.push('/app/projects'), 1500)
    } catch (e) {
      console.error('Save error:', e)
      alert('Chyba při ukládání: ' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000)
    if (diffDays === 0) return d.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
    if (diffDays === 1) return 'Včera'
    if (diffDays < 7) return d.toLocaleDateString('cs-CZ', { weekday: 'short' })
    return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', position: 'relative' }}>

        {/* TOP BAR */}
        <div style={{
          height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 20px', flexShrink: 0, borderBottom: '1px solid var(--border)',
        }}>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, fontFamily: 'inherit', padding: '4px 0', transition: 'color 0.12s' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
          >{historyOpen ? '‹ Historie' : 'Historie ›'}</button>
          <button
            onClick={newAnalysis}
            style={{ background: 'transparent', border: '1px solid var(--border2)', borderRadius: 20, color: 'var(--text2)', fontSize: 13, fontFamily: 'inherit', padding: '5px 16px', cursor: 'pointer', transition: 'border-color 0.12s, color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text3)'; e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
          >Nová analýza</button>
        </div>

        {/* PANEL HISTORIE */}
        {historyOpen && (
          <div style={{
            position: 'absolute', top: 48, left: 0, bottom: 0, width: 260,
            background: 'var(--surface2)', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', padding: '12px 10px', gap: 3, zIndex: 20, overflowY: 'auto',
          }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 6, paddingLeft: 4 }}>
              Historie
            </div>
            {sessions.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>Žádné projekty zatím</div>
            )}
            {sessions.map(s => (
              <div key={s.id} style={{ position: 'relative', borderRadius: 8 }}
                onMouseEnter={e => {
                  setHoveredHistoryId(s.id)
                  if ((s.title?.length ?? 0) > 28 && editingSessionId !== s.id) {
                    const rect = e.currentTarget.getBoundingClientRect()
                    setTooltip({ text: s.title, y: rect.top })
                  }
                }}
                onMouseLeave={() => { setHoveredHistoryId(null); setTooltip(null) }}
              >
                {editingSessionId === s.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={e => setEditingTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameSession(s.id, editingTitle)
                      if (e.key === 'Escape') setEditingSessionId(null)
                    }}
                    onBlur={() => renameSession(s.id, editingTitle)}
                    style={{
                      width: '100%', padding: '8px 10px', borderRadius: 8,
                      background: 'var(--surface)', border: '1px solid var(--border2)',
                      color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                ) : (
                  <button onClick={() => openSession(s)} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 10px', paddingRight: 30, borderRadius: 8, border: 'none',
                    background: sessionId === s.id ? 'var(--surface3)' : hoveredHistoryId === s.id ? 'var(--surface)' : 'transparent',
                    cursor: 'pointer', transition: 'background 0.1s',
                  }}>
                    <div style={{ fontSize: 13, color: sessionId === s.id ? 'var(--text)' : 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 190 }}>
                      {s.title || 'Projekt'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDate(s.updated_at)}</div>
                  </button>
                )}
                {hoveredHistoryId === s.id && editingSessionId !== s.id && (
                  <button
                    onClick={e => { e.stopPropagation(); setEditingTitle(s.title || ''); setEditingSessionId(s.id); setTooltip(null) }}
                    style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 13, padding: '2px 4px', lineHeight: 1, borderRadius: 4, transition: 'color 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
                  >✎</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ZPRÁVY */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
          {messages.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center', padding: '80px 20px 40px', gap: 0 }}>
              <style>{`@keyframes pulse{0%,100%{opacity:0.85;transform:scale(1)}50%{opacity:1;transform:scale(1.04)}}`}</style>
              <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom: 32, animation: 'pulse 3s ease-in-out infinite' }}>
                <path d="M8,20 L8,65 L72,65 L72,28 L38,28 L32,20 Z" fill="#e02020" opacity="0.8"/>
                <path d="M8,32 L72,32 L72,65 L8,65 Z" fill="#e02020"/>
                <path d="M8,32 L72,32 L72,65 L8,65 Z" fill="rgba(255,255,255,0.1)"/>
              </svg>
              <div style={{ color: 'var(--text)', fontSize: 22, fontWeight: 500, marginBottom: 12 }}>Zpětná analýza projektu</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 36 }}>AI se tě postupně zeptá na projekt kde jsi použil/a AI.</div>
              <button
                onClick={() => send('Chci zdokumentovat projekt kde jsme použili AI.')}
                style={{ background: 'transparent', border: '1px solid var(--border2)', borderRadius: 20, color: 'var(--text2)', fontSize: 13, padding: '8px 18px', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#e02020'; e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border2)'; e.currentTarget.style.color = 'var(--text2)' }}
              >Spustit analýzu projektu</button>
            </div>
          ) : (
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
          )}
        </div>

        {/* INPUT AREA */}
        <div style={{ padding: '16px 20px 20px', flexShrink: 0 }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            {attachment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                {attachment.kind === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={attachment.preview} alt={attachment.name} style={{ height: 36, width: 36, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} />
                ) : (
                  <span style={{ fontSize: 16, flexShrink: 0 }}>📄</span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
                <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 15, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <textarea
                placeholder="Napiš zprávu…"
                value={input}
                onChange={e => setInput(e.target.value)}
                disabled={loading}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
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
                onClick={() => send()}
                disabled={loading || (!input.trim() && !attachment)}
                style={{
                  position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                  width: 32, height: 32, borderRadius: 8, background: 'var(--surface3)',
                  border: 'none', cursor: loading || (!input.trim() && !attachment) ? 'not-allowed' : 'pointer',
                  color: 'var(--text)', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.15s', opacity: loading || (!input.trim() && !attachment) ? 0.4 : 1,
                }}
                onMouseEnter={e => { if (!loading && (input.trim() || attachment)) e.currentTarget.style.background = '#e02020' }}
                onMouseLeave={e => { if (!loading && (input.trim() || attachment)) e.currentTarget.style.background = 'var(--surface3)' }}
              >↑</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, paddingLeft: 2, paddingRight: 2 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => fileInputRef.current?.click()} disabled={loading} style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6,
                  cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 12, fontFamily: 'inherit', padding: '4px 10px',
                  transition: 'color 0.12s, background 0.12s, border-color 0.12s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)' }}
                >⊕ Přiložit</button>
                {messages.length > 2 && (
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
                    {saved ? '✓ Uloženo' : saving ? '⟳ Ukládám…' : 'Uložit projekt'}
                  </button>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)' }}>Shift+Enter = nový řádek</span>
            </div>
          </div>
        </div>
      </div>

      <input ref={fileInputRef} type="file" style={{ display: 'none' }}
        accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        onChange={handleFile} />

      {tooltip && (
        <div style={{
          position: 'fixed', left: 268, top: tooltip.y,
          background: 'rgba(20,20,20,0.97)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#fff',
          maxWidth: 220, wordWrap: 'break-word', whiteSpace: 'normal',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)', zIndex: 9999, pointerEvents: 'none',
        }}>
          {tooltip.text}
        </div>
      )}

      {saveSuccess && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: '#16a34a', color: '#fff', borderRadius: 10,
          padding: '10px 20px', fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)', zIndex: 9999,
        }}>
          ✓ Projekt uložen jako draft
        </div>
      )}
    </>
  )
}
