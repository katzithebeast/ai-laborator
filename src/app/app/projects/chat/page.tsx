'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, type Message } from '@/lib/supabase'

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
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [toast, setToast] = useState('')
  const [attachment, setAttachment] = useState<Attachment | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

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
        const combined = `[Obsah souboru: ${attachment.name}]\n${attachment.data}${userText ? '\n\n' + userText : ''}`
        blocks.push({ type: 'text', text: combined })
      }
      apiMessages.push({ role: 'user', content: blocks })
    } else {
      apiMessages.push({ role: 'user', content: displayText })
    }

    setAttachment(null)
    setLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages, mode: 'project' })
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
      const res = await fetch('/api/extract-project', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      })
      const data = await res.json()
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('projects').insert({
        ...data,
        author_id: user?.id,
        author_name: user?.email?.split('@')[0],
        status: 'draft',
        chat_history: messages,
      })
      setSaved(true)
      showToast('Projekt uložen jako draft ✓')
      setTimeout(() => router.push('/app/projects'), 1200)
    } catch { showToast('Chyba při ukládání') }
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  return (
    <>
      <div className="page-header" style={{ paddingBottom: 14 }}>
        <div><h1>Nový projekt</h1><p>Zpětná analýza projektu kde byla použita AI.</p></div>
        <div className="page-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/app/projects')}>← Zpět</button>
        </div>
      </div>
      <div className="page-body" style={{ paddingTop: 12, display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)', minHeight: 500 }}>
        <div className="chat-wrap">
          <div className="chat-header">
            <span>model: <strong>claude-sonnet-4-20250514</strong> · režim: analýza projektu</span>
          </div>
          <div className="chat-messages">
            {messages.length === 0 ? (
              <div className="chat-empty">
                <span className="chat-empty-icon">📁</span>
                <strong style={{ color: 'var(--text)', fontSize: 15 }}>Zpětná analýza projektu</strong>
                <span>AI se tě postupně zeptá na projekt kde jsi použil/a AI — co fungovalo, co ne, a co příště.</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => send('Chci zdokumentovat projekt kde jsme použili AI.')}>📁 Spustit analýzu projektu</button>
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
              </div>
              {messages.length > 2 && !saved && (
                <button className="btn btn-accent btn-sm" onClick={save}>💾 Uložit projekt</button>
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
