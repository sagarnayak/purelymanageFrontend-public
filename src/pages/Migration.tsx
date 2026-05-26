import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import Layout from '../components/Layout'

function EmailInput({ value, onChange, placeholder, suggestions, style: extraStyle }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  suggestions: string[]
  style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = value.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()))
    : []

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function updateDropdownPos() {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 3,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 7,
      maxHeight: 180,
      overflowY: 'auto',
    })
  }

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        style={{ ...input, ...extraStyle }}
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => { updateDropdownPos(); setOpen(true) }}
      />
      {open && filtered.length > 0 && (
        <div style={dropdownStyle}>
          {filtered.map(s => (
            <div key={s}
              onMouseDown={e => { e.preventDefault(); onChange(s); setOpen(false) }}
              style={{ padding: '8px 12px', fontSize: 13, color: 'var(--text)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >{s}</div>
          ))}
        </div>
      )}
    </div>
  )
}

type Server = { id: number; name: string; host: string; port: number; use_ssl: boolean }
type Job = {
  id: number; name: string; status: string; dry_run: boolean; batch: string | null
  source_email: string; dest_email: string
  source_server_name: string; dest_server_name: string
  started_at: string | null; finished_at: string | null
}

const STATUS_COLOR: Record<string, string> = {
  queued: 'var(--muted)', running: 'var(--primary)', done: 'var(--success)',
  failed: 'var(--error)', interrupted: 'var(--warning)', cancelled: 'var(--muted)',
}

// ── Server Tab ────────────────────────────────────────────────────────────

function ServersTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [editTarget, setEditTarget] = useState<Server | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Server | null>(null)
  const [testStates, setTestStates] = useState<Record<number, { email: string; password: string; result?: { ok: boolean; message: string } | 'testing' }>>({})
  const [form, setForm] = useState({ name: '', host: '', port: '993', useSsl: true })
  const [formError, setFormError] = useState('')

  const { data } = useQuery({ queryKey: ['migration-servers'], queryFn: () => api.get('/migration/servers').then(r => r.data.servers as Server[]) })
  const servers = data ?? []

  const saveMutation = useMutation({
    mutationFn: (s: Server | null) => s
      ? api.put(`/migration/servers/${s.id}`, { name: form.name, host: form.host, port: parseInt(form.port), useSsl: form.useSsl })
      : api.post('/migration/servers', { name: form.name, host: form.host, port: parseInt(form.port), useSsl: form.useSsl }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['migration-servers'] }); setShowAdd(false); setEditTarget(null); setFormError('') },
    onError: (e: any) => setFormError(e.response?.data?.error ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/migration/servers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['migration-servers'] }); setDeleteTarget(null) },
  })

  function openAdd() { setForm({ name: '', host: '', port: '993', useSsl: true }); setFormError(''); setShowAdd(true) }
  function openEdit(s: Server) { setForm({ name: s.name, host: s.host, port: String(s.port), useSsl: s.use_ssl }); setFormError(''); setEditTarget(s) }

  async function testServer(s: Server) {
    const state = testStates[s.id]
    if (!state?.email || !state?.password) return
    setTestStates(t => ({ ...t, [s.id]: { ...t[s.id], result: 'testing' } }))
    const res = await api.post(`/migration/servers/${s.id}/test`, { email: state.email, password: state.password }).catch(e => ({ data: { ok: false, message: e.message } }))
    setTestStates(t => ({ ...t, [s.id]: { ...t[s.id], result: res.data } }))
  }

  const canSave = form.name && form.host

  return (
    <>
      <div className="page-header">
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Define IMAP servers once, reuse across all migration jobs.</p>
        <button style={btnPrimary} onClick={openAdd}>+ Add Server</button>
      </div>

      {servers.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No servers yet. Add a source (e.g. Zoho, Gmail) or destination server.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {servers.map(s => {
            const ts = testStates[s.id] ?? { email: '', password: '' }
            return (
              <div key={s.id} style={serverCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <strong style={{ color: 'var(--text)', fontSize: 15 }}>{s.name}</strong>
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                      <code style={codeStyle}>{s.host}:{s.port}</code>
                      {s.use_ssl && <span style={sslBadge}>SSL</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnSmall} onClick={() => openEdit(s)}>Edit</button>
                    <button style={btnDanger} onClick={() => setDeleteTarget(s)}>Delete</button>
                  </div>
                </div>
                {/* Test connection inline */}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input style={{ ...inputSm, flex: 1, minWidth: 160 }} placeholder="test@example.com"
                    value={ts.email} onChange={e => setTestStates(t => ({ ...t, [s.id]: { ...t[s.id], email: e.target.value } }))} />
                  <input style={{ ...inputSm, flex: 1, minWidth: 120 }} type="password" placeholder="password"
                    value={ts.password} onChange={e => setTestStates(t => ({ ...t, [s.id]: { ...t[s.id], password: e.target.value } }))} />
                  <button style={btnSmall} disabled={!ts.email || !ts.password || ts.result === 'testing'} onClick={() => testServer(s)}>
                    {ts.result === 'testing' ? 'Testing…' : 'Test'}
                  </button>
                  {ts.result && ts.result !== 'testing' && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: ts.result.ok ? 'var(--success)' : 'var(--error)' }}>
                      {ts.result.ok ? '✓ Connected' : `✗ ${ts.result.message}`}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {(showAdd || editTarget) && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 460 }}>
            <h2 style={modalTitle}>{editTarget ? `Edit: ${editTarget.name}` : 'Add IMAP Server'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Server Name</label>
                  <input style={input} placeholder="e.g. Zoho Mail" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>IMAP Host</label>
                  <input style={input} placeholder="imap.zoho.com" value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Port</label>
                  <input style={input} type="number" value={form.port} onChange={e => setForm(f => ({ ...f, port: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="ssl" checked={form.useSsl} onChange={e => setForm(f => ({ ...f, useSsl: e.target.checked }))} />
                  <label htmlFor="ssl" style={{ ...labelStyle, marginBottom: 0, cursor: 'pointer' }}>Use SSL/TLS</label>
                </div>
              </div>
              {formError && <p style={{ color: 'var(--error)', fontSize: 13 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => { setShowAdd(false); setEditTarget(null) }}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: canSave ? 1 : 0.5 }} disabled={saveMutation.isPending || !canSave} onClick={() => saveMutation.mutate(editTarget)}>
                  {saveMutation.isPending ? 'Saving…' : 'Save Server'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 380 }}>
            <h2 style={modalTitle}>Delete Server</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Delete <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong>? Jobs using this server will lose their server reference.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button style={{ ...btnPrimary, background: 'var(--error)' }} disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Job Log Viewer ────────────────────────────────────────────────────────

function JobLog({ jobId, initialStatus }: { jobId: number; initialStatus: string }) {
  const [log, setLog] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [offset, setOffset] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const live = status === 'running' || status === 'queued'

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        const res = await api.get(`/migration/jobs/${jobId}/tail?offset=${offset}`)
        const { chunk, newOffset, status: s } = res.data
        if (chunk) { setLog(l => l + chunk); setOffset(newOffset) }
        setStatus(s)
        if (s === 'running' || s === 'queued') timer = setTimeout(poll, 1500)
      } catch { /* ignore */ }
    }
    poll()
    return () => clearTimeout(timer)
  }, [jobId, live])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [log])

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[status] ?? 'var(--muted)', textTransform: 'uppercase' }}>{status}</span>
        {live && <span className="live-indicator" style={{ fontSize: 11, color: '#22c55e', fontWeight: 600 }}>● live</span>}
      </div>
      <pre style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 12, color: 'var(--text)', overflowX: 'auto', maxHeight: 400, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
        {log || '(waiting for output…)'}
        <div ref={bottomRef} />
      </pre>
    </div>
  )
}

// ── Jobs Tab ──────────────────────────────────────────────────────────────

function JobsTab() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [viewJob, setViewJob] = useState<Job | null>(null)
  const [cancelTarget, setCancelTarget] = useState<Job | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null)
  const [editTarget, setEditTarget] = useState<Job | null>(null)
  const [editForm, setEditForm] = useState({ sourceEmail: '', sourcePassword: '', destEmail: '', destPassword: '' })
  const [editError, setEditError] = useState('')
  const [form, setForm] = useState({ name: '', sourceServerId: '', sourceEmail: '', sourcePassword: '', destServerId: '', destEmail: '', destPassword: '', dryRun: false })
  const [formError, setFormError] = useState('')
  const [batchFilter, setBatchFilter] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkError, setBulkError] = useState('')

  // CSV bulk upload state
  const [bulkBatch, setBulkBatch] = useState('')
  const [bulkSourceServerId, setBulkSourceServerId] = useState('')
  const [bulkDestServerId, setBulkDestServerId] = useState('')
  const [bulkRows, setBulkRows] = useState<{ sourceEmail: string; sourcePassword: string; destEmail: string; destPassword: string }[]>([])
  const [bulkError2, setBulkError2] = useState('')

  const { data: jobsData, refetch: refetchJobs } = useQuery({
    queryKey: ['migration-jobs'],
    queryFn: () => api.get('/migration/jobs').then(r => r.data.jobs as Job[]),
    refetchInterval: 5000,
  })
  const { data: serversData } = useQuery({ queryKey: ['migration-servers'], queryFn: () => api.get('/migration/servers').then(r => r.data.servers as Server[]) })
  const { data: usersData } = useQuery({ queryKey: ['pm-users'], queryFn: () => api.get('/pm/users').then(r => r.data.users as string[]) })

  const allJobs = jobsData ?? []
  const servers = serversData ?? []
  const users = usersData ?? []

  const batches = Array.from(new Set(allJobs.map(j => j.batch).filter(Boolean))) as string[]
  const jobs = batchFilter ? allJobs.filter(j => j.batch === batchFilter) : allJobs

  const visibleIds = new Set(jobs.map(j => j.id))
  const allSelected = jobs.length > 0 && jobs.every(j => selected.has(j.id))

  function toggleAll() {
    if (allSelected) setSelected(s => { const n = new Set(s); jobs.forEach(j => n.delete(j.id)); return n })
    else setSelected(s => { const n = new Set(s); jobs.forEach(j => n.add(j.id)); return n })
  }
  function toggleOne(id: number) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  const selectedIds = [...selected].filter(id => visibleIds.has(id))

  const createMutation = useMutation({
    mutationFn: () => api.post('/migration/jobs', {
      name: form.name, sourceServerId: parseInt(form.sourceServerId), sourceEmail: form.sourceEmail, sourcePassword: form.sourcePassword,
      destServerId: parseInt(form.destServerId), destEmail: form.destEmail, destPassword: form.destPassword, dryRun: form.dryRun,
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['migration-jobs'] })
      setShowAdd(false); setFormError('')
      refetchJobs().then(r => {
        const newJob = (r.data as any)?.jobs?.find((j: Job) => j.id === res.data.jobId)
        if (newJob) setViewJob(newJob)
      })
    },
    onError: (e: any) => setFormError(e.response?.data?.error ?? 'Failed'),
  })

  const bulkCreateMutation = useMutation({
    mutationFn: () => api.post('/migration/jobs/bulk', {
      batch: bulkBatch,
      dryRun: true,
      jobs: bulkRows.map(r => ({ sourceServerId: parseInt(bulkSourceServerId), destServerId: parseInt(bulkDestServerId), ...r })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['migration-jobs'] })
      setBatchFilter(bulkBatch)
      setShowBulk(false); setBulkError2('')
    },
    onError: (e: any) => setBulkError2(e.response?.data?.error ?? 'Failed'),
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/migration/jobs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['migration-jobs'] }); setCancelTarget(null) },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/migration/jobs/${id}?hard=true`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['migration-jobs'] }); setDeleteTarget(null) },
  })

  const editMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/migration/jobs/${id}`, {
      sourceEmail: editForm.sourceEmail || undefined,
      sourcePassword: editForm.sourcePassword || undefined,
      destEmail: editForm.destEmail || undefined,
      destPassword: editForm.destPassword || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['migration-jobs'] }); setEditTarget(null); setEditError('') },
    onError: (e: any) => setEditError(e.response?.data?.error ?? 'Failed to update job'),
  })

  const rerunMutation = useMutation({
    mutationFn: ({ id, dryRun }: { id: number; dryRun?: boolean }) => api.post(`/migration/jobs/${id}/rerun`, { dryRun }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['migration-jobs'] })
      refetchJobs().then(r => {
        const newJob = (r.data as any)?.jobs?.find((j: Job) => j.id === res.data.jobId)
        if (newJob) setViewJob(newJob)
      })
    },
  })

  const bulkRerunMutation = useMutation({
    mutationFn: ({ ids, dryRun }: { ids: number[]; dryRun: boolean }) => api.post('/migration/jobs/bulk-rerun', { ids, dryRun }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['migration-jobs'] }); setSelected(new Set()); setBulkError('') },
    onError: (e: any) => setBulkError(e.response?.data?.error ?? 'Bulk action failed'),
  })

  const canCreate = form.name && form.sourceServerId && form.sourceEmail && form.sourcePassword && form.destServerId && form.destEmail && form.destPassword
  const canBulkCreate = bulkBatch && bulkSourceServerId && bulkDestServerId && bulkRows.length > 0

  function duration(job: Job) {
    if (!job.started_at) return null
    const end = job.finished_at ? new Date(job.finished_at) : new Date()
    const secs = Math.floor((end.getTime() - new Date(job.started_at).getTime()) / 1000)
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
  }

  function downloadTemplate() {
    const csv = 'source_email,source_password,dest_email,dest_password\nuser@zoho.com,password123,user@purelymail.com,password456\n'
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    a.download = 'migration_template.csv'
    a.click()
  }

  function parseCSV(text: string) {
    const lines = text.trim().split('\n').slice(1)
    return lines.map(line => {
      const [sourceEmail, sourcePassword, destEmail, destPassword] = line.split(',').map(s => s.trim())
      return { sourceEmail, sourcePassword, destEmail, destPassword }
    }).filter(r => r.sourceEmail && r.sourcePassword && r.destEmail && r.destPassword)
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string)
      setBulkRows(rows)
    }
    reader.readAsText(file)
  }

  return (
    <>
      {/* Toolbar */}
      <div className="responsive-toolbar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>Each job migrates one mailbox.</p>
          {batches.length > 0 && (
            <select style={{ ...inputSm, minWidth: 160 }} value={batchFilter} onChange={e => { setBatchFilter(e.target.value); setSelected(new Set()) }}>
              <option value="">All batches</option>
              {batches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btnSecondary} onClick={downloadTemplate}>↓ CSV Template</button>
          <button style={btnSecondary} disabled={servers.length < 2} onClick={() => { setBulkBatch(''); setBulkSourceServerId(''); setBulkDestServerId(''); setBulkRows([]); setBulkError2(''); setShowBulk(true) }}>Bulk Import</button>
          <button style={btnPrimary} disabled={servers.length < 2} onClick={() => { setForm({ name: '', sourceServerId: '', sourceEmail: '', sourcePassword: '', destServerId: '', destEmail: '', destPassword: '', dryRun: false }); setFormError(''); setShowAdd(true) }}>+ New Job</button>
        </div>
      </div>

      {servers.length < 2 && <p style={{ color: 'var(--warning)', fontSize: 13, marginBottom: 16 }}>Add at least 2 servers (source + destination) before creating a job.</p>}

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{selectedIds.length} selected</span>
          <button style={{ ...btnSmall, color: 'var(--warning)', borderColor: 'var(--warning)' }} disabled={bulkRerunMutation.isPending} onClick={() => bulkRerunMutation.mutate({ ids: selectedIds, dryRun: true })}>Dry Run</button>
          <button style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }} disabled={bulkRerunMutation.isPending} onClick={() => bulkRerunMutation.mutate({ ids: selectedIds, dryRun: false })}>Run Real</button>
          <button style={{ ...btnSmall, color: 'var(--error)', borderColor: 'var(--error)' }} disabled={bulkRerunMutation.isPending} onClick={() => selectedIds.forEach(id => cancelMutation.mutate(id))}>Cancel All</button>
          <button style={{ ...btnSmall, color: 'var(--error)', borderColor: 'var(--error)' }} disabled={bulkRerunMutation.isPending} onClick={() => { if (confirm(`Delete ${selectedIds.length} jobs? This cannot be undone.`)) { selectedIds.forEach(id => deleteMutation.mutate(id)); setSelected(new Set()) } }}>Delete All</button>
          {bulkError && <span style={{ fontSize: 12, color: 'var(--error)' }}>{bulkError}</span>}
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 18 }} onClick={() => setSelected(new Set())}>×</button>
        </div>
      )}

      {jobs.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No jobs yet.</p>
      ) : (
        <div className="responsive-table-wrap">
          <table style={table}>
            <thead>
              <tr>
                <th style={{ ...th, width: 36 }}><input type="checkbox" checked={allSelected} onChange={toggleAll} /></th>
                <th style={th}>Job</th>
                <th style={th}>Source</th>
                <th style={th}>Destination</th>
                <th style={th}>Status</th>
                <th style={th}>Duration</th>
                <th style={{ ...th, width: 180 }}></th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => (
                <tr key={j.id}>
                  <td style={{ ...td, textAlign: 'center' }}><input type="checkbox" checked={selected.has(j.id)} onChange={() => toggleOne(j.id)} /></td>
                  <td style={td}>
                    <strong style={{ color: 'var(--text)' }}>{j.name}</strong>
                    {j.dry_run && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3, padding: '1px 5px' }}>DRY RUN</span>}
                    {j.batch && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{j.batch}</div>}
                  </td>
                  <td style={td}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{j.source_server_name}</span><br /><code style={codeStyle}>{j.source_email}</code></td>
                  <td style={td}><span style={{ fontSize: 12, color: 'var(--muted)' }}>{j.dest_server_name}</span><br /><code style={codeStyle}>{j.dest_email}</code></td>
                  <td style={td}><span style={{ fontWeight: 600, fontSize: 13, color: STATUS_COLOR[j.status] ?? 'var(--muted)', textTransform: 'capitalize' }}>{j.status}</span></td>
                  <td style={td}><span style={{ fontSize: 13, color: 'var(--muted)' }}>{duration(j) ?? '-'}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button style={btnSmall} onClick={() => setViewJob(j)}>Log</button>
                      {j.status !== 'running' && (
                        <button style={btnSmall} onClick={() => { setEditTarget(j); setEditForm({ sourceEmail: j.source_email, sourcePassword: '', destEmail: j.dest_email, destPassword: '' }); setEditError('') }}>Edit</button>
                      )}
                      {(j.status === 'queued' || j.status === 'running') && (
                        <button style={btnDanger} onClick={() => setCancelTarget(j)}>Cancel</button>
                      )}
                      {(j.status === 'failed' || j.status === 'interrupted' || j.status === 'cancelled') && (
                        <button style={btnSmall} disabled={rerunMutation.isPending} onClick={() => rerunMutation.mutate({ id: j.id })}>Re-run</button>
                      )}
                      {j.status === 'done' && j.dry_run && (
                        <button style={{ ...btnSmall, color: 'var(--success)', borderColor: 'var(--success)' }} disabled={rerunMutation.isPending} onClick={() => rerunMutation.mutate({ id: j.id, dryRun: false })}>Run Real</button>
                      )}
                      {j.status !== 'running' && j.status !== 'queued' && (
                        <button style={btnDanger} onClick={() => setDeleteTarget(j)}>Delete</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Import Modal */}
      {showBulk && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 520 }}>
            <h2 style={modalTitle}>Bulk Import</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Batch Name</label>
                <input style={input} placeholder="e.g. mig-6-may-2026" value={bulkBatch} onChange={e => setBulkBatch(e.target.value)} />
              </div>
              <div className="responsive-grid-form">
                <div>
                  <label style={labelStyle}>Source Server</label>
                  <select style={input} value={bulkSourceServerId} onChange={e => setBulkSourceServerId(e.target.value)}>
                    <option value="">Pick…</option>
                    {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Destination Server</label>
                  <select style={input} value={bulkDestServerId} onChange={e => setBulkDestServerId(e.target.value)}>
                    <option value="">Pick…</option>
                    {servers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>CSV File <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(source_email, source_password, dest_email, dest_password)</span></label>
                <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ color: 'var(--text)', fontSize: 13 }} />
                {bulkRows.length > 0 && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 8 }}>✓ {bulkRows.length} rows loaded</p>}
              </div>
              {bulkError2 && <p style={{ color: 'var(--error)', fontSize: 13 }}>{bulkError2}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setShowBulk(false)}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: canBulkCreate ? 1 : 0.5 }} disabled={bulkCreateMutation.isPending || !canBulkCreate} onClick={() => bulkCreateMutation.mutate()}>
                  {bulkCreateMutation.isPending ? 'Creating…' : `Create ${bulkRows.length} Jobs (Dry Run)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Single Job Modal */}
      {showAdd && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 540 }}>
            <h2 style={modalTitle}>New Migration Job</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Job Name</label>
                <input style={input} placeholder="e.g. john@zoho → john@purelymail" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="responsive-grid-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Source</p>
                  <div><label style={labelStyle}>Server</label>
                    <select style={input} value={form.sourceServerId} onChange={e => setForm(f => ({ ...f, sourceServerId: e.target.value }))}>
                      <option value="">Pick server…</option>
                      {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>Email</label>
                    <EmailInput placeholder="user@zoho.com" value={form.sourceEmail} onChange={v => setForm(f => ({ ...f, sourceEmail: v }))} suggestions={users} />
                  </div>
                  <div><label style={labelStyle}>Password</label>
                    <input style={input} type="password" value={form.sourcePassword} onChange={e => setForm(f => ({ ...f, sourcePassword: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Destination</p>
                  <div><label style={labelStyle}>Server</label>
                    <select style={input} value={form.destServerId} onChange={e => setForm(f => ({ ...f, destServerId: e.target.value }))}>
                      <option value="">Pick server…</option>
                      {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
                    </select>
                  </div>
                  <div><label style={labelStyle}>Email</label>
                    <EmailInput placeholder="user@purelymail.com" value={form.destEmail} onChange={v => setForm(f => ({ ...f, destEmail: v }))} suggestions={users} />
                  </div>
                  <div><label style={labelStyle}>Password</label>
                    <input style={input} type="password" value={form.destPassword} onChange={e => setForm(f => ({ ...f, destPassword: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(245,158,11,0.07)', borderRadius: 7, border: '1px solid rgba(245,158,11,0.2)' }}>
                <input type="checkbox" id="dryrun" checked={form.dryRun} onChange={e => setForm(f => ({ ...f, dryRun: e.target.checked }))} />
                <label htmlFor="dryrun" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}><strong>Dry run</strong> - simulate only, no emails copied</label>
              </div>
              {formError && <p style={{ color: 'var(--error)', fontSize: 13 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setShowAdd(false)}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: canCreate ? 1 : 0.5 }} disabled={createMutation.isPending || !canCreate} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? 'Starting…' : 'Start Migration'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewJob && (
        <div style={overlay}>
          <div className="responsive-modal responsive-modal-wide" style={{ ...modal, maxWidth: 700, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h2 style={modalTitle}>{viewJob.name}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  style={{ ...btnSecondary, fontSize: 12, padding: '4px 10px' }}
                  onClick={async () => {
                    const res = await api.get(`/migration/jobs/${viewJob.id}/log/download`, { responseType: 'blob' })
                    const url = URL.createObjectURL(res.data)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `job-${viewJob.id}-${viewJob.name.replace(/[^a-z0-9]/gi, '_')}.log`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                >
                  Download log
                </button>
                <button onClick={() => setViewJob(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
            </div>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 0 }}>{viewJob.source_email} → {viewJob.dest_email}</p>
            <JobLog jobId={viewJob.id} initialStatus={viewJob.status} />
          </div>
        </div>
      )}

      {editTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 500 }}>
            <h2 style={modalTitle}>Edit Job: {editTarget.name}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="responsive-grid-form">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Source</p>
                  <div><label style={labelStyle}>Email</label>
                    <EmailInput value={editForm.sourceEmail} onChange={v => setEditForm(f => ({ ...f, sourceEmail: v }))} suggestions={users} />
                  </div>
                  <div><label style={labelStyle}>Password</label>
                    <input style={input} type="password" placeholder="••••••••  (unchanged)" value={editForm.sourcePassword} onChange={e => setEditForm(f => ({ ...f, sourcePassword: e.target.value }))} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Destination</p>
                  <div><label style={labelStyle}>Email</label>
                    <EmailInput value={editForm.destEmail} onChange={v => setEditForm(f => ({ ...f, destEmail: v }))} suggestions={users} />
                  </div>
                  <div><label style={labelStyle}>Password</label>
                    <input style={input} type="password" placeholder="••••••••  (unchanged)" value={editForm.destPassword} onChange={e => setEditForm(f => ({ ...f, destPassword: e.target.value }))} />
                  </div>
                </div>
              </div>
              {editError && <p style={{ color: 'var(--error)', fontSize: 13 }}>{editError}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setEditTarget(null)}>Cancel</button>
                <button style={btnPrimary} disabled={editMutation.isPending} onClick={() => editMutation.mutate(editTarget.id)}>
                  {editMutation.isPending ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 380 }}>
            <h2 style={modalTitle}>Cancel Job</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Cancel <strong style={{ color: 'var(--text)' }}>{cancelTarget.name}</strong>? Any progress will be lost.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setCancelTarget(null)}>Keep running</button>
              <button style={{ ...btnPrimary, background: 'var(--error)' }} disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(cancelTarget.id)}>
                {cancelMutation.isPending ? 'Cancelling…' : 'Cancel Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 380 }}>
            <h2 style={modalTitle}>Delete Job</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>Permanently delete <strong style={{ color: 'var(--text)' }}>{deleteTarget.name}</strong>? This cannot be undone.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button style={{ ...btnPrimary, background: 'var(--error)' }} disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)}>
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Mapping View ──────────────────────────────────────────────────────────

type MappingRow = { destEmail: string; destPassword: string; passwordSource: 'user' | 'generated' | 'admin' }
type AnimState = { chars: string[]; locked: boolean[]; masked: boolean[]; final: string }
type SubmitResult = { jobIds: number[]; created: { email: string; password: string }[] }

function DestBadge({ email, pmUsers }: { email: string; pmUsers: string[] }) {
  if (!email.trim()) return null
  const exists = pmUsers.includes(email.trim())
  return exists
    ? <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.12)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 3, padding: '2px 6px', marginLeft: 6 }}>exists</span>
    : <span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(34,197,94,0.1)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 3, padding: '2px 6px', marginLeft: 6 }}>will be created</span>
}

function MappingView({ campaign, credentials, servers, pmUsers, copiedToken, gatherUrl, copyUrl, isExpired, onBack }: {
  campaign: Campaign
  credentials: Credential[]
  servers: Server[]
  pmUsers: string[]
  copiedToken: string | null
  gatherUrl: (t: string) => string
  copyUrl: (t: string) => void
  isExpired: (c: Campaign) => boolean
  onBack: () => void
}) {
  const qc = useQueryClient()
  const [destServerId, setDestServerId] = useState('')
  const [rows, setRows] = useState<Record<number, MappingRow>>(() => {
    const init: Record<number, MappingRow> = {}
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({})
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState<SubmitResult | null>(null)
  const [showPasswords, setShowPasswords] = useState<Record<number, boolean>>({})
  const [animating, setAnimating] = useState<Record<number, AnimState | null>>({})
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ name: '', sourceEmail: '', sourcePassword: '', showPw: false, destEmail: '', destPassword: '', showDestPw: false })
  const [addError, setAddError] = useState('')
  const [adding, setAdding] = useState(false)

  // Initialize rows from credentials (pre-fill dest email + user-submitted password if available)
  useEffect(() => {
    setRows(prev => {
      const next = { ...prev }
      credentials.forEach(c => {
        if (!next[c.id]) {
          next[c.id] = {
            destEmail: c.dest_email ?? '',
            destPassword: c.dest_password ?? '',
            passwordSource: c.dest_password ? 'user' : 'admin',
          }
        }
      })
      return next
    })
  }, [credentials])

  function setRow(id: number, field: keyof MappingRow, value: string) {
    setRows(r => ({
      ...r,
      [id]: { ...r[id], [field]: value, ...(field === 'destPassword' ? { passwordSource: 'admin' as const } : {}) },
    }))
    setRowErrors(e => { const n = { ...e }; delete n[id]; return n })
  }

  function genPassword(id: number) {
    const SCRAMBLE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
    const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
    const len = 16
    const finalPw = Array.from({ length: len }, () => CHARSET[Math.floor(Math.random() * CHARSET.length)]).join('')
    const rnd = () => SCRAMBLE[Math.floor(Math.random() * SCRAMBLE.length)]

    setAnimating(a => ({
      ...a,
      [id]: { chars: Array.from({ length: len }, rnd), locked: Array(len).fill(false), masked: Array(len).fill(false), final: finalPw },
    }))

    // Scramble phase: every 40ms for 250ms
    const scrambleInt = setInterval(() => {
      setAnimating(a => {
        const s = a[id]; if (!s) return a
        return { ...a, [id]: { ...s, chars: s.chars.map((ch, i) => s.locked[i] ? ch : rnd()) } }
      })
    }, 40)

    setTimeout(() => {
      clearInterval(scrambleInt)
      // Lock + mask each char sequentially
      for (let i = 0; i < len; i++) {
        setTimeout(() => {
          setAnimating(a => {
            const s = a[id]; if (!s) return a
            const chars = [...s.chars]; chars[i] = s.final[i]
            const locked = [...s.locked]; locked[i] = true
            return { ...a, [id]: { ...s, chars, locked } }
          })
        }, i * 100)
        setTimeout(() => {
          setAnimating(a => {
            const s = a[id]; if (!s) return a
            const masked = [...s.masked]; masked[i] = true
            return { ...a, [id]: { ...s, masked } }
          })
        }, i * 100 + 80)
      }
      // Done: commit password, clear animation
      setTimeout(() => {
        setRows(r => ({ ...r, [id]: { ...r[id], destPassword: finalPw, passwordSource: 'generated' } }))
        setAnimating(a => { const n = { ...a }; delete n[id]; return n })
        setRowErrors(e => { const n = { ...e }; delete n[id]; return n })
      }, len * 100 + 150)
    }, 250)
  }

  async function handleAddManual(e: React.FormEvent) {
    e.preventDefault()
    setAddError('')
    setAdding(true)
    try {
      await api.post(`/migration/campaigns/${campaign.id}/credentials`, {
        name: addForm.name.trim(),
        sourceEmail: addForm.sourceEmail.trim(),
        sourcePassword: addForm.sourcePassword,
        destEmail: addForm.destEmail.trim() || undefined,
        destPassword: addForm.destPassword.trim() || undefined,
      })
      qc.invalidateQueries({ queryKey: ['gather-credentials', campaign.id] })
      setAddForm({ name: '', sourceEmail: '', sourcePassword: '', showPw: false, destEmail: '', destPassword: '', showDestPw: false })
      setShowAddForm(false)
    } catch (err: any) {
      setAddError(err.response?.data?.error ?? 'Failed to add credential.')
    } finally {
      setAdding(false)
    }
  }

  async function handleSubmit() {
    if (!destServerId) { setSubmitError('Select a destination server first.'); return }
    setSubmitError('')
    setRowErrors({})
    setSubmitting(true)

    const mappings = credentials
      .filter(c => rows[c.id]?.destEmail?.trim())
      .map(c => ({ credentialId: c.id, destEmail: rows[c.id].destEmail.trim(), destPassword: rows[c.id].destPassword.trim() || undefined }))

    if (mappings.length === 0) { setSubmitError('Fill in at least one destination email.'); setSubmitting(false); return }

    try {
      const res = await api.post(`/migration/campaigns/${campaign.id}/submit`, { destServerId: parseInt(destServerId), mappings })
      setResult(res.data)
      qc.invalidateQueries({ queryKey: ['migration-jobs'] })
    } catch (e: any) {
      const data = e.response?.data
      if (data?.errors) {
        const errs: Record<number, string> = {}
        data.errors.forEach((err: { credentialId: number; error: string }) => { errs[err.credentialId] = err.error })
        setRowErrors(errs)
      } else {
        setSubmitError(data?.error ?? 'Submission failed')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (result) {
    return (
      <>
        <button style={{ ...btnSecondary, marginBottom: 20 }} onClick={onBack}>← Back to campaigns</button>
        <div style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
          <p style={{ color: '#22c55e', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>✓ {result.jobIds.length} migration job{result.jobIds.length !== 1 ? 's' : ''} created</p>
          {result.created.length > 0 && (
            <>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10 }}>New accounts created - share these passwords with your users:</p>
              <table style={{ ...table, marginBottom: 0 }}>
                <thead><tr><th style={th}>Email</th><th style={th}>Password</th></tr></thead>
                <tbody>
                  {result.created.map(u => (
                    <tr key={u.email}>
                      <td style={td}><code style={codeStyle}>{u.email}</code></td>
                      <td style={td}><code style={codeStyle}>{u.password}</code></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Go to the <strong>Jobs</strong> tab to monitor progress.</p>
      </>
    )
  }

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <button style={btnSecondary} onClick={onBack}>← Back</button>
        <div>
          <strong style={{ color: 'var(--text)', fontSize: 15 }}>{campaign.name || campaign.server_name}</strong>
          <span style={{ marginLeft: 10, ...badgeStyle(campaign.active && !isExpired(campaign)) }}>
            {campaign.active && !isExpired(campaign) ? 'active' : 'closed'}
          </span>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
            Source: {campaign.server_name} · Expires {new Date(campaign.expires_at).toLocaleDateString()} · {campaign.credential_count} submissions
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <code style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--bg)', padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', wordBreak: 'break-all' }}>
            {gatherUrl(campaign.token)}
          </code>
          <button style={btnSmall} onClick={() => copyUrl(campaign.token)}>
            {copiedToken === campaign.token ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {credentials.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No submissions yet.</p>
      ) : (
        <>
          {/* Bulk controls */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={labelStyle}>Destination IMAP Server (applies to all rows)</label>
              <select style={input} value={destServerId} onChange={e => setDestServerId(e.target.value)}>
                <option value="">Pick server…</option>
                {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ ...labelStyle, visibility: 'hidden' }}>x</label>
              <button style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }} disabled={submitting} onClick={handleSubmit}>
                {submitting ? 'Validating…' : 'Create jobs'}
              </button>
            </div>
          </div>

          {submitError && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: 'rgba(220,38,38,0.08)', borderRadius: 8 }}>{submitError}</p>}

          {/* Manual add */}
          {!showAddForm ? (
            <div style={{ marginBottom: 12 }}>
              <button style={btnSecondary} onClick={() => { setShowAddForm(true); setAddError('') }}>+ Add manually</button>
            </div>
          ) : (
            <form onSubmit={handleAddManual} style={{ marginBottom: 16, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>Add credential manually</p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <div style={{ flex: '1 1 130px' }}>
                  <label style={labelStyle}>Name</label>
                  <input style={{ ...inputSm, width: '100%', boxSizing: 'border-box' }} placeholder="Jane Smith" value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))} required autoFocus />
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={labelStyle}>Source email</label>
                  <input style={{ ...inputSm, width: '100%', boxSizing: 'border-box' }} type="email" placeholder="jane@olddomain.com" value={addForm.sourceEmail} onChange={e => setAddForm(f => ({ ...f, sourceEmail: e.target.value }))} required />
                </div>
                <div style={{ flex: '1 1 150px' }}>
                  <label style={labelStyle}>Source password</label>
                  <div style={{ position: 'relative' }}>
                    <input style={{ ...inputSm, width: '100%', boxSizing: 'border-box', paddingRight: 36 }} type={addForm.showPw ? 'text' : 'password'} placeholder="••••••••" value={addForm.sourcePassword} onChange={e => setAddForm(f => ({ ...f, sourcePassword: e.target.value }))} required />
                    <button type="button" onClick={() => setAddForm(f => ({ ...f, showPw: !f.showPw }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>{addForm.showPw ? 'hide' : 'show'}</button>
                  </div>
                </div>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={labelStyle}>Dest email <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                  <EmailInput value={addForm.destEmail} onChange={v => setAddForm(f => ({ ...f, destEmail: v, destPassword: '', showDestPw: false }))} placeholder="jane@newdomain.com" suggestions={pmUsers} />
                </div>
                {addForm.destEmail.trim() && (
                  <div style={{ flex: '1 1 150px' }}>
                    <label style={labelStyle}>Dest password <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(optional)</span></label>
                    <div style={{ position: 'relative' }}>
                      <input style={{ ...inputSm, width: '100%', boxSizing: 'border-box', paddingRight: 36 }} type={addForm.showDestPw ? 'text' : 'password'} placeholder="••••••••" value={addForm.destPassword} onChange={e => setAddForm(f => ({ ...f, destPassword: e.target.value }))} />
                      <button type="button" onClick={() => setAddForm(f => ({ ...f, showDestPw: !f.showDestPw }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>{addForm.showDestPw ? 'hide' : 'show'}</button>
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 1 }}>
                  <button type="submit" style={{ ...btnPrimary, opacity: adding ? 0.7 : 1 }} disabled={adding}>{adding ? 'Verifying…' : 'Add'}</button>
                  <button type="button" style={btnSecondary} onClick={() => { setShowAddForm(false); setAddError('') }}>Cancel</button>
                </div>
              </div>
              {addError && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 10 }}>{addError}</p>}
            </form>
          )}

          {/* Mapping table */}
          <div className="responsive-table-wrap">
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Name</th>
                  <th style={th}>Source Email</th>
                  <th style={{ ...th, minWidth: 240 }}>Destination Email</th>
                  <th style={{ ...th, minWidth: 180 }}>Destination Password</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c, idx) => {
                  const row = rows[c.id] ?? { destEmail: '', destPassword: '' }
                  const destExists = row.destEmail.trim() ? pmUsers.includes(row.destEmail.trim()) : null
                  const rowErr = rowErrors[c.id]
                  return (
                    <tr key={c.id} style={rowErr ? { background: 'rgba(220,38,38,0.04)' } : {}}>
                      <td style={td}><span style={{ color: 'var(--text)' }}>{c.name}</span></td>
                      <td style={td}><code style={codeStyle}>{c.source_email}</code></td>
                      <td style={td}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <EmailInput
                              value={row.destEmail}
                              onChange={v => setRow(c.id, 'destEmail', v)}
                              placeholder="dest@newdomain.com"
                              suggestions={pmUsers}
                            />
                            {destExists !== null && <DestBadge email={row.destEmail} pmUsers={pmUsers} />}
                          </div>
                          {rowErr && <p style={{ color: 'var(--error)', fontSize: 12, marginTop: 4 }}>{rowErr}</p>}
                        </div>
                      </td>
                      <td style={td}>
                        {(destExists === true || destExists === false) ? (
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <div style={{ position: 'relative', flex: 1 }}>
                                <input
                                  style={{ ...inputSm, width: '100%', boxSizing: 'border-box', paddingRight: 40, visibility: animating[c.id] ? 'hidden' : 'visible' }}
                                  type={showPasswords[c.id] ? 'text' : 'password'}
                                  placeholder={destExists ? 'required' : 'set account password'}
                                  value={row.destPassword}
                                  onChange={e => setRow(c.id, 'destPassword', e.target.value)}
                                  tabIndex={idx * 2 + 2}
                                />
                                {!animating[c.id] && (
                                  <button type="button"
                                    onClick={() => setShowPasswords(p => ({ ...p, [c.id]: !p[c.id] }))}
                                    style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 11 }}>
                                    {showPasswords[c.id] ? 'hide' : 'show'}
                                  </button>
                                )}
                                {animating[c.id] && (
                                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', padding: '6px 10px', fontFamily: '"Courier New", monospace', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', userSelect: 'none' }}>
                                    {animating[c.id]!.chars.map((ch, i) => {
                                      const s = animating[c.id]!
                                      return (
                                        <span key={i} style={{ color: s.masked[i] ? 'var(--primary)' : s.locked[i] ? '#22c55e' : 'var(--muted)', transition: 'color 0.08s', display: 'inline-block', width: '0.6em', textAlign: 'center' }}>
                                          {s.masked[i] ? '•' : ch}
                                        </span>
                                      )
                                    })}
                                  </div>
                                )}
                              </div>
                              {destExists === false && (
                                <button type="button" onClick={() => genPassword(c.id)} disabled={!!animating[c.id]}
                                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: animating[c.id] ? 'var(--border)' : 'var(--muted)', cursor: animating[c.id] ? 'default' : 'pointer', fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap', transition: 'color 0.2s' }}>
                                  {animating[c.id] ? 'Generating…' : 'Generate'}
                                </button>
                              )}
                            </div>
                            {!animating[c.id] && row.passwordSource === 'user' && (
                              <span style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3, display: 'block' }}>user-submitted</span>
                            )}
                            {!animating[c.id] && row.passwordSource === 'generated' && (
                              <span style={{ fontSize: 11, color: '#f59e0b', marginTop: 3, display: 'block' }}>generated</span>
                            )}
                          </div>
                        ) : <span style={{ color: 'var(--muted)', fontSize: 12 }}>-</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  )
}

// ── Campaigns Tab ─────────────────────────────────────────────────────────

type Campaign = {
  id: number; token: string; name: string; server_name: string; expires_at: string
  active: boolean; created_at: string; credential_count: number
}
type Credential = {
  id: number; name: string; source_email: string; dest_email: string | null
  dest_user_exists: boolean | null; submitted_at: string; dest_password: string | null
}

function CampaignsTab() {
  const qc = useQueryClient()
  const [view, setView] = useState<'list' | 'credentials'>('list')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<Campaign | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [newCreated, setNewCreated] = useState<{ token: string } | null>(null)
  const [form, setForm] = useState({ name: '', sourceServerId: '', days: '7' })
  const [formError, setFormError] = useState('')

  const { data: serversData } = useQuery({ queryKey: ['migration-servers'], queryFn: () => api.get('/migration/servers').then(r => r.data.servers as Server[]) })
  const servers = serversData ?? []

  const { data: pmUsersData } = useQuery({ queryKey: ['pm-users'], queryFn: () => api.get('/pm/users').then(r => r.data.users as string[]) })
  const pmUsers = pmUsersData ?? []

  const { data: campaignsData, refetch: refetchCampaigns } = useQuery({
    queryKey: ['gather-campaigns'],
    queryFn: () => api.get('/migration/campaigns').then(r => r.data.campaigns as Campaign[]),
  })
  const campaigns = campaignsData ?? []

  const { data: credsData } = useQuery({
    queryKey: ['gather-credentials', selectedCampaign?.id],
    queryFn: () => api.get(`/migration/campaigns/${selectedCampaign!.id}/credentials`).then(r => r.data.credentials as Credential[]),
    enabled: !!selectedCampaign,
    refetchInterval: view === 'credentials' ? 10000 : false,
  })
  const credentials = credsData ?? []

  const createMutation = useMutation({
    mutationFn: () => {
      const d = new Date()
      d.setDate(d.getDate() + parseInt(form.days))
      return api.post('/migration/campaigns', { name: form.name.trim(), sourceServerId: parseInt(form.sourceServerId), expiresAt: d.toISOString() })
    },
    onSuccess: (res) => {
      refetchCampaigns()
      setNewCreated({ token: res.data.campaign.token })
      setShowNew(false)
      setFormError('')
    },
    onError: (e: any) => setFormError(e.response?.data?.error ?? 'Failed'),
  })

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => api.patch(`/migration/campaigns/${id}/deactivate`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['gather-campaigns'] }); setDeactivateTarget(null) },
  })

  function gatherUrl(token: string) {
    return `${window.location.origin}/gather/${token}`
  }

  function copyUrl(token: string) {
    navigator.clipboard.writeText(gatherUrl(token))
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  function isExpired(campaign: Campaign) {
    return new Date(campaign.expires_at) < new Date()
  }

  function openCredentials(c: Campaign) {
    setSelectedCampaign(c)
    setView('credentials')
  }

if (view === 'credentials' && selectedCampaign) {
    return <MappingView
      campaign={selectedCampaign}
      credentials={credentials}
      servers={servers}
      pmUsers={pmUsers}
      copiedToken={copiedToken}
      gatherUrl={gatherUrl}
      copyUrl={copyUrl}
      isExpired={isExpired}
      onBack={() => { setView('list'); setSelectedCampaign(null) }}
    />
  }

  return (
    <>
      <div className="page-header">
        <p style={{ color: 'var(--muted)', fontSize: 13 }}>Create a short-lived form link to collect credentials from your users before migration.</p>
        <button style={btnPrimary} disabled={servers.length === 0} onClick={() => { setForm({ name: '', sourceServerId: '', days: '7' }); setFormError(''); setNewCreated(null); setShowNew(true) }}>+ New Campaign</button>
      </div>

      {servers.length === 0 && <p style={{ color: 'var(--warning)', fontSize: 13, marginBottom: 16 }}>Add a source IMAP server first before creating a campaign.</p>}

      {newCreated && (
        <div style={{ marginBottom: 20, padding: '16px 20px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 10 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#22c55e', marginBottom: 10 }}>Campaign created. Share this link with your users:</p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <code style={{ fontSize: 13, color: 'var(--text)', background: 'var(--bg)', padding: '8px 12px', borderRadius: 7, border: '1px solid var(--border)', wordBreak: 'break-all' }}>
              {gatherUrl(newCreated.token)}
            </code>
            <button style={btnPrimary} onClick={() => copyUrl(newCreated.token)}>
              {copiedToken === newCreated.token ? '✓ Copied!' : 'Copy Link'}
            </button>
          </div>
        </div>
      )}

      {campaigns.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>No campaigns yet.</p>
      ) : (
        <div className="responsive-table-wrap">
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Name</th>
                <th style={th}>Source Server</th>
                <th style={th}>Created</th>
                <th style={th}>Expires</th>
                <th style={th}>Submissions</th>
                <th style={th}>Status</th>
                <th style={{ ...th, width: 200 }}></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map(c => {
                const expired = isExpired(c)
                const closed = !c.active || expired
                return (
                  <tr key={c.id}>
                    <td style={td}><strong style={{ color: 'var(--text)' }}>{c.name || '-'}</strong></td>
                    <td style={td}><span style={{ color: 'var(--muted)', fontSize: 13 }}>{c.server_name ?? '-'}</span></td>
                    <td style={td}><span style={{ fontSize: 13, color: 'var(--muted)' }}>{new Date(c.created_at).toLocaleDateString()}</span></td>
                    <td style={td}><span style={{ fontSize: 13, color: expired ? 'var(--error)' : 'var(--muted)' }}>{new Date(c.expires_at).toLocaleDateString()}</span></td>
                    <td style={td}><span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{c.credential_count}</span></td>
                    <td style={td}><span style={badgeStyle(!closed)}>{closed ? (expired ? 'expired' : 'deactivated') : 'active'}</span></td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        {!closed && (
                          <button style={btnSmall} onClick={() => copyUrl(c.token)}>
                            {copiedToken === c.token ? '✓ Copied' : 'Copy Link'}
                          </button>
                        )}
                        <button style={btnSmall} onClick={() => openCredentials(c)}>View ({c.credential_count})</button>
                        {c.active && !expired && (
                          <button style={btnDanger} onClick={() => setDeactivateTarget(c)}>Deactivate</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showNew && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 420 }}>
            <h2 style={modalTitle}>New Gather Campaign</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={labelStyle}>Campaign Name</label>
                <input style={input} placeholder="e.g. Zoho to PurelyMail - May 2026" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} autoFocus />
              </div>
              <div>
                <label style={labelStyle}>Source IMAP Server</label>
                <select style={input} value={form.sourceServerId} onChange={e => setForm(f => ({ ...f, sourceServerId: e.target.value }))}>
                  <option value="">Pick server…</option>
                  {servers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.host})</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Form valid for</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['3', '7', '14', '30'].map(d => (
                    <button key={d} type="button"
                      onClick={() => setForm(f => ({ ...f, days: d }))}
                      style={{ flex: 1, padding: '9px 0', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: `1px solid ${form.days === d ? 'var(--primary)' : 'var(--border)'}`, background: form.days === d ? 'rgba(99,102,241,0.12)' : 'var(--bg)', color: form.days === d ? 'var(--primary)' : 'var(--muted)' }}>
                      {d}d
                    </button>
                  ))}
                </div>
              </div>
              {formError && <p style={{ color: 'var(--error)', fontSize: 13 }}>{formError}</p>}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={btnSecondary} onClick={() => setShowNew(false)}>Cancel</button>
                <button style={{ ...btnPrimary, opacity: form.sourceServerId ? 1 : 0.5 }} disabled={createMutation.isPending || !form.sourceServerId} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? 'Creating…' : 'Create Campaign'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deactivateTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 380 }}>
            <h2 style={modalTitle}>Deactivate Campaign</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>The form link will stop working immediately. Credentials already collected are kept.</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => setDeactivateTarget(null)}>Cancel</button>
              <button style={{ ...btnPrimary, background: 'var(--error)' }} disabled={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(deactivateTarget.id)}>
                {deactivateMutation.isPending ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function badgeStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11, fontWeight: 700, borderRadius: 3, padding: '2px 7px',
    background: active ? 'rgba(34,197,94,0.1)' : 'rgba(156,163,175,0.15)',
    color: active ? '#22c55e' : 'var(--muted)',
    border: `1px solid ${active ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`,
  }
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function Migration() {
  const [tab, setTab] = useState<'servers' | 'jobs' | 'campaigns'>('servers')

  const TAB_LABELS: Record<string, string> = { servers: 'IMAP Servers', jobs: 'Jobs', campaigns: 'Campaigns' }

  return (
    <Layout>
      <div style={{ marginBottom: 28 }}>
        <h1 style={h1}>Migration</h1>
        <div className="responsive-tabs" style={{ marginTop: 16, borderBottom: '1px solid var(--border)' }}>
          {(['servers', 'jobs', 'campaigns'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 20px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500,
              color: tab === t ? 'var(--text)' : 'var(--muted)',
              borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: -1,
            }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>
      </div>
      {tab === 'servers' ? <ServersTab /> : tab === 'jobs' ? <JobsTab /> : <CampaignsTab />}
    </Layout>
  )
}

const h1: React.CSSProperties = { fontSize: 22, fontWeight: 600, color: 'var(--text)' }
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' }
const th: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)', background: 'var(--surface)', textTransform: 'uppercase', letterSpacing: '0.05em' }
const td: React.CSSProperties = { padding: '12px 16px', fontSize: 14, color: 'var(--text)', borderBottom: '1px solid var(--border)' }
const serverCard: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }
const codeStyle: React.CSSProperties = { fontFamily: 'monospace', fontSize: 12, color: 'var(--muted)' }
const sslBadge: React.CSSProperties = { marginLeft: 6, fontSize: 10, fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 3, padding: '1px 5px' }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, width: '100%' }
const modalTitle: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 20 }
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }
const inputSm: React.CSSProperties = { padding: '6px 10px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', fontSize: 12, outline: 'none', boxSizing: 'border-box' }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '9px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
const btnSmall: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }
const btnDanger: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
