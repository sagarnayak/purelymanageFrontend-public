import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { copyToClipboard } from '../lib/clipboard'
import Layout from '../components/Layout'

function ManageModal({ userName, onClose }: { userName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [newPassword, setNewPassword] = useState('')
  const [pwCopied, setPwCopied] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)
  const [pwError, setPwError] = useState('')
  const [tfaError, setTfaError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['user', userName],
    queryFn: () => api.get(`/pm/users/${encodeURIComponent(userName)}`).then(r => r.data.user),
  })

  const pwMutation = useMutation({
    mutationFn: () => api.patch(`/pm/users/${encodeURIComponent(userName)}`, { newPassword }),
    onSuccess: () => { setPwSuccess(true); setPwError('') },
    onError: (e: any) => setPwError(e.response?.data?.error ?? 'Failed to reset password'),
  })

  const tfaMutation = useMutation({
    mutationFn: (enabled: boolean) => api.patch(`/pm/users/${encodeURIComponent(userName)}`, { requireTwoFactorAuthentication: enabled }),
    onSuccess: () => { setTfaError(''); qc.invalidateQueries({ queryKey: ['user', userName] }) },
    onError: (e: any) => setTfaError(e.response?.data?.error ?? 'Failed to update 2FA'),
  })

  const strength = passwordStrength(newPassword)
  const twoFaEnabled = data?.requireTwoFactorAuthentication ?? false

  return (
    <div style={overlay}>
      <div className="responsive-modal" style={{ ...modal, maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={modalTitle}>Manage User</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--primary)', background: 'rgba(99,102,241,0.1)', padding: '6px 10px', borderRadius: 6, marginBottom: 24 }}>{userName}</p>

        {isLoading ? <p style={{ color: 'var(--muted)', marginBottom: 24 }}>Loading...</p> : (
          <>
            {/* 2FA Toggle */}
            <div style={{ marginBottom: 28, padding: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>Two-Factor Authentication</p>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Currently <strong style={{ color: twoFaEnabled ? 'var(--success)' : 'var(--muted)' }}>{twoFaEnabled ? 'enabled' : 'disabled'}</strong>
                  </p>
                </div>
                <button
                  disabled={tfaMutation.isPending}
                  onClick={() => tfaMutation.mutate(!twoFaEnabled)}
                  style={{
                    padding: '7px 16px', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                    background: twoFaEnabled ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                    color: twoFaEnabled ? 'var(--error)' : 'var(--success)',
                  }}>
                  {tfaMutation.isPending ? '...' : twoFaEnabled ? 'Disable' : 'Enable'}
                </button>
              </div>
              {tfaError && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 8 }}>{tfaError}</p>}
            </div>

            {/* Password Reset */}
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>Reset Password</p>
              <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                <input style={{ ...input, flex: 1, fontFamily: 'monospace' }} placeholder="New password"
                  value={newPassword} onChange={e => { setNewPassword(e.target.value); setPwSuccess(false) }} />
                <button style={btnSecondary} onClick={() => { setNewPassword(generatePassword()); setPwSuccess(false) }}>Generate</button>
                <button style={btnSecondary} onClick={() => { copyToClipboard(newPassword); setPwCopied(true); setTimeout(() => setPwCopied(false), 1500) }}>
                  {pwCopied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              {newPassword && <p style={{ fontSize: 12, color: strength.color, marginBottom: 10 }}>{strength.label}</p>}
              {pwError && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 10 }}>{pwError}</p>}
              {pwSuccess && <p style={{ color: 'var(--success)', fontSize: 13, marginBottom: 10 }}>Password reset successfully.</p>}
              <button
                style={{ ...btnPrimary, opacity: newPassword.length >= 8 ? 1 : 0.5, cursor: newPassword.length >= 8 ? 'pointer' : 'not-allowed' }}
                disabled={newPassword.length < 8 || pwMutation.isPending}
                onClick={() => pwMutation.mutate()}>
                {pwMutation.isPending ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function generatePassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#%'
  return Array.from(crypto.getRandomValues(new Uint8Array(20)))
    .map(b => chars[b % chars.length]).join('')
}

function passwordStrength(pw: string): { label: string; color: string } {
  if (!pw) return { label: '', color: 'transparent' }
  if (pw.length < 8) return { label: 'Too short', color: 'var(--error)' }
  const score = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pw)).length
  if (score < 2) return { label: 'Weak', color: 'var(--error)' }
  if (score < 3) return { label: 'Fair', color: 'var(--warning)' }
  if (pw.length < 12) return { label: 'Good', color: 'var(--warning)' }
  return { label: 'Strong', color: 'var(--success)' }
}

export default function Users() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ userName: '', domainName: '', password: '' })
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [manageTarget, setManageTarget] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/pm/users').then(r => r.data),
  })

  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get('/pm/domains').then(r => r.data),
  })

  const { data: pendingData } = useQuery({
    queryKey: ['pending-deletions'],
    queryFn: () => api.get('/pending-deletions').then(r => r.data),
    refetchInterval: 30000,
  })

  const pendingUsers = new Set(
    (pendingData?.deletions ?? [])
      .filter((d: any) => d.resource_type === 'user' && d.status === 'pending')
      .map((d: any) => d.resource_id)
  )

  const domains: any[] = domainsData?.domains ?? []
  const allUsers: string[] = usersData?.users ?? []
  const users = search.trim()
    ? allUsers.filter(u => u.toLowerCase().includes(search.toLowerCase()))
    : allUsers

  const createMutation = useMutation({
    mutationFn: (body: typeof form) => api.post('/pm/users', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      qc.invalidateQueries({ queryKey: ['account'] })
      setShowModal(false)
      setForm({ userName: '', domainName: '', password: '' })
      setError('')
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Failed to create user'),
  })

  const deleteMutation = useMutation({
    mutationFn: (userName: string) => api.delete(`/pm/users/${encodeURIComponent(userName)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-deletions'] })
      setDeleteTarget(null)
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Failed to schedule deletion'),
  })

  function openModal() {
    const pw = generatePassword()
    const defaultDomain = domains[0]?.name ?? ''
    setForm({ userName: '', domainName: defaultDomain, password: pw })
    setError('')
    setShowModal(true)
  }

  function copyPassword() {
    copyToClipboard(form.password)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const canSubmit = form.userName.trim() && form.domainName && form.password.length >= 8
  const strength = passwordStrength(form.password)

  return (
    <Layout>
      <div className="page-header">
        <h1 style={h1}>Users</h1>
        <button style={btnPrimary} onClick={openModal}>+ Add User</button>
      </div>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <input
          style={{ ...input, maxWidth: 320 }}
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>
            {users.length} of {allUsers.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : users.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>{search ? `No users matching "${search}".` : 'No users yet.'}</p>
      ) : (
        <div className="responsive-table-wrap">
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Email</th>
                <th style={{ ...th, width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>{u}</span>
                      {copiedEmail === u ? (
                        <span style={{ color: 'var(--success)', fontSize: 12, fontWeight: 600 }}>Copied</span>
                      ) : (
                        <button
                          onClick={() => { copyToClipboard(u); setCopiedEmail(u); setTimeout(() => setCopiedEmail(null), 1500) }}
                          title="Copy email"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 2, display: 'flex', alignItems: 'center' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button style={btnSecondary} onClick={() => setManageTarget(u)}>Manage</button>
                      {pendingUsers.has(u) ? (
                        <button style={btnPending} disabled title="Deletion already scheduled">Pending</button>
                      ) : (
                        <button style={btnDanger} onClick={() => setDeleteTarget(u)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={overlay}>
          <div className="responsive-modal" style={modal}>
            <h2 style={modalTitle}>Add User</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>Username</label>
                  <input style={input} placeholder="john" value={form.userName}
                    onChange={e => setForm(f => ({ ...f, userName: e.target.value }))} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>Domain</label>
                  <select style={input} value={form.domainName}
                    onChange={e => setForm(f => ({ ...f, domainName: e.target.value }))}>
                    {domains.length === 0 && <option value="">No domains available</option>}
                    {domains.map((d: any) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              {form.userName && form.domainName && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -8 }}>
                  Will create: <strong style={{ color: 'var(--text)' }}>{form.userName}@{form.domainName}</strong>
                </p>
              )}
              <div>
                <label style={label}>Password</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={{ ...input, flex: 1, fontFamily: 'monospace' }} value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <button style={btnSecondary} type="button" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}>
                    Regenerate
                  </button>
                  <button style={btnSecondary} type="button" onClick={copyPassword}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                {form.password && (
                  <p style={{ fontSize: 12, color: strength.color, marginTop: 6 }}>{strength.label}</p>
                )}
              </div>
              {error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button style={btnSecondary} onClick={() => setShowModal(false)}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: canSubmit ? 1 : 0.5, cursor: canSubmit ? 'pointer' : 'not-allowed' }}
                  disabled={!canSubmit || createMutation.isPending}
                  onClick={() => createMutation.mutate(form)}>
                  {createMutation.isPending ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {manageTarget && <ManageModal userName={manageTarget} onClose={() => setManageTarget(null)} />}

      {deleteTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 420 }}>
            <h2 style={modalTitle}>Schedule Deletion</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>
              <strong style={{ color: 'var(--text)' }}>{deleteTarget}</strong> will be permanently deleted in 24 hours.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
              You can cancel this under <strong style={{ color: 'var(--text)' }}>Settings → Pending Deletions</strong> before it executes.
            </p>
            {error && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => { setDeleteTarget(null); setError('') }}>Cancel</button>
              <button style={{ ...btnPrimary, background: 'var(--error)' }}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget)}>
                {deleteMutation.isPending ? 'Scheduling...' : 'Schedule Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

const h1: React.CSSProperties = { fontSize: 22, fontWeight: 600, color: 'var(--text)' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const th: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', background: 'var(--surface)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const td: React.CSSProperties = { padding: '13px 16px', fontSize: 14, color: 'var(--text)', borderBottom: '1px solid var(--border)' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 520 }
const modalTitle: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }
const label: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '9px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
const btnPending: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'not-allowed', opacity: 0.6 }
