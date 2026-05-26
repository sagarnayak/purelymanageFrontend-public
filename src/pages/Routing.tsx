import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import Layout from '../components/Layout'

function AddressChipInput({
  value,
  onChange,
  suggestions,
}: {
  value: string[]
  onChange: (v: string[]) => void
  suggestions: string[]
}) {
  const [inputVal, setInputVal] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = inputVal.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(inputVal.toLowerCase()) && !value.includes(s))
    : []

  function add(addr: string) {
    const trimmed = addr.trim()
    if (!trimmed || value.includes(trimmed)) return
    onChange([...value, trimmed])
    setInputVal('')
    setOpen(false)
    inputRef.current?.focus()
  }

  function remove(addr: string) {
    onChange(value.filter(a => a !== addr))
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',' || e.key === 'Tab') && inputVal.trim()) {
      e.preventDefault()
      add(inputVal)
    } else if (e.key === 'Backspace' && !inputVal && value.length > 0) {
      remove(value[value.length - 1])
    }
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
          padding: '7px 10px', background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 7, cursor: 'text', minHeight: 42,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(addr => (
          <span key={addr} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
            color: 'var(--text)', borderRadius: 5, padding: '2px 8px', fontSize: 13,
          }}>
            {addr}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); remove(addr) }}
              style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={e => { setInputVal(e.target.value); setOpen(true) }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          placeholder={value.length === 0 ? 'Type an address or pick from list…' : ''}
          style={{
            flex: 1, minWidth: 180, background: 'none', border: 'none', outline: 'none',
            color: 'var(--text)', fontSize: 13, padding: '2px 2px',
          }}
        />
      </div>

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxHeight: 220, overflowY: 'auto',
        }}>
          {filtered.map(s => (
            <div
              key={s}
              onMouseDown={e => { e.preventDefault(); add(s) }}
              style={{
                padding: '9px 14px', fontSize: 13, color: 'var(--text)', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {s}
            </div>
          ))}
        </div>
      )}
      <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5 }}>
        Press Enter or comma to add. Pick from existing users or type any email.
      </p>
    </div>
  )
}

export default function Routing() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [matchUser, setMatchUser] = useState('')
  const [matchDomain, setMatchDomain] = useState('')
  const [targets, setTargets] = useState<string[]>([])
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['routing'],
    queryFn: () => api.get('/pm/routing').then(r => r.data),
  })

  const { data: domainsData } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get('/pm/domains').then(r => r.data),
  })

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/pm/users').then(r => r.data),
  })

  const { data: pendingData } = useQuery({
    queryKey: ['pending-deletions'],
    queryFn: () => api.get('/pending-deletions').then(r => r.data),
    refetchInterval: 30000,
  })

  const pendingRules = new Set(
    (pendingData?.deletions ?? [])
      .filter((d: any) => d.resource_type === 'routing_rule' && d.status === 'pending')
      .map((d: any) => d.resource_id)
  )

  const rules: any[] = data?.rules ?? []
  const domains: any[] = domainsData?.domains ?? []
  const allUsers: string[] = usersData?.users ?? []

  const createMutation = useMutation({
    mutationFn: () => api.post('/pm/routing', {
      matchUser: matchUser.trim() || null,
      matchDomain,
      targetAddresses: targets,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['routing'] })
      qc.invalidateQueries({ queryKey: ['account'] })
      setShowModal(false)
      setError('')
    },
    onError: (e: any) => setError(e.response?.data?.error ?? 'Failed to create rule'),
  })

  const [deleteError, setDeleteError] = useState('')

  const deleteMutation = useMutation({
    mutationFn: ({ id, label }: { id: number; label: string }) =>
      api.delete(`/pm/routing/${id}`, { data: { label } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-deletions'] })
      setDeleteTarget(null)
      setDeleteError('')
    },
    onError: (e: any) => setDeleteError(e.response?.data?.error ?? 'Failed to schedule deletion'),
  })

  function openModal() {
    setMatchUser('')
    setMatchDomain(domains[0]?.name ?? '')
    setTargets([])
    setError('')
    setShowModal(true)
  }

  const canCreate = matchDomain && targets.length > 0

  return (
    <Layout>
      <div className="page-header">
        <h1 style={h1}>Routing Rules</h1>
        <button style={btnPrimary} onClick={openModal}>+ Add Rule</button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : rules.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No routing rules yet.</p>
      ) : (
        <div className="responsive-table-wrap">
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Source</th>
                <th style={th}>Forward To</th>
                <th style={{ ...th, width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r: any) => (
                <tr key={r.id}>
                  <td style={td}>
                    <code style={code}>{r.matchUser ? `${r.matchUser}@${r.domainName}` : `*@${r.domainName}`}</code>
                  </td>
                  <td style={td}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {(r.targetAddresses ?? []).map((a: string) => (
                        <span key={a} style={chip}>{a}</span>
                      ))}
                    </div>
                  </td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    {pendingRules.has(String(r.id)) ? (
                      <button style={btnPending} disabled title="Deletion already scheduled">Pending</button>
                    ) : (
                      <button style={btnDanger} onClick={() => setDeleteTarget(r)}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modalStyle, maxWidth: 520 }}>
            <h2 style={modalTitle}>Add Routing Rule</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>
                    From User <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 12 }}>(blank = catch-all)</span>
                  </label>
                  <input
                    style={input}
                    placeholder="john  or leave blank for *"
                    value={matchUser}
                    onChange={e => setMatchUser(e.target.value)}
                  />
                </div>
                <span style={{ color: 'var(--muted)', fontSize: 20, paddingBottom: 10 }}>@</span>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Domain</label>
                  <select style={input} value={matchDomain} onChange={e => setMatchDomain(e.target.value)}>
                    {domains.map((d: any) => (
                      <option key={d.name} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(99,102,241,0.07)', borderRadius: 7, fontSize: 13, color: 'var(--muted)' }}>
                Emails sent to{' '}
                <code style={{ color: 'var(--primary)', fontSize: 13 }}>
                  {matchUser.trim() ? `${matchUser.trim()}@${matchDomain}` : `*@${matchDomain}`}
                </code>
                {' '}will be forwarded to the destinations below.
              </div>

              <div>
                <label style={labelStyle}>Forward To</label>
                <AddressChipInput
                  value={targets}
                  onChange={setTargets}
                  suggestions={allUsers}
                />
              </div>

              {error && <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button style={btnSecondary} onClick={() => setShowModal(false)}>Cancel</button>
                <button
                  style={{ ...btnPrimary, opacity: canCreate ? 1 : 0.5 }}
                  disabled={createMutation.isPending || !canCreate}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modalStyle, maxWidth: 420 }}>
            <h2 style={modalTitle}>Schedule Deletion</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>
              Rule{' '}
              <strong style={{ color: 'var(--text)' }}>
                {deleteTarget.matchUser ? `${deleteTarget.matchUser}@${deleteTarget.domainName}` : `*@${deleteTarget.domainName}`}
              </strong>{' '}
              will be permanently deleted in 24 hours.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
              You can cancel this under <strong style={{ color: 'var(--text)' }}>Settings → Pending Deletions</strong> before it executes.
            </p>
            {deleteError && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => { setDeleteTarget(null); setDeleteError('') }}>Cancel</button>
              <button
                style={{ ...btnPrimary, background: 'var(--error)' }}
                disabled={deleteMutation.isPending}
                onClick={() => {
                  const source = deleteTarget.matchUser
                    ? `${deleteTarget.matchUser}@${deleteTarget.domainName}`
                    : `*@${deleteTarget.domainName}`
                  const label = `${source} → ${(deleteTarget.targetAddresses ?? []).join(', ')}`
                  deleteMutation.mutate({ id: deleteTarget.id, label })
                }}
              >
                {deleteMutation.isPending ? 'Scheduling…' : 'Schedule Deletion'}
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
const code: React.CSSProperties = { fontFamily: 'monospace', fontSize: 13, background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', padding: '2px 6px', borderRadius: 4 }
const chip: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)', color: 'var(--text)', borderRadius: 5, padding: '2px 8px', fontSize: 12, fontFamily: 'monospace' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modalStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, width: '100%' }
const modalTitle: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '9px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
const btnPending: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'not-allowed', opacity: 0.6 }
