import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import Logo from '../components/Logo'

export default function Setup({ onComplete }: { onComplete: () => void }) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/setup', form)
      onComplete()
      navigate('/login')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Setup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '0 16px' }}>
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Logo size={36} />
          <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>PurelyManage</span>
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>Initial Setup</h2>
        <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 28 }}>Create your owner account to get started.</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Name</label>
            <input style={inputStyle} placeholder="Your name" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" placeholder="admin@example.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input style={inputStyle} type="password" placeholder="Min 8 characters" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required minLength={8} />
          </div>
          {error && <p style={{ color: 'var(--error)', fontSize: 14 }}>{error}</p>}
          <button style={btnStyle} type="submit" disabled={loading}>
            {loading ? 'Setting up...' : 'Create Owner Account'}
          </button>
        </form>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 8, color: 'var(--text)', fontSize: 14, outline: 'none',
}
const btnStyle: React.CSSProperties = {
  padding: '11px', background: 'var(--primary)', color: '#fff', border: 'none',
  borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 4,
}
