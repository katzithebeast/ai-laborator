'use client'
import { useState, useRef, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, type Message } from '@/lib/supabase'

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
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  useEffect(() => {
    if (toolParam) send(`Chci vytvořit use case pro nástroj: ${toolParam}`)
  }, [toolParam])  // eslint-disable-line react-hooks/exhaustive-deps

  const send = async (text?: string) => {
    const userText = text ?? input.trim()
    if (!userText || loading) return
    setInput('')
    const next: Message[] = [...messages, { role: 'user', content: userText }]
    setMessages(next)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, mode: 'chat' })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setMessages([...next, { role: 'assistant', content: data.content }])
    } catch {
      setMessages([...next, { role: 'assistant', content: '⚠️ Chyba AI. Zkontroluj API klíč na Vercelu.' }])
    } finally { setLoading(false) }
  }

  const save = async () => {
    try {
      const res = await fetch('/api/extract', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })
      const data = await res.json()
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('use_cases').insert({
        ...data,
        author_id: user?.id,
        author_name: user?.email?.split('@')[0],
        status: 'draft',
        chat_history: messages,
      })
      setSaved(true)
      showToast('Use case uložen jako draft ✓')
      setTimeout(() => router.push('/app/usecases'), 1200)
    } catch { showToast('Chyba při ukládání') }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <>
      <div className="page-header" style={{ paddingBottom: 14 }}>
        <div><h1>Chat</h1><p>Popiš projekt nebo nástroj — AI se doptá a vytvoří use case.</p></div>
        <div className="page-actions">
          {messages.length > 2 && !saved && <button className="btn btn-accent btn-sm" onClick={save}>💾 Uložit use case</button>}
          <button className="btn btn-ghost btn-sm" onClick={() => { setMessages([]); setSaved(false) }}>Vyčistit</button>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop:12, display:'flex', flexDirection:'column', height:'calc(100vh - 120px)', minHeight:500 }}>
        <div className="chat-wrap">
          <div className="chat-header">
            <span>model: <strong>claude-sonnet-4-20250514</strong> · klíč na serveru</span>
            <button className="btn btn-ghost btn-xs" onClick={() => router.push('/app/interview')}>Interview mód</button>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <span className="chat-empty-icon">🧪</span>
                <strong style={{ color:'var(--text)', fontSize:15 }}>AI asistent pro use cases</strong>
                <span>Napiš popis projektu, nástroje nebo situace. AI se doptá a vytvoří draft.</span>
                <div style={{ display:'flex', gap:8, marginTop:8, flexWrap:'wrap', justifyContent:'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => send('Chceme otestovat nový AI nástroj pro náš tým. Pomůžeš mi vytvořit use case?')}>🔧 Testujeme nový nástroj</button>
                  <button className="btn btn-outline btn-sm" onClick={() => send('Máme firemní proces, který bychom rádi zautomatizovali pomocí AI.')}>⚙️ Chceme automatizovat</button>
                  <button className="btn btn-outline btn-sm" onClick={() => send('Narazili jsme na opakující se problém a hledáme, jestli by AI mohla pomoct.')}>❓ Máme problém k řešení</button>
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
            <textarea className="chat-textarea"
              placeholder="Napiš zprávu… (Enter = odeslat, Shift+Enter = nový řádek)"
              value={input} onChange={e => setInput(e.target.value)}
              disabled={loading}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
            <div className="chat-toolbar">
              <div className="chat-toolbar-left">
                <button className="btn btn-ghost btn-xs" onClick={() => router.push('/app/inbox')}>📥 Z inboxu</button>
              </div>
              <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={loading || !input.trim()}>Odeslat ↵</button>
            </div>
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
