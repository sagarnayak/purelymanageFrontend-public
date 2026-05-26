import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { copyToClipboard } from '../lib/clipboard'
import Layout from '../components/Layout'

function useOwnershipToken() {
  return useQuery({
    queryKey: ['pm-config'],
    queryFn: () => api.get('/pm/config').then(r => r.data.ownershipToken as string | null),
    staleTime: Infinity,
  })
}

function DnsBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
      background: ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
      color: ok ? 'var(--success)' : 'var(--error)',
      border: `1px solid ${ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      marginRight: 4,
    }}>
      {label}
    </span>
  )
}

function DnsRecord({ type, name, value, note }: { type: string; name: string; value: string; note?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div style={{ marginBottom: 14, padding: 14, background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{type}</span>
        <button style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
          onClick={() => { copyToClipboard(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
          {copied ? 'Copied!' : 'Copy value'}
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '4px 12px', fontSize: 13 }}>
        <span style={{ color: 'var(--muted)' }}>Name</span>
        <code style={codeStyle}>{name}</code>
        <span style={{ color: 'var(--muted)' }}>Value</span>
        <code style={{ ...codeStyle, wordBreak: 'break-all' }}>{value}</code>
      </div>
      {note && <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>{note}</p>}
    </div>
  )
}

function DnsModal({ domainName, onClose }: { domainName: string; onClose: () => void }) {
  const qc = useQueryClient()
  const [rechecking, setRechecking] = useState(false)
  const [recheckError, setRecheckError] = useState('')
  const { data } = useQuery({
    queryKey: ['domain-dns', domainName],
    queryFn: () => api.get('/pm/domains').then(r => {
      const d = (r.data.domains as any[]).find(x => x.name === domainName)
      return d?.dnsSummary ?? {}
    }),
    staleTime: 0,
  })

  async function recheckDns() {
    setRechecking(true)
    setRecheckError('')
    try {
      const res = await api.post(`/pm/domains/${encodeURIComponent(domainName)}/recheck`)
      qc.setQueryData(['domain-dns', domainName], res.data.dnsSummary)
      qc.invalidateQueries({ queryKey: ['domains'] })
    } catch (e: any) {
      setRecheckError(e.response?.data?.error ?? 'Recheck failed')
    } finally {
      setRechecking(false)
    }
  }

  const dns = data ?? {}
  const allPassing = dns.passesMx && dns.passesSpf && dns.passesDkim && dns.passesDmarc

  return (
    <div style={overlay}>
      <div className="responsive-modal responsive-modal-wide" style={{ ...modal, maxWidth: 580, maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <h2 style={modalTitle}>DNS: {domainName}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <DnsBadge label="MX" ok={dns.passesMx} />
          <DnsBadge label="SPF" ok={dns.passesSpf} />
          <DnsBadge label="DKIM" ok={dns.passesDkim} />
          <DnsBadge label="DMARC" ok={dns.passesDmarc} />
          <button
            style={{ marginLeft: 'auto', fontSize: 12, color: rechecking ? 'var(--muted)' : 'var(--primary)', background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 10px', cursor: rechecking ? 'default' : 'pointer' }}
            disabled={rechecking}
            onClick={recheckDns}
          >
            {rechecking ? 'Checking…' : 'Re-check DNS'}
          </button>
        </div>

        {recheckError && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{recheckError}</p>}

        {allPassing ? (
          <p style={{ color: 'var(--success)', fontSize: 14, marginBottom: 16 }}>All DNS records are correctly configured.</p>
        ) : (
          <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>Add the following records at your DNS provider for the failing checks.</p>
        )}

        {!dns.passesMx && (
          <>
            <p style={sectionLabel}>MX Record - point mail to PurelyMail</p>
            <DnsRecord type="MX" name={domainName} value="mailserver.purelymail.com" note="Priority: 10" />
          </>
        )}

        {!dns.passesSpf && (
          <>
            <p style={sectionLabel}>SPF Record - authorize PurelyMail to send</p>
            <DnsRecord type="TXT" name={domainName} value="v=spf1 include:_spf.purelymail.com ~all" />
          </>
        )}

        {!dns.passesDkim && (
          <>
            <p style={sectionLabel}>DKIM Records - 3 CNAME records required</p>
            <DnsRecord type="CNAME" name={`purelymail1._domainkey.${domainName}`} value="key1.dkimroot.purelymail.com" />
            <DnsRecord type="CNAME" name={`purelymail2._domainkey.${domainName}`} value="key2.dkimroot.purelymail.com" />
            <DnsRecord type="CNAME" name={`purelymail3._domainkey.${domainName}`} value="key3.dkimroot.purelymail.com" />
          </>
        )}

        {!dns.passesDmarc && (
          <>
            <p style={sectionLabel}>DMARC Record - delivery policy</p>
            <DnsRecord type="CNAME" name={`_dmarc.${domainName}`} value="dmarcroot.purelymail.com" />
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button style={btnSecondary} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

function OwnershipErrorPanel({ token }: { token: string | null }) {
  const [copied, setCopied] = useState(false)
  const value = token ? `purelymail_ownership_proof=${token}` : null

  return (
    <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: 14 }}>
      <p style={{ color: 'var(--error)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>DNS ownership check failed</p>
      <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 10, lineHeight: 1.6 }}>
        Add this TXT record at your DNS provider, then try again:
      </p>
      <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '10px 12px', marginBottom: 10 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr', gap: '4px 10px', fontSize: 12, marginBottom: 8 }}>
          <span style={{ color: 'var(--muted)' }}>Type</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>TXT</span>
          <span style={{ color: 'var(--muted)' }}>Name</span><span style={{ color: 'var(--text)', fontWeight: 600 }}>@ (root)</span>
          <span style={{ color: 'var(--muted)' }}>Value</span>
          <span style={{ color: 'var(--primary)', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {value ?? 'purelymail_ownership_proof=<your-token>'}
          </span>
        </div>
        {value && (
          <button style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}
            onClick={() => { copyToClipboard(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
            {copied ? 'Copied!' : 'Copy value'}
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        Once the record propagates (may take a few minutes), try adding the domain again.
      </p>
    </div>
  )
}

export default function Domains() {
  const qc = useQueryClient()
  const [showAddModal, setShowAddModal] = useState(false)
  const [domainName, setDomainName] = useState('')
  const [error, setError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [dnsTarget, setDnsTarget] = useState<string | null>(null)
  const { data: ownershipToken } = useOwnershipToken()

  const { data, isLoading } = useQuery({
    queryKey: ['domains'],
    queryFn: () => api.get('/pm/domains').then(r => r.data),
  })

  const { data: pendingData } = useQuery({
    queryKey: ['pending-deletions'],
    queryFn: () => api.get('/pending-deletions').then(r => r.data),
    refetchInterval: 30000,
  })

  const pendingDomains = new Set(
    (pendingData?.deletions ?? [])
      .filter((d: any) => d.resource_type === 'domain' && d.status === 'pending')
      .map((d: any) => d.resource_id)
  )

  const domains: any[] = data?.domains ?? []

  const addMutation = useMutation({
    mutationFn: () => api.post('/pm/domains', { domainName }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['domains'] })
      qc.invalidateQueries({ queryKey: ['account'] })
      setShowAddModal(false)
      setDomainName('')
      setError('')
    },
    onError: (e: any) => {
      const msg = e.response?.data?.error ?? 'Failed to add domain'
      if (msg.toLowerCase().includes('ownership')) {
        setError('__ownership__')
      } else {
        setError(msg)
      }
    },
  })

  const [deleteError, setDeleteError] = useState('')

  const deleteMutation = useMutation({
    mutationFn: (name: string) => api.delete(`/pm/domains/${encodeURIComponent(name)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-deletions'] })
      setDeleteTarget(null)
      setDeleteError('')
    },
    onError: (e: any) => setDeleteError(e.response?.data?.error ?? 'Failed to schedule deletion'),
  })

  return (
    <Layout>
      <div className="page-header">
        <h1 style={h1}>Domains</h1>
        <button style={btnPrimary} onClick={() => { setDomainName(''); setError(''); setShowAddModal(true) }}>+ Add Domain</button>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : domains.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No domains yet.</p>
      ) : (
        <div className="responsive-table-wrap">
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>Domain</th>
                <th style={th}>DNS Status</th>
                <th style={{ ...th, width: 160 }}></th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d: any) => {
                const dns = d.dnsSummary ?? {}
                return (
                  <tr key={d.name}>
                    <td style={td}>{d.name}</td>
                    <td style={td}>
                      <DnsBadge label="MX" ok={dns.passesMx ?? false} />
                      <DnsBadge label="SPF" ok={dns.passesSpf ?? false} />
                      <DnsBadge label="DKIM" ok={dns.passesDkim ?? false} />
                      <DnsBadge label="DMARC" ok={dns.passesDmarc ?? false} />
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button style={btnSecondary} onClick={() => setDnsTarget(d.name)}>DNS</button>
                        {pendingDomains.has(d.name) ? (
                          <button style={btnPending} disabled title="Deletion already scheduled">Pending</button>
                        ) : (
                          <button style={btnDanger} onClick={() => setDeleteTarget(d.name)}>Delete</button>
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

      {dnsTarget && <DnsModal domainName={dnsTarget} onClose={() => setDnsTarget(null)} />}

      {showAddModal && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 420 }}>
            <h2 style={modalTitle}>Add Domain</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={label}>Domain Name</label>
                <input style={input} placeholder="example.com" value={domainName}
                  onChange={e => { setDomainName(e.target.value); setError('') }} />
              </div>
              {error && error !== '__ownership__' && <p style={{ color: 'var(--error)', fontSize: 13 }}>{error}</p>}
              {error === '__ownership__' && (
                <OwnershipErrorPanel token={ownershipToken ?? null} />
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
                <button style={btnSecondary} onClick={() => setShowAddModal(false)}>Cancel</button>
                <button style={btnPrimary} disabled={addMutation.isPending || !domainName}
                  onClick={() => addMutation.mutate()}>
                  {addMutation.isPending ? 'Adding...' : 'Add Domain'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={overlay}>
          <div className="responsive-modal" style={{ ...modal, maxWidth: 420 }}>
            <h2 style={modalTitle}>Schedule Deletion</h2>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>
              <strong style={{ color: 'var(--text)' }}>{deleteTarget}</strong> and all its users will be permanently deleted in 24 hours.
            </p>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 24 }}>
              You can cancel this under <strong style={{ color: 'var(--text)' }}>Settings → Pending Deletions</strong> before it executes.
            </p>
            {deleteError && <p style={{ color: 'var(--error)', fontSize: 13, marginBottom: 12 }}>{deleteError}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnSecondary} onClick={() => { setDeleteTarget(null); setDeleteError('') }}>Cancel</button>
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
const codeStyle: React.CSSProperties = { fontFamily: 'monospace', fontSize: 12, color: 'var(--text)' }
const sectionLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }
const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }
const modal: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 32, width: '100%', maxWidth: 520 }
const modalTitle: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }
const label: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--muted)', marginBottom: 6 }
const input: React.CSSProperties = { width: '100%', padding: '9px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 7, color: 'var(--text)', fontSize: 14, outline: 'none' }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: 'var(--primary)', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer' }
const btnSecondary: React.CSSProperties = { padding: '9px 14px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13, cursor: 'pointer' }
const btnDanger: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--error)', border: '1px solid var(--error)', borderRadius: 6, fontSize: 12, cursor: 'pointer' }
const btnPending: React.CSSProperties = { padding: '5px 12px', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12, cursor: 'not-allowed', opacity: 0.6 }
