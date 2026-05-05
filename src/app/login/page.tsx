'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const handle = async () => {
    setLoading(true); setError(''); setSuccessMsg('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        router.replace('/app/chat')
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSuccessMsg('✅ Registrace proběhla úspěšně! Zkontroluj svůj email a klikni na potvrzovací odkaz pro dokončení registrace.')
        setMode('login')
      }
    } catch (e: unknown) {
      setError((e as { message?: string }).message || 'Chyba')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">λ</div>
        <h1>AI Laboratoř</h1>
        <p>Firemní systém pro AI use cases</p>
        {error && <div className="login-error show">{error}</div>}
        {successMsg && <div className="login-success show">{successMsg}</div>}
        <div className="form-group" style={{ textAlign:'left' }}>
          <label className="form-label">Firemní email</label>
          <input className="form-input" type="email" placeholder="jmeno@firma.cz"
            value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        <div className="form-group" style={{ textAlign:'left' }}>
          <label className="form-label">Heslo</label>
          <input className="form-input" type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handle()} />
        </div>
        <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:6 }}
          onClick={handle} disabled={loading || !email || !password}>
          {loading ? 'Přihlašuji…' : mode === 'login' ? 'Přihlásit se' : 'Registrovat'}
        </button>
        <div style={{ marginTop:14, fontSize:12.5, color:'var(--text3)' }}>
          {mode === 'login'
            ? <><span>Ještě nemáš účet? </span><button className="btn btn-ghost btn-sm" style={{ display:'inline', padding:0 }} onClick={() => setMode('signup')}>Registrovat</button></>
            : <><span>Už máš účet? </span><button className="btn btn-ghost btn-sm" style={{ display:'inline', padding:0 }} onClick={() => setMode('login')}>Přihlásit se</button></>
          }
        </div>
      </div>
    </div>
  )
}
