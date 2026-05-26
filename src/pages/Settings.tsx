import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'
import api from '../lib/api'
import Layout from '../components/Layout'

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'never'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

type Tab = 'users' | 'sessions' | 'account' | 'audit' | 'pending'

const TAB_LABELS: Record<Tab, string> = {
  users: 'Sysadmin Users',
  sessions: 'Sessions',
  account: 'Account',
  audit: 'Audit Log',
  pending: 'Pending Deletions',
}

export default function Settings() {
  const location = useLocation()
  const [tab, setTab] = useState<Tab>((location.state as any)?.tab ?? 'users')

  const { data: pendingData } = useQuery({
    queryKey: ['pending-deletions'],
    queryFn: () => api.get('/pending-deletions').then(r => r.data),
    refetchInterval: 30000,
  })
  const pendingCount = (pendingData?.deletions ?? []).filter((d: any) => d.status === 'pending').length

  return (
    <Layout>
      <h1 style={h1}>Settings</h1>
      <div className="responsive-tabs" style={{ marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {(['users', 'sessions', 'account', 'audit', 'pending'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 18px', background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
            color: tab === t ? 'var(--text)' : 'var(--muted)', marginBottom: -1,
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {TAB_LABELS[t]}
            {t === 'pending' && pendingCount > 0 && (
              <span style={{
                background: 'var(--error)', color: '#fff', borderRadius: 10,
                fontSize: 11, fontWeight: 700, padding: '1px 6px', lineHeight: 1.4,
              }}>{pendingCount}</span>
            )}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'account' && <AccountTab />}
      {tab === 'audit' && <AuditLogTab />}
      {tab === 'pending' && <PendingDeletionsTab />}
    </Layout>
  )
}

function UsersTab() {
  const qc = useQueryClient()
  const me = JSON.parse(localStorage.getItem('user') ?? '{}')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => api.get('/admin/users').then(r => r.data),
  })

  const users: any[] = data?.users ?? []

  const addMutation = useMutation({
    mutationFn: () => api.post('/admin/users', form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setShowModal(false)
      setForm({ name: '', email: '', password: '' })
      setError('')
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Failed to add user'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] })
      setDeleteTarget(null)
    },
  })

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>People who can log into PurelyManage.</p>
        {me.isOwner && <button style={btnPrimary} onClick={() => { setForm({ name: '', email: '', password: '' }); setError(''); setShowModal(true) }}>+ Add User</button>}
      </div>

      {isLoading ? <p style={{ color: 'var(--muted)' }}>Loading...</p> : (
        <div className="responsive-table-wrap">
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Email</th>
                <th style={th}>Role</th>
                <th style={th}>Added</th>
                {me.isOwner && <th style={{ ...th, width: 80 }}></th>}
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id}>
                  <td style={td}>{u.name} {u.id === me.id && <span style={badge}>You</span>}</td>
                  <td style={td}>{u.email}</td>
                  <td style={td}>{u.is_owner ? <span style={{ ...badge, color: 'var(--primary)', background: 'rgba(99,102,241,0.1)' }}>Owner</span> : <span style={badge}>Admin</span>}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                  {me.isOwner && (
                    <td style={{ ...td, textAlign: 'right' }}>
                      {u.id !== me.id && !u.is_owner && (
                        <button style={btnDanger} onClick={() => setDeleteTarget(u)}>Remove</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={overlay}>
          <div className="responsive-modal" style={modal}>
            <h2 style={modalTitle}>Add Sysadmin</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>Name</label>
                <input style={input} placeholder="Full name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Email</label>
                <input style={input} type="email" placeholder="admin@example.com" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={label}>Password</label>
                <input style={input} type="password" placeholder="Min 8 characters" value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
              {error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button style={btnSecondary} onClick={() => setShowModal(false)}>Cancel</button>
                <button style={btnPrimary} disabled={addMutation.isPending} onClick={() => addMutation.mutate()}>
                  {addMutation.isPending ? 'Adding...' : 'Add User'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 400 }}>
            <h2 style={modalTitle}>Remove User</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
              Remove <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong> ({deleteTarget.email})? They will lose access immediately.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button style={{ ...btnPrimary, background: 'var(--error)' }}
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deleteTarget.id)}>
                {deleteMutation.isPending ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SessionsTab() {
  const qc = useQueryClient()
  const [revokeTarget, setRevokeTarget] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get('/auth/sessions').then(r => r.data),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/auth/sessions/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] })
      setRevokeTarget(null)
    },
  })

  const sessions: any[] = data?.sessions ?? []

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>Your active login sessions. Revoke any you don't recognise.</p>
      {isLoading ? <p style={{ color: 'var(--muted)' }}>Loading...</p> : sessions.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No active sessions.</p>
      ) : (
        <div className="responsive-table-wrap">
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Device / Browser</th>
                <th style={th}>IP</th>
                <th style={th}>Last Active</th>
                <th style={th}>Expires</th>
                <th style={{ ...th, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s: any) => (
                <tr key={s.id}>
                  <td style={{ ...td, color: 'var(--muted)', fontSize: 13 }}>{s.user_agent ?? '-'}</td>
                  <td style={td}>{s.ip ?? '-'}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{timeAgo(s.last_seen_at ?? s.created_at)}</td>
                  <td style={{ ...td, color: 'var(--muted)' }}>{new Date(s.expires_at).toLocaleDateString()}</td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <button style={btnDanger} onClick={() => setRevokeTarget(s)}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {revokeTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 400 }}>
            <h2 style={modalTitle}>Revoke Session</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 8 }}>
              Revoke this session?
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24, fontFamily: 'monospace' }}>
              {revokeTarget.ip ?? '-'} · {revokeTarget.user_agent?.split(' ')[0] ?? '-'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setRevokeTarget(null)}>Cancel</button>
              <button style={{ ...btnPrimary, background: 'var(--error)' }}
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(revokeTarget.id)}>
                {revokeMutation.isPending ? 'Revoking...' : 'Revoke'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AccountTab() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const mutation = useMutation({
    mutationFn: () => api.patch('/admin/users/me/password', {
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    }),
    onSuccess: () => {
      setSuccess(true)
      setForm({ currentPassword: '', newPassword: '', confirm: '' })
      setError('')
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Failed to update password'),
  })

  const [testEmailMsg, setTestEmailMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const testMutation = useMutation({
    mutationFn: () => api.post('/admin/test-email'),
    onSuccess: (r) => setTestEmailMsg({ ok: true, text: r.data.message }),
    onError: (e: any) => setTestEmailMsg({ ok: false, text: e.response?.data?.error ?? 'Failed to send test email' }),
  })

  function submit() {
    if (form.newPassword !== form.confirm) return setError('Passwords do not match')
    if (form.newPassword.length < 8) return setError('Password must be at least 8 characters')
    setError('')
    setSuccess(false)
    mutation.mutate()
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Change your login password.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <label style={label}>Current Password</label>
          <input style={input} type="password" value={form.currentPassword}
            onChange={e => setForm(f => ({ ...f, currentPassword: e.target.value }))} />
        </div>
        <div>
          <label style={label}>New Password</label>
          <input style={input} type="password" placeholder="Min 8 characters" value={form.newPassword}
            onChange={e => setForm(f => ({ ...f, newPassword: e.target.value }))} />
        </div>
        <div>
          <label style={label}>Confirm New Password</label>
          <input style={input} type="password" value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))} />
        </div>
        {error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>}
        {success && <p style={{ color: 'var(--success)', fontSize: 13 }}>Password updated successfully.</p>}
        <button style={{ ...btnPrimary, alignSelf: 'flex-start' }} disabled={mutation.isPending} onClick={submit}>
          {mutation.isPending ? 'Updating...' : 'Update Password'}
        </button>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '28px 0' }} />

      <div>
        <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>
          Verify that email notifications are working. A test email will be sent to your account email address (<strong style={{ color: 'var(--text)' }}>{JSON.parse(localStorage.getItem('user') ?? '{}').email}</strong>).
        </p>
        <button
          style={{ ...btnSecondary, alignSelf: 'flex-start' }}
          disabled={testMutation.isPending}
          onClick={() => { setTestEmailMsg(null); testMutation.mutate() }}
        >
          {testMutation.isPending ? 'Sending...' : 'Send Test Email'}
        </button>
        {testEmailMsg && (
          <p style={{ color: testEmailMsg.ok ? 'var(--success)' : 'var(--error)', fontSize: 13, marginTop: 10 }}>
            {testEmailMsg.text}
          </p>
        )}
      </div>
    </div>
  )
}

function AuditLogTab() {
  const [page, setPage] = useState(1)
  const [actionFilter, setActionFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')

  useEffect(() => { setPage(1) }, [actionFilter, fromFilter, toFilter, searchFilter])

  const params = new URLSearchParams({ page: String(page), perPage: '50' })
  if (actionFilter) params.set('action', actionFilter)
  if (fromFilter) params.set('from', fromFilter)
  if (toFilter) params.set('to', toFilter)
  if (searchFilter) params.set('search', searchFilter)

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', page, actionFilter, fromFilter, toFilter, searchFilter],
    queryFn: () => api.get(`/admin/audit?${params}`).then(r => r.data),
  })

  const entries: any[] = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / 50)
  const allActions: string[] = data?.actions ?? []
  const hasFilters = !!(actionFilter || fromFilter || toFilter || searchFilter)

  function clearFilters() {
    setActionFilter(''); setFromFilter(''); setToFilter(''); setSearchFilter('')
  }

  function formatAction(action: string): string {
    return action.split('.').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }

  function formatMeta(meta: any): string | null {
    if (!meta) return null
    if (meta.ip) return `IP: ${meta.ip}`
    return null
  }

  const filterRow: React.CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16, alignItems: 'center' }
  const filterInput: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 13, padding: '6px 10px', outline: 'none' }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 16 }}>
        Every administrative action is logged here. Showing {entries.length} of {total} {hasFilters ? 'filtered ' : ''}entries.
      </p>

      <div style={filterRow}>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)} style={{ ...filterInput, minWidth: 160 }}>
          <option value="">All actions</option>
          {allActions.map(a => <option key={a} value={a}>{formatAction(a)}</option>)}
        </select>
        <input type="date" value={fromFilter} onChange={e => setFromFilter(e.target.value)} style={filterInput} title="From date" />
        <input type="date" value={toFilter} onChange={e => setToFilter(e.target.value)} style={filterInput} title="To date" />
        <input
          type="text" placeholder="Search target..." value={searchFilter}
          onChange={e => setSearchFilter(e.target.value)}
          style={{ ...filterInput, minWidth: 180 }}
        />
        {hasFilters && (
          <button onClick={clearFilters} style={{ ...btnSecondary, fontSize: 12, padding: '5px 12px' }}>
            Clear filters
          </button>
        )}
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : entries.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>{hasFilters ? 'No entries match your filters.' : 'No entries yet.'}</p>
      ) : (
        <>
          <div className="audit-log-wrap">
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Time</th>
                  <th style={th}>User</th>
                  <th style={th}>Action</th>
                  <th style={th}>Target</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id}>
                    <td style={{ ...td, color: 'var(--muted)', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td style={td}>
                      {e.user_name ? (
                        <span>{e.user_name}<br /><span style={{ fontSize: 12, color: 'var(--muted)' }}>{e.user_email}</span></span>
                      ) : (
                        <span style={{ color: 'var(--muted)', fontStyle: 'italic' }}>system</span>
                      )}
                    </td>
                    <td style={{ ...td, fontSize: 13, fontFamily: 'monospace' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                        background: 'rgba(99,102,241,0.1)', color: 'var(--primary)',
                      }}>
                        {formatAction(e.action)}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize: 13, color: 'var(--muted)' }}>
                      {e.target || formatMeta(e.meta) || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 }}>
              <button
                style={{ ...btnSecondary, opacity: page <= 1 ? 0.4 : 1, cursor: page <= 1 ? 'default' : 'pointer' }}
                disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              >Previous</button>
              <span style={{ fontSize: 13, color: 'var(--muted)' }}>Page {page} of {totalPages}</span>
              <button
                style={{ ...btnSecondary, opacity: page >= totalPages ? 0.4 : 1, cursor: page >= totalPages ? 'default' : 'pointer' }}
                disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              >Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PendingDeletionsTab() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['pending-deletions'],
    queryFn: () => api.get('/pending-deletions').then(r => r.data),
    refetchInterval: 30000,
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/pending-deletions/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['pending-deletions'] }),
  })

  const pending = (data?.deletions ?? []).filter((d: any) => d.status === 'pending')

  const typeLabel: Record<string, string> = {
    user: 'Email User',
    domain: 'Domain',
    routing_rule: 'Routing Rule',
  }

  function timeRemaining(scheduledFor: string): string {
    const ms = new Date(scheduledFor).getTime() - Date.now()
    if (ms <= 0) return 'Executing soon...'
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`
  }

  return (
    <div>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 20 }}>
        Destructive actions are held for 24 hours before executing. Cancel any that were not authorized.
      </p>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : pending.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No pending deletions.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.map((d: any) => (
            <div key={d.id} style={{
              background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 10, padding: '16px 20px',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap',
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: 'var(--error)', textTransform: 'uppercase',
                    letterSpacing: '0.05em', background: 'rgba(239,68,68,0.12)', padding: '2px 7px', borderRadius: 4,
                  }}>
                    {typeLabel[d.resource_type] ?? d.resource_type}
                  </span>
                  <strong style={{ color: 'var(--text)', fontSize: 14 }}>{d.resource_label}</strong>
                </div>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>
                  Scheduled by <strong style={{ color: 'var(--text)' }}>{d.triggered_by_name ?? 'unknown'}</strong>
                  {' · '}{timeRemaining(d.scheduled_for)}
                  {' · '}Executes {new Date(d.scheduled_for).toLocaleString()}
                </p>
              </div>
              <button
                style={btnDanger}
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(d.id)}
              >
                Cancel
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const h1: React.CSSProperties = { fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 24 }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const th: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', background: 'var(--surface)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const td: React.CSSProperties = { padding: '13px 16px', fontSize: 14, color: 'var(--text)', borderBottom: '1px solid var(--border)' }
const badge: React.CSSProperties = { display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: 'rgba(148,163,184,0.1)', color: 'var(--muted)', marginLeft: 6 }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 440 }
const modalTitle: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }
const label: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '9px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
