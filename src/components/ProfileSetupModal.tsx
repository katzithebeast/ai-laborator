'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export const AVATARS = [
  { seed: 'Felix',   name: 'Kočka',      emoji: '🐱' },
  { seed: 'Buddy',   name: 'Pes',        emoji: '🐶' },
  { seed: 'Max',     name: 'Medvěd',     emoji: '🐻' },
  { seed: 'Luna',    name: 'Liška',      emoji: '🦊' },
  { seed: 'Charlie', name: 'Králík',     emoji: '🐰' },
  { seed: 'Milo',    name: 'Tučňák',     emoji: '🐧' },
  { seed: 'Bella',   name: 'Panda',      emoji: '🐼' },
  { seed: 'Rocky',   name: 'Lev',        emoji: '🦁' },
  { seed: 'Daisy',   name: 'Koala',      emoji: '🐨' },
  { seed: 'Cleo',    name: 'Žirafa',     emoji: '🦒' },
  { seed: 'Leo',     name: 'Slon',       emoji: '🐘' },
  { seed: 'Zara',    name: 'Jednorožec', emoji: '🦄' },
]

export function dicebearUrl(seed: string) {
  return `https://api.dicebear.com/7.x/fun-emoji/svg?seed=${seed}`
}

interface Props {
  userId: string
  onComplete: (avatarUrl: string | null, firstName: string, lastName: string) => void
}

export default function ProfileSetupModal({ userId, onComplete }: Props) {
  const [selectedSeed, setSelectedSeed] = useState<string | null>(null)
  const [customAvatarUrl, setCustomAvatarUrl] = useState<string | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [position, setPosition] = useState('')
  const [bio, setBio] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [team, setTeam] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCustomAvatarUrl(reader.result as string)
      setSelectedSeed(null)
    }
    reader.readAsDataURL(file)
  }

  const avatarUrl = customAvatarUrl ?? (selectedSeed ? dicebearUrl(selectedSeed) : null)

  const clearError = (field: string) => setErrors(p => ({ ...p, [field]: '' }))

  const save = async () => {
    const newErrors: Record<string, string> = {}
    if (!firstName.trim()) newErrors.first_name = 'Povinné pole'
    if (!lastName.trim()) newErrors.last_name = 'Povinné pole'
    if (!company.trim()) newErrors.company = 'Povinné pole'
    if (!position.trim()) newErrors.position = 'Povinné pole'
    if (linkedinUrl && !linkedinUrl.startsWith('https://')) {
      newErrors.linkedin_url = 'URL musí začínat https://'
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }

    setSaving(true)
    const { error } = await supabase.from('profiles').upsert({
      id: userId,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      full_name: `${firstName.trim()} ${lastName.trim()}`,
      phone: phone.trim() || null,
      company: company.trim(),
      position: position.trim(),
      bio: bio.trim() || null,
      linkedin_url: linkedinUrl.trim() || null,
      team: team.trim() || null,
      avatar_url: avatarUrl,
      profile_completed: true,
    })

    if (error) { setErrors({ general: error.message }); setSaving(false); return }
    onComplete(avatarUrl, firstName.trim(), lastName.trim())
  }

  const canSave = firstName.trim() && lastName.trim() && company.trim() && position.trim()

  const errStyle = (field: string): React.CSSProperties =>
    errors[field] ? { borderColor: '#e02020' } : {}

  const SectionTitle = ({ title }: { title: string }) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 12, paddingBottom: 6, borderBottom: '1px solid var(--border)', marginTop: 24 }}>
      {title}
    </div>
  )

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        width: '100%',
        maxWidth: 600,
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '32px 28px',
      }}>
        {/* Hlavička */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
            Vítej v AI Laboratoři! 👋
          </h2>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            Než začneš, vyplň prosím svůj profil
          </p>
        </div>

        {errors.general && (
          <div className="login-error show" style={{ marginTop: 16 }}>{errors.general}</div>
        )}

        {/* SEKCE 1: Avatar */}
        <SectionTitle title="Výběr avatara" />

        {customAvatarUrl ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <img src={customAvatarUrl} alt="avatar" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--accent, #e02020)' }} />
            <div>
              <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 6 }}>Vlastní foto nahráno</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setCustomAvatarUrl(null)}>Zrušit</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 12 }}>
            {AVATARS.map(a => (
              <button
                key={a.seed}
                onClick={() => setSelectedSeed(a.seed)}
                title={`${a.emoji} ${a.name}`}
                style={{
                  border: `2px solid ${selectedSeed === a.seed ? '#e02020' : 'var(--border)'}`,
                  borderRadius: 8,
                  background: selectedSeed === a.seed ? 'rgba(224,32,32,0.08)' : 'transparent',
                  padding: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <img src={dicebearUrl(a.seed)} alt={a.name} width={40} height={40} style={{ borderRadius: 4 }} />
                <span style={{ fontSize: 10, color: 'var(--text3)' }}>{a.emoji}</span>
              </button>
            ))}
          </div>
        )}

        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
        <button className="btn btn-ghost btn-sm" onClick={() => fileInputRef.current?.click()}>
          📷 Nahrát vlastní foto
        </button>

        {/* SEKCE 2: Osobní údaje */}
        <SectionTitle title="Osobní údaje" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="form-group">
            <label className="form-label">Jméno *</label>
            <input className="form-input" style={errStyle('first_name')} value={firstName}
              onChange={e => { setFirstName(e.target.value); clearError('first_name') }}
              placeholder="Jan" />
            {errors.first_name && <div style={{ fontSize: 11, color: '#e02020', marginTop: 3 }}>{errors.first_name}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Příjmení *</label>
            <input className="form-input" style={errStyle('last_name')} value={lastName}
              onChange={e => { setLastName(e.target.value); clearError('last_name') }}
              placeholder="Novák" />
            {errors.last_name && <div style={{ fontSize: 11, color: '#e02020', marginTop: 3 }}>{errors.last_name}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Firma / Organizace *</label>
            <input className="form-input" style={errStyle('company')} value={company}
              onChange={e => { setCompany(e.target.value); clearError('company') }}
              placeholder="Wexia Digital" />
            {errors.company && <div style={{ fontSize: 11, color: '#e02020', marginTop: 3 }}>{errors.company}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Pracovní pozice *</label>
            <input className="form-input" style={errStyle('position')} value={position}
              onChange={e => { setPosition(e.target.value); clearError('position') }}
              placeholder="Marketing Manager" />
            {errors.position && <div style={{ fontSize: 11, color: '#e02020', marginTop: 3 }}>{errors.position}</div>}
          </div>
          <div className="form-group">
            <label className="form-label">Telefon</label>
            <input className="form-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+420 123 456 789" />
          </div>
          <div className="form-group">
            <label className="form-label">Tým / Oddělení</label>
            <input className="form-input" value={team} onChange={e => setTeam(e.target.value)} placeholder="Marketing, IT…" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Bio</label>
            <textarea className="form-textarea" rows={2} value={bio} onChange={e => setBio(e.target.value)} placeholder="Krátce o sobě…" />
          </div>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">LinkedIn URL</label>
            <input className="form-input" style={errStyle('linkedin_url')} value={linkedinUrl}
              onChange={e => { setLinkedinUrl(e.target.value); clearError('linkedin_url') }}
              placeholder="https://linkedin.com/in/..." />
            {errors.linkedin_url && <div style={{ fontSize: 11, color: '#e02020', marginTop: 3 }}>{errors.linkedin_url}</div>}
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button className="btn btn-primary" onClick={save} disabled={!canSave || saving}>
            {saving ? 'Ukládám…' : 'Uložit profil a pokračovat →'}
          </button>
        </div>
      </div>
    </div>
  )
}
