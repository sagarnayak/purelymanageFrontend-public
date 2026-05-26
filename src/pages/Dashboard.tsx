import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../lib/api'
import Layout from '../components/Layout'

export default function Dashboard() {
  const navigate = useNavigate()

  const { data, isLoading } = useQuery({
    queryKey: ['account'],
    queryFn: () => api.get('/pm/account').then(r => r.data),
    refetchInterval: 60_000,
  })

  const { data: pendingData } = useQuery({
    queryKey: ['pending-deletions'],
    queryFn: () => api.get('/pending-deletions').then(r => r.data),
    refetchInterval: 60_000,
  })

  const pendingItems: any[] = (pendingData?.deletions ?? []).filter((d: any) => d.status === 'pending')
  const pendingByType = {
    user: pendingItems.filter(d => d.resource_type === 'user').length,
    domain: pendingItems.filter(d => d.resource_type === 'domain').length,
    routing_rule: pendingItems.filter(d => d.resource_type === 'routing_rule').length,
  }

  const credit = data?.credit != null ? parseFloat(data.credit) : null
  const creditColor = credit == null ? 'var(--text)' : credit < 2 ? 'var(--error)' : credit < 5 ? 'var(--warning)' : 'var(--success)'

  const lastSync = data?.lastSync ? new Date(data.lastSync) : null
  const syncAgo = lastSync ? formatAgo(lastSync) : null

  const dnsHealth: { passing: number; total: number } = data?.dnsHealth ?? { passing: 0, total: 0 }
  const dnsAllGood = dnsHealth.passing === dnsHealth.total && dnsHealth.total > 0
  const dnsColor = dnsAllGood ? 'var(--success)' : dnsHealth.passing === 0 ? 'var(--error)' : 'var(--warning)'

  const usersPerDomain: { domain: string; count: number }[] = data?.usersPerDomain ?? []

  return (
    <Layout>
      <h1 style={h1}>Dashboard</h1>

      {/* Top stat cards */}
      <div className="responsive-grid-4">
        <StatCard label="Email Users" value={isLoading ? null : data?.userCount ?? 0} onClick={() => navigate('/users')} />
        <StatCard label="Domains" value={isLoading ? null : data?.domainCount ?? 0} onClick={() => navigate('/domains')} />
        <StatCard label="Routing Rules" value={isLoading ? null : data?.routingCount ?? 0} onClick={() => navigate('/routing')} />
        <StatCard
          label="Account Credit"
          value={isLoading ? null : credit != null ? `$${credit.toFixed(2)}` : '-'}
          valueColor={creditColor}
          note={credit != null && credit < 2 ? 'Low - top up soon' : undefined}
          noteColor="var(--error)"
        />
      </div>

      <div className="responsive-grid-2">
        {/* Users per domain */}
        <div style={panel}>
          <div style={panelHeader}>
            <span style={panelTitle}>Users by Domain</span>
            {syncAgo && <span style={{ fontSize: 12, color: 'var(--muted)' }}>synced {syncAgo}</span>}
          </div>
          {isLoading ? (
            <p style={muted}>Loading…</p>
          ) : usersPerDomain.length === 0 ? (
            <p style={muted}>No users yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {usersPerDomain.map(({ domain, count }) => {
                const pct = data?.userCount > 0 ? (count / data.userCount) * 100 : 0
                return (
                  <div key={domain}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{domain}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{count} {count === 1 ? 'user' : 'users'}</span>
                    </div>
                    <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', borderRadius: 3, transition: 'width 0.4s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* DNS health */}
        <div style={panel}>
          <div style={panelHeader}>
            <span style={panelTitle}>DNS Health</span>
            <button
              style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
              onClick={() => navigate('/domains')}
            >
              View →
            </button>
          </div>
          {isLoading ? (
            <p style={muted}>Loading…</p>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 36, fontWeight: 700, color: dnsColor, lineHeight: 1 }}>
                  {dnsHealth.passing}/{dnsHealth.total}
                </span>
                <span style={{ fontSize: 14, color: 'var(--muted)', paddingBottom: 4 }}>
                  {dnsAllGood ? 'all configured' : 'domains fully configured'}
                </span>
              </div>
              {!dnsAllGood && dnsHealth.total > 0 && (
                <p style={{ fontSize: 13, color: 'var(--warning)', margin: 0 }}>
                  {dnsHealth.total - dnsHealth.passing} domain{dnsHealth.total - dnsHealth.passing > 1 ? 's' : ''} missing DNS records - check Domains page.
                </p>
              )}
              {dnsAllGood && (
                <p style={{ fontSize: 13, color: 'var(--success)', margin: 0 }}>All domains have MX, SPF, DKIM and DMARC set up correctly.</p>
              )}
            </>
          )}
        </div>
      </div>

      {pendingItems.length > 0 && (
        <div style={{
          marginTop: 24,
          background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 10,
          padding: '18px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--error)', marginBottom: 6 }}>
              {pendingItems.length} pending deletion{pendingItems.length > 1 ? 's' : ''}
            </p>
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>
              {[
                pendingByType.user > 0 && `${pendingByType.user} email user${pendingByType.user > 1 ? 's' : ''}`,
                pendingByType.domain > 0 && `${pendingByType.domain} domain${pendingByType.domain > 1 ? 's' : ''}`,
                pendingByType.routing_rule > 0 && `${pendingByType.routing_rule} routing rule${pendingByType.routing_rule > 1 ? 's' : ''}`,
              ].filter(Boolean).join(' · ')}
              {' - will be permanently deleted within 24 hours.'}
            </p>
          </div>
          <button
            style={{ fontSize: 13, color: 'var(--error)', background: 'none', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 7, padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}
            onClick={() => navigate('/settings', { state: { tab: 'pending' } })}
          >
            Review in Settings →
          </button>
        </div>
      )}
    </Layout>
  )
}

function StatCard({ label, value, valueColor, note, noteColor, onClick }: {
  label: string
  value: string | number | null
  valueColor?: string
  note?: string
  noteColor?: string
  onClick?: () => void
}) {
  return (
    <div
      style={{ ...card, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--primary)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLElement).style.borderColor = 'var(--border)')}
    >
      <p style={cardLabel}>{label}</p>
      <p style={{ ...cardValue, color: valueColor ?? 'var(--text)' }}>{value ?? '-'}</p>
      {note && <p style={{ fontSize: 12, color: noteColor ?? 'var(--muted)', marginTop: 6 }}>{note}</p>}
    </div>
  )
}

function formatAgo(date: Date): string {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const h1: React.CSSProperties = { fontSize: 22, fontWeight: 600, color: 'var(--text)', marginBottom: 28 }
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24, transition: 'border-color 0.15s' }
const cardLabel: React.CSSProperties = { fontSize: 13, color: 'var(--muted)', marginBottom: 8 }
const cardValue: React.CSSProperties = { fontSize: 28, fontWeight: 700 }
const panel: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 24 }
const panelHeader: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }
const panelTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: 'var(--text)' }
const muted: React.CSSProperties = { color: 'var(--muted)', fontSize: 13 }
