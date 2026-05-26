import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import Logo from '../components/Logo'

const BASE = import.meta.env.VITE_API_URL || '/api'

async function gatherGet(token: string) {
  const res = await fetch(`${BASE}/gather/${token}`)
  return { status: res.status, data: await res.json() }
}

async function gatherSubmit(token: string, body: object) {
  const res = await fetch(`${BASE}/gather/${token}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: res.status, data: await res.json() }
}

type Screen = 'loading' | 'invalid' | 'expired' | 'form' | 'success' | 'already_submitted'

export default function GatherForm() {
  const { token } = useParams<{ token: string }>()
  const [screen, setScreen] = useState<Screen>('loading')
  const [serverName, setServerName] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const [name, setName] = useState('')
  const [sourceEmail, setSourceEmail] = useState('')
  const [sourcePassword, setSourcePassword] = useState('')
  const [showSourcePw, setShowSourcePw] = useState(false)
  const [destEmail, setDestEmail] = useState('')
  const [destPassword, setDestPassword] = useState('')
  const [showDestPw, setShowDestPw] = useState(false)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [destError, setDestError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [successEmail, setSuccessEmail] = useState('')

  useEffect(() => {
    if (!token) { setScreen('invalid'); return }
    gatherGet(token).then(({ status, data }) => {
      if (status === 410) { setScreen('expired'); return }
      if (status !== 200) { setScreen('invalid'); return }
      setServerName(data.serverName ?? '')
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt).toLocaleDateString() : '')
      setScreen('form')
    }).catch(() => setScreen('invalid'))
  }, [token])

  async function checkEmailExists(email: string) {
    if (!email.trim() || !token) return
    try {
      const res = await fetch(`${BASE}/gather/${token}/check?email=${encodeURIComponent(email.trim())}`)
      const data = await res.json()
      if (data.exists) setEmailError('This email has already been submitted for this campaign.')
      else setEmailError('')
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setDestError('')
    setSubmitting(true)
    try {
      const { status, data } = await gatherSubmit(token!, {
        name: name.trim(),
        sourceEmail: sourceEmail.trim(),
        sourcePassword,
        destEmail: destEmail.trim() || undefined,
        destPassword: destPassword.trim() || undefined,
      })
      if (status === 200) {
        setSuccessEmail(sourceEmail.trim())
        setScreen('success')
        return
      }
      if (status === 409) { setScreen('already_submitted'); return }
      if (status === 429) { setError('Too many attempts. Please wait 15 minutes and try again.'); return }
      const msg: string = data.error ?? 'Something went wrong. Please try again.'
      if (msg.toLowerCase().includes('domain') || msg.toLowerCase().includes('destination')) {
        setDestError(msg)
      } else {
        setError(msg)
      }
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (screen === 'loading') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (screen === 'invalid') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <Logo size={32} />
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>PurelyManage</span>
          </div>
          <p style={{ color: 'var(--error)', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Invalid link</p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>This credential form link is invalid. Please contact your administrator.</p>
        </div>
      </div>
    )
  }

  if (screen === 'expired') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <Logo size={32} />
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>PurelyManage</span>
          </div>
          <p style={{ color: 'var(--error)', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>This form has closed</p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>The credential collection period has ended. Contact your administrator if you still need to submit.</p>
        </div>
      </div>
    )
  }

  if (screen === 'already_submitted') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <Logo size={32} />
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>PurelyManage</span>
          </div>
          <p style={{ color: '#f59e0b', fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Already submitted</p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>We already have credentials on file for your email address in this campaign. No action needed.</p>
        </div>
      </div>
    )
  }

  if (screen === 'success') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <Logo size={32} />
            <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>PurelyManage</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 22, color: '#22c55e' }}>✓</span>
            <p style={{ color: '#22c55e', fontSize: 15, fontWeight: 600 }}>You're all set</p>
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
            Your credentials for <strong style={{ color: 'var(--text)' }}>{successEmail}</strong> have been securely received and verified.
          </p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>Your administrator will handle the migration. You don't need to do anything else.</p>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Logo size={32} />
          <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>PurelyManage</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 28 }}>
          Email migration credential collection
          {expiresAt && <> · Form closes {expiresAt}</>}
        </p>

        <p style={{ color: 'var(--text)', fontSize: 14, marginBottom: 24 }}>
          Your administrator is migrating email from <strong>{serverName}</strong>. Please enter your current email credentials below so your mailbox can be transferred securely.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          <div>
            <label style={labelStyle}>Your full name</label>
            <input style={inputStyle} type="text" placeholder="Jane Smith" value={name}
              onChange={e => setName(e.target.value)} required autoFocus />
          </div>

          <div>
            <label style={labelStyle}>Your email address</label>
            <input
              style={{ ...inputStyle, ...(emailError ? { borderColor: 'var(--error)' } : {}) }}
              type="email" placeholder="you@example.com" value={sourceEmail}
              onChange={e => { setSourceEmail(e.target.value); setEmailError('') }}
              onBlur={e => checkEmailExists(e.target.value)}
              required
            />
            {emailError && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{emailError}</p>}
          </div>

          <div>
            <label style={labelStyle}>Your email password</label>
            <div style={{ position: 'relative' }}>
              <input style={{ ...inputStyle, paddingRight: 48 }} type={showSourcePw ? 'text' : 'password'}
                placeholder="••••••••" value={sourcePassword}
                onChange={e => setSourcePassword(e.target.value)} required />
              <button type="button" onClick={() => setShowSourcePw(v => !v)}
                style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>
                {showSourcePw ? 'hide' : 'show'}
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18 }}>
            <label style={labelStyle}>
              Preferred destination email <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional - leave blank if unsure)</span>
            </label>
            <input style={{ ...inputStyle, ...(destError ? { borderColor: 'var(--error)' } : {}) }}
              type="email" placeholder="you@newdomain.com" value={destEmail}
              onChange={e => { setDestEmail(e.target.value); setDestError('') }} />
            {destError && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{destError}</p>}
          </div>

          {destEmail.trim() && (
            <div>
              <label style={labelStyle}>
                Destination email password <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional - only if your destination account already exists)</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input style={{ ...inputStyle, paddingRight: 48 }} type={showDestPw ? 'text' : 'password'}
                  placeholder="••••••••" value={destPassword}
                  onChange={e => setDestPassword(e.target.value)} />
                <button type="button" onClick={() => setShowDestPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 12 }}>
                  {showDestPw ? 'hide' : 'show'}
                </button>
              </div>
            </div>
          )}

          {error && <p style={{ color: 'var(--error)', fontSize: 13, background: 'rgba(220,38,38,0.08)', padding: '10px 14px', borderRadius: 8 }}>{error}</p>}

          <button style={{ ...btnStyle, opacity: (submitting || !!emailError) ? 0.7 : 1 }} type="submit" disabled={submitting || !!emailError}>
            {submitting ? 'Verifying…' : 'Submit credentials'}
          </button>

          <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center' }}>
            Your password is verified and encrypted immediately. It is never stored in plain text.
          </p>
        </form>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
  padding: '24px 16px',
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 480,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '36px 32px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--muted)',
  marginBottom: 6,
  fontWeight: 500,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
}

const btnStyle: React.CSSProperties = {
  padding: '11px',
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
}
