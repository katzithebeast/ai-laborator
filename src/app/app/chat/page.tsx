'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
  mediaType: string   // 'image/jpeg' atd., pro doc prázdný
  data: string        // base64 pro obrázky, text pro dokumenty
  preview: string     // object URL jen pro obrázky
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

function ChatPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toolParam = searchParams.get('tool')

  const [messages, setMessages] = useState<Message[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const [mode, setMode] = useState<'chat' | 'project'>('chat')
  const endRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { loadSessions() }, [])
  useEffect(() => {
    if (toolParam) send(`Chci vytvořit use case pro nástroj: ${toolParam}`)
  }, [toolParam])  // eslint-disable-line react-hooks/exhaustive-deps

  const loadSessions = async () => {
    const { data } = await supabase
      .from('chat_sessions')
      .select('id, title, created_at, updated_at, messages')
      .order('updated_at', { ascending: false })
    setSessions((data ?? []) as Session[])
  }

  const newChat = () => {
    setMessages([])
    setSessionId(null)
    setSaved(false)
    setInput('')
    setAttachment(null)
    setMode('chat')
  }

  const openSession = (s: Session) => {
    setMessages(s.messages ?? [])
    setSessionId(s.id)
    setSaved(false)
    setAttachment(null)
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
        const base64 = dataUrl.split(',')[1]
        setAttachment({ name: file.name, kind: 'image', mediaType: file.type, data: base64, preview: dataUrl })
      }
      reader.readAsDataURL(file)
    } else {
      reader.onload = ev => {
        const text = ev.target?.result as string
        setAttachment({ name: file.name, kind: 'doc', mediaType: '', data: text, preview: '' })
      }
      reader.readAsText(file)
    }
  }

  const send = async (text?: string, overrideMode?: 'chat' | 'project') => {
    const userText = text ?? input.trim()
    if ((!userText && !attachment) || loading) return
    setInput('')

    // Zobrazovaný text v chatu
    const displayText = userText || `📎 ${attachment!.name}`
    const next: Message[] = [...messages, { role: 'user', content: displayText }]
    setMessages(next)

    // Sestavení messages pro API — předchozí zůstanou jako string,
    // aktuální zpráva dostane content array pokud je příloha
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const apiMessages: any[] = next.slice(0, -1).map(m => ({ role: m.role, content: m.content }))

    if (attachment) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blocks: any[] = []
      if (attachment.kind === 'image') {
        blocks.push({ type: 'image', source: { type: 'base64', media_type: attachment.mediaType, data: attachment.data } })
        if (userText) blocks.push({ type: 'text', text: userText })
      } else {
        const combined = `[Obsah souboru: ${attachment.name}]\n${attachment.data}${userText ? '\n\n' + userText : ''}`
        blocks.push({ type: 'text', text: combined })
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
      const title = (userText || attachment?.name || 'Chat').slice(0, 50)
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
        body: JSON.stringify({ messages: apiMessages, mode: overrideMode ?? mode })
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
    } catch {
      setMessages([...next, { role: 'assistant', content: '⚠️ Chyba AI. Zkontroluj API klíč na Vercelu.' }])
    } finally { setLoading(false) }
  }

  const save = async () => {
    try {
      const isProject = mode === 'project'
      const res = await fetch(isProject ? '/api/extract-project' : '/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })
      const data = await res.json()
      const { data: { user } } = await supabase.auth.getUser()
      const table = isProject ? 'projects' : 'use_cases'
      await supabase.from(table).insert({
        ...data,
        author_id: user?.id,
        author_name: user?.email?.split('@')[0],
        status: 'draft',
        chat_history: messages,
      })
      setSaved(true)
      showToast(isProject ? 'Projekt uložen jako draft ✓' : 'Use case uložen jako draft ✓')
      setTimeout(() => router.push(isProject ? '/app/projects' : '/app/usecases'), 1200)
    } catch { showToast('Chyba při ukládání') }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
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
      <div className="page-header" style={{ paddingBottom: 14 }}>
        <div><h1>Chat</h1><p>Popiš projekt nebo nástroj — AI se doptá a vytvoří use case.</p></div>
        <div className="page-actions">
          <button className="btn btn-outline btn-sm" onClick={newChat}>+ Nový chat</button>
          <button className="btn btn-ghost btn-xs" onClick={() => router.push('/app/interview')}>Interview mód</button>
        </div>
      </div>

      <div className="page-body" style={{ paddingTop: 12, display: 'flex', gap: 14, height: 'calc(100vh - 120px)', minHeight: 500 }}>

        {/* HISTORIE CHATŮ */}
        <div style={{ width: 220, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
            Historie chatů
          </div>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {sessions.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', paddingTop: 20 }}>Žádné chaty zatím</div>
            )}
            {sessions.map(s => (
              <button key={s.id} onClick={() => openSession(s)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '8px 10px', borderRadius: 8,
                border: `1px solid ${sessionId === s.id ? 'var(--border)' : 'transparent'}`,
                background: sessionId === s.id ? 'var(--surface)' : 'transparent',
                cursor: 'pointer', transition: 'background 0.1s',
              }}
                onMouseEnter={e => { if (sessionId !== s.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface2)' }}
                onMouseLeave={e => { if (sessionId !== s.id) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <div style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.title || 'Chat'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{formatDate(s.updated_at)}</div>
              </button>
            ))}
          </div>
        </div>

        {/* CHAT */}
        <div className="chat-wrap" style={{ flex: 1 }}>
          <div className="chat-header">
            <span>model: <strong>claude-sonnet-4-20250514</strong> · klíč na serveru</span>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <span className="chat-empty-icon">🧪</span>
                <strong style={{ color: 'var(--text)', fontSize: 15 }}>AI asistent pro use cases</strong>
                <span>Napiš popis projektu, nástroje nebo situace. AI se doptá a vytvoří draft.</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => send('Chci vytvořit use case pro AI nástroj, který jsme testovali.')}>🔧 Chci vytvořit use case pro AI nástroj</button>
                  <button className="btn btn-outline btn-sm" onClick={() => { setMode('project'); send('Chci zpětně zdokumentovat projekt kde jsme použili AI.', 'project') }}>📋 Chci vytvořit use case zpětně z projektu</button>
                  <button className="btn btn-outline btn-sm" onClick={() => send('Mám dotaz ohledně AI nástrojů nebo use casů.')}>❓ Mám na tebe dotaz</button>
                </div>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
          <div className="chat-input-area">
            {/* PREVIEW PŘÍLOHY */}
            {attachment && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8 }}>
                {attachment.kind === 'image' ? (
                  <img src={attachment.preview} alt={attachment.name} style={{ height: 48, width: 48, objectFit: 'cover', borderRadius: 6, flexShrink: 0 }} />
                ) : (
                  <span style={{ fontSize: 22, flexShrink: 0 }}>📄</span>
                )}
                <span style={{ fontSize: 12.5, color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.name}</span>
                <button onClick={() => setAttachment(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', fontSize: 16, lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            )}
            <textarea className="chat-textarea"
              placeholder="Napiš zprávu… (Enter = odeslat, Shift+Enter = nový řádek)"
              value={input} onChange={e => setInput(e.target.value)}
              disabled={loading}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
            <div className="chat-toolbar">
              <div className="chat-toolbar-left">
                <button className="btn btn-ghost btn-xs" onClick={() => fileInputRef.current?.click()} disabled={loading}>📎 Přiložit soubor</button>
                <button className="btn btn-ghost btn-xs" onClick={() => router.push('/app/inbox')}>📥 Z inboxu</button>
              </div>
              {messages.length > 2 && !saved && (
                <button className="btn btn-accent btn-sm" onClick={save}>
                  {mode === 'project' ? '💾 Uložit projekt' : '💾 Uložit use case'}
                </button>
              )}
              <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={loading || (!input.trim() && !attachment)}>Odeslat ↵</button>
            </div>
            <input ref={fileInputRef} type="file" style={{ display: 'none' }}
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
              onChange={handleFile} />
          </div>
        </div>
      </div>
      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </>
  )
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  )
}
