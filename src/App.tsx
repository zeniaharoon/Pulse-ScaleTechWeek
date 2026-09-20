import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'
import type { PilotSnapshot } from './pilotData'

// ─── Palette (cream ground, navy accent) ──────────────────────────────────────
const C = {
  bg:      '#eae8e3',   // cream page ground
  surface: '#f4f1eb',   // slightly lighter cream for header / panels
  card:    '#ffffff',   // white cards
  input:   '#e4e1da',   // input / mid surface
  border:  'rgba(26,35,64,0.12)',
  borderMid: 'rgba(26,35,64,0.2)',
  navy:    '#1a2340',   // primary text + accent
  navyMid: '#2e3d80',   // secondary navy
  muted:   '#7a7468',   // subdued text
  faint:   'rgba(26,35,64,0.06)',
  low:     '#1a8c58',
  elevated:'#b86a00',
  high:    '#c02828',
  hr:      '#1a6bc4',
  temp:    '#b85a00',
  eda:     '#6b30d6',
  move:    '#1a8c84',
  accel:   '#8c6a00',
  green:   '#1a8c58',
}

// ─── Types ────────────────────────────────────────────────────────────────────
type RiskLevel = 'LOW' | 'ELEVATED' | 'HIGH'
type NavTab = 'dashboard' | 'live' | 'history' | 'log' | 'settings'
interface SignalPoint { t: string; hr: number; temp: number; eda: number; accel: number }

const PILOT_PROFILE: PilotSnapshot = {
  points: [],
  currentHr: 82,
  score: 24,
  level: 'LOW',
  eventCount: 49,
  timeSpan: 'Wearable pilot reference stream',
  latestEvents: ['Apr 22, 2022', 'Apr 21, 2022', 'Apr 12, 2022', 'Apr 3, 2022', 'Apr 2, 2022'],
  baselineHr: 76,
  source: 'Wearable Seizure Forecasting Pilot',
}

function ChartShell({ height, children }: { height: number; children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  useLayoutEffect(() => { setReady(true) }, [])
  if (!ready) return <div style={{ height }} />
  return (
    <div style={{ height, minWidth: 0, overflow: 'hidden' }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} debounce={50}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

function generateSignalHistory(points = 30): SignalPoint[] {
  const now = Date.now()
  return Array.from({ length: points }, (_, i) => {
    const label = new Date(now - (points - i) * 60_000)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const pulse = 80 + Math.sin(i * 0.34) * 3.5 + Math.sin(i * 0.11) * 1.8
    return {
      t: label,
      hr: pulse,
      temp: 0,
      eda: 0,
      accel: 0,
    }
  })
}

// ─── Nav SVG icons ────────────────────────────────────────────────────────────
function IconGear({ color }: { color: string }) {
  // 8-tooth gear: inner circle + outer tooth path
  const cx = 9, cy = 9, r1 = 2.8, r2 = 4.6, r3 = 6, teeth = 8
  const pts: string[] = []
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2 - Math.PI / 2
    const a1 = a0 + Math.PI / teeth * 0.55
    const a2 = a0 + Math.PI / teeth * 1.45
    const a3 = a0 + Math.PI / teeth * 2
    pts.push(`${cx + r2 * Math.cos(a0)},${cy + r2 * Math.sin(a0)}`)
    pts.push(`${cx + r3 * Math.cos(a1)},${cy + r3 * Math.sin(a1)}`)
    pts.push(`${cx + r3 * Math.cos(a2)},${cy + r3 * Math.sin(a2)}`)
    pts.push(`${cx + r2 * Math.cos(a3)},${cy + r2 * Math.sin(a3)}`)
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <circle cx={cx} cy={cy} r={r1} />
      <polygon points={pts.join(' ')} />
    </svg>
  )
}

function IconLive({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* Trending-up zigzag: starts low-left, dips, then rises sharply to top-right */}
      <polyline points="2,13 7,9 10,11 16,3" />
      {/* Arrowhead at top-right */}
      <polyline points="12,3 16,3 16,7" />
    </svg>
  )
}

function IconHistory({ color }: { color: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      {/* Clock circle */}
      <circle cx="9" cy="9" r="5.5" />
      {/* Clock hands */}
      <line x1="9" y1="9" x2="9" y2="5.8" />
      <line x1="9" y1="9" x2="11.5" y2="9" />
      {/* Counterclockwise arrow on the left side — Google history style */}
      <path d="M3.5 6.5 A6.5 6.5 0 0 0 3.5 11.5" strokeWidth="1.4" />
      <polyline points="3.5,6.5 1.5,5 2.5,7.5" />
    </svg>
  )
}

// ─── Logo ─────────────────────────────────────────────────────────────────────
function PulseLogo({ height = 40 }: { height?: number }) {
  return (
    <img
      src="/src/assets/logo-transparent.png"
      alt="Pulse"
      style={{ height, display: 'block', filter: 'brightness(0) invert(1)' }}
    />
  )
}

// ─── Risk components ──────────────────────────────────────────────────────────
function RiskBadge({ level }: { level: RiskLevel }) {
  const cfg = {
    LOW:      { color: C.low,      bg: 'rgba(26,140,88,0.08)',   label: 'LOW RISK',      glow: 'glow-low' },
    ELEVATED: { color: C.elevated, bg: 'rgba(184,106,0,0.08)',   label: 'ELEVATED RISK', glow: 'glow-elevated' },
    HIGH:     { color: C.high,     bg: 'rgba(192,40,40,0.08)',   label: 'HIGH RISK',     glow: 'glow-high' },
  }[level]
  return (
    <div
      className={`relative flex flex-col items-center justify-center rounded-full ${cfg.glow}`}
      style={{ width: 190, height: 190, background: cfg.bg, border: `2px solid ${cfg.color}` }}
    >
      <div className="absolute inset-0 rounded-full" style={{ border: `1px solid ${cfg.color}`, opacity: 0.25, transform: 'scale(1.12)' }} />
      <span className="font-mono text-[10px] tracking-widest mb-1" style={{ color: cfg.color, opacity: 0.7 }}>SEIZURE RISK</span>
      <span className="font-sans font-700 text-3xl tracking-tight" style={{ color: cfg.color }}>{level}</span>
      <span className="font-mono text-[10px] mt-1 tracking-wider" style={{ color: cfg.color, opacity: 0.55 }}>{cfg.label}</span>
    </div>
  )
}

function RiskMeter({ level, score }: { level: RiskLevel; score?: number }) {
  const pct   = score ?? (level === 'LOW' ? 20 : level === 'ELEVATED' ? 58 : 88)
  const color = level === 'LOW' ? C.low : level === 'ELEVATED' ? C.elevated : C.high
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] font-mono mb-1" style={{ color: C.muted }}>
        <span>LOW</span><span>ELEVATED</span><span>HIGH</span>
      </div>
      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: C.input }}>
        <div className="absolute left-0 top-0 h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${C.low}, ${color})` }} />
      </div>
      <div className="flex justify-between text-[10px] font-mono mt-1" style={{ color: C.muted }}>
        <span>0</span>
        <span style={{ color }}>Score: {pct}</span>
        <span>100</span>
      </div>
    </div>
  )
}

// ─── Signal card ──────────────────────────────────────────────────────────────
function SignalCard({ label, value, unit, color, delta, sparkData, dataKey }: {
  label: string; value: string; unit: string; color: string
  delta?: string; sparkData: SignalPoint[]; dataKey: keyof SignalPoint
}) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2"
      style={{ background: C.card, border: `1px solid ${C.border}`, minWidth: 0, overflow: 'hidden' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-600 tracking-widest uppercase" style={{ color: C.muted }}>{label}</span>
        {delta && (
          <span className="font-mono text-[10px]" style={{ color: delta.startsWith('+') ? C.high : C.low }}>{delta}</span>
        )}
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-600" style={{ color, fontFamily: 'Outfit, sans-serif' }}>{value}</span>
        <span className="text-xs mb-0.5" style={{ color: C.muted, fontFamily: 'Outfit, sans-serif' }}>{unit}</span>
      </div>
      <ChartShell height={44}>
        <AreaChart data={sparkData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.18} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey as string} stroke={color} strokeWidth={1.5}
            fill={`url(#grad-${dataKey})`} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ChartShell>
    </div>
  )
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg px-3 py-2 text-xs font-mono"
      style={{ background: C.card, border: `1px solid ${C.border}`, color: C.navy, boxShadow: '0 4px 12px rgba(26,35,64,0.12)' }}>
      <div className="mb-1" style={{ color: C.muted }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {p.value != null ? Number(p.value).toFixed(1) : '—'}
        </div>
      ))}
    </div>
  )
}

// ─── Log types ────────────────────────────────────────────────────────────────
interface LogEntry { time: string; type: 'medication' | 'sleep' | 'cycle' | 'illness'; note: string; source?: 'manual' | 'health' }

const LogIcon = {
  medication: (
    // 💊 pill — two rounded halves joined diagonally
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.2" y="3.8" width="9.6" height="4.4" rx="2.2" transform="rotate(-35 6 6)" fill="#1a2340" fillOpacity="0.15" stroke="#1a2340" strokeWidth="1.1" />
      <line x1="3.6" y1="8.4" x2="8.4" y2="3.6" stroke="#1a2340" strokeWidth="1.1" strokeOpacity="0.5" />
      <rect x="1.2" y="3.8" width="4.8" height="4.4" rx="2.2" transform="rotate(-35 6 6)" fill="#1a2340" fillOpacity="0.55" stroke="none" />
    </svg>
  ),
  sleep: (
    // 🌙 crescent moon — filled dark body with lighter inner cut
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M9.5 8A5 5 0 1 1 4 2.5 3.8 3.8 0 0 0 9.5 8z" fill="#1a2340" fillOpacity="0.85" />
    </svg>
  ),
  cycle: (
    // 🔴 menstrual cycle — filled circle with a subtle inner ring
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <circle cx="6" cy="6" r="4.5" fill="#1a2340" fillOpacity="0.8" />
      <circle cx="6" cy="6" r="2.5" fill="#1a2340" fillOpacity="0.35" />
    </svg>
  ),
  illness: (
    // 🌡️ thermometer — vertical tube with bulb at bottom
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4.8" y="1.2" width="2.4" height="6.8" rx="1.2" fill="#1a2340" fillOpacity="0.18" stroke="#1a2340" strokeWidth="1.0" />
      <rect x="5.2" y="1.6" width="1.6" height="5" rx="0.8" fill="#1a2340" fillOpacity="0.6" stroke="none" />
      <circle cx="6" cy="10" r="2" fill="#1a2340" fillOpacity="0.85" stroke="none" />
      <circle cx="6" cy="10" r="1.1" fill="#1a2340" fillOpacity="0.3" stroke="none" />
    </svg>
  ),
}

const NavyIcon = {
  ...{} as Record<string, React.ReactNode>,
  signals: (
    // ⚡ lightning bolt
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M7.5 1.5 L4 6.5 H6.5 L4.5 10.5 L9 5 H6.5 Z" fill="#1a2340" fillOpacity="0.85" stroke="#1a2340" strokeWidth="0.4" strokeLinejoin="round" />
    </svg>
  ),
  activity: (
    // 🏃 running figure — simplified silhouette
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#1a2340" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="2" r="1.2" fill="#1a2340" fillOpacity="0.8" stroke="none" />
      <path d="M7 3.5 L5.5 6 L3 7.5" strokeWidth="1.2" strokeOpacity="0.85" />
      <path d="M7 3.5 L8.5 5.5 L10 7" strokeWidth="1.2" strokeOpacity="0.85" />
      <path d="M5.5 6 L4.5 9 L3 10.5" strokeWidth="1.2" strokeOpacity="0.7" />
      <path d="M8.5 5.5 L7.5 8.5" strokeWidth="1.2" strokeOpacity="0.7" />
    </svg>
  ),
}

const LOG_TYPES: { value: LogEntry['type']; label: string; icon: React.ReactNode; color: string; placeholder: string }[] = [
  { value: 'medication', label: 'Medication', icon: LogIcon.medication, color: C.hr,       placeholder: 'e.g. Lamotrigine 200mg — taken 7:30 AM' },
  { value: 'sleep',      label: 'Sleep',      icon: LogIcon.sleep,      color: C.eda,      placeholder: 'e.g. 7h 20min — woke twice, restless' },
  { value: 'cycle',      label: 'Cycle',      icon: LogIcon.cycle,      color: C.high,     placeholder: 'e.g. Day 1 of period, cramping' },
  { value: 'illness',    label: 'Illness',    icon: LogIcon.illness,    color: C.elevated, placeholder: 'e.g. Mild fever 37.8°C, headache' },
]

function LogPanel({ entries, onAdd }: { entries: LogEntry[]; onAdd: (e: LogEntry) => void }) {
  const [type, setType] = useState<LogEntry['type']>('medication')
  const [note, setNote] = useState('')
  const current = LOG_TYPES.find(t => t.value === type)!

  const handleAdd = () => {
    if (!note.trim()) return
    onAdd({ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), type, note, source: 'manual' })
    setNote('')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {LOG_TYPES.map(t => (
          <button key={t.value} onClick={() => setType(t.value)}
            className="px-3 py-1.5 rounded-full text-xs font-500 transition-all"
            style={{
              background: type === t.value ? t.color + '18' : C.input,
              border: `1px solid ${type === t.value ? t.color : C.borderMid}`,
              color: type === t.value ? t.color : C.muted,
            }}>
            <span className="inline-flex items-center mr-1">{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input value={note} onChange={e => setNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder={current.placeholder}
          className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
          style={{ background: C.input, border: `1px solid ${C.borderMid}`, color: C.navy }} />
        <button onClick={handleAdd}
          className="px-4 py-2 rounded-lg text-sm font-600 transition-all hover:opacity-80"
          style={{ background: C.navy, color: C.bg }}>+ Log</button>
      </div>
      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
        {entries.slice().reverse().map((e, i) => {
          const cfg = LOG_TYPES.find(t => t.value === e.type)!
          return (
            <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2" style={{ background: C.input }}>
              <span className="text-[10px] font-mono mt-0.5 flex-shrink-0" style={{ color: C.muted }}>{e.time}</span>
              <span className="text-[10px] rounded px-1.5 py-0.5 font-mono flex-shrink-0"
                style={{ background: cfg.color + '18', color: cfg.color }}>
                <span className="inline-flex items-center mr-0.5">{cfg.icon}</span>{e.type}
              </span>
              <span className="text-xs flex-1" style={{ color: C.navy }}>{e.note}</span>
              {e.source === 'health' && (
                <span className="text-[10px] font-mono flex-shrink-0" style={{ color: C.green }}>⇄ Health</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Insight card ─────────────────────────────────────────────────────────────
function InsightCard({ icon, title, body, color }: { icon: string; title: string; body: string; color: string }) {
  return (
    <div className="rounded-xl p-4 flex gap-3" style={{ background: C.card, border: `1px solid ${C.border}` }}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
        style={{ background: color + '18' }}>{icon}</div>
      <div>
        <div className="text-sm font-600 mb-1" style={{ color: C.navy }}>{title}</div>
        <div className="text-xs leading-relaxed" style={{ color: C.muted }}>{body}</div>
      </div>
    </div>
  )
}

// ─── Apple Health row ─────────────────────────────────────────────────────────
function AppleHealthRow({ synced, label, time }: { synced: boolean; label: string; time: string }) {
  return (
    <div className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full" style={{ background: synced ? C.green : C.muted }} />
        <span className="text-sm" style={{ color: C.navy }}>{label}</span>
      </div>
      <span className="font-mono text-[10px]" style={{ color: C.muted }}>{time}</span>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [risk, setRisk]         = useState<RiskLevel>(PILOT_PROFILE.level)
  const [riskScore, setRiskScore] = useState<number | undefined>(PILOT_PROFILE.score)
  const [nav, setNav]           = useState<NavTab>('dashboard')
  const [signalData, setSignalData] = useState<SignalPoint[]>(() => generateSignalHistory(30))
  const [pilotData] = useState<PilotSnapshot>(PILOT_PROFILE)
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: '07:30', type: 'medication', note: 'Lamotrigine 200mg — taken with breakfast', source: 'manual' },
    { time: '07:05', type: 'sleep',      note: '7h 20min — woke once at 3am, restless',   source: 'health' },
    { time: 'Yesterday', type: 'cycle',  note: 'Day 14 of cycle',                          source: 'manual' },
  ])
  const [liveHR,       setLiveHR]       = useState(PILOT_PROFILE.currentHr)
  const [liveTemp,     setLiveTemp]     = useState(36.7)
  const [liveEDA,      setLiveEDA]      = useState(0.92)
  const [liveAccel,    setLiveAccel]    = useState(0.4)
  const [chartView, setChartView]       = useState<'hr' | 'temp' | 'eda' | 'all'>('all')
  const tickRef = useRef(0)

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current++
      const t   = tickRef.current
      const hr  = PILOT_PROFILE.baselineHr + 4 + Math.sin(t * 0.15) * 3.2 + Math.sin(t * 0.037) * 1.4
      setLiveHR(hr)
      // push a chart point every 60 seconds so slice(-30) = last 30 min
      if (t % 60 === 0) {
        const label = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        setSignalData(prev => [...prev.slice(-59), { t: label, hr, temp: 0, eda: 0, accel: 0 }])
      }
      const nextScore = Math.round(22 + Math.max(0, hr - PILOT_PROFILE.baselineHr) * 2.5)
      setRiskScore(nextScore)
      setRisk(nextScore >= 40 ? 'ELEVATED' : 'LOW')
    }, 1000)
    return () => clearInterval(id)
  }, [])

  const navItems: { id: NavTab; icon: string; label: string }[] = [
    { id: 'dashboard', icon: '☰',   label: 'Dashboard' },
    { id: 'live',      icon: 'svg-live',     label: 'Live Data' },
    { id: 'history',   icon: 'svg-history',  label: 'History' },
    { id: 'log',       icon: '✎',   label: 'Log' },
    { id: 'settings',  icon: 'svg-gear',     label: 'Settings' },
  ]

  const renderIcon = (icon: string, color: string) => {
    const wrap = (child: React.ReactNode) => (
      <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {child}
      </span>
    )
    if (icon === 'svg-gear')    return wrap(<IconGear color={color} />)
    if (icon === 'svg-live')    return wrap(<IconLive color={color} />)
    if (icon === 'svg-history') return wrap(<IconHistory color={color} />)
    return wrap(<span style={{ fontSize: 15, color, lineHeight: 1 }}>{icon}</span>)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: C.bg, color: C.navy }}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 overflow-hidden"
        style={{ background: C.navy, borderBottom: `1px solid ${C.navy}`, height: 58 }}>
        <PulseLogo height={90} />
        <div className="flex items-center gap-2 mr-2">
          <div className="w-2 h-2 rounded-full" style={{ background: '#5adba0' }} />
          <span className="text-xs" style={{ color: '#5adba0' }}>CONNECTED</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ── */}
        <nav className="hidden md:flex flex-col py-6 gap-1"
          style={{ width: 64, background: C.navy, borderRight: `1px solid ${C.navy}` }}>
          {navItems.map(item => {
            const color = nav === item.id ? C.bg : 'rgba(234,232,227,0.5)'
            return (
              <button key={item.id} onClick={() => setNav(item.id)} title={item.label}
                className="mx-2 flex flex-col items-center justify-center rounded-lg py-3 gap-1 transition-all"
                style={{
                  background: nav === item.id ? 'rgba(255,255,255,0.15)' : 'transparent',
                  color,
                  border: nav === item.id ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
                }}>
                {renderIcon(item.icon, color)}
                <span className="text-[9px] font-500 tracking-wider">{item.label.toUpperCase()}</span>
              </button>
            )
          })}
        </nav>

        {/* ── Main ── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6" style={{ background: C.bg }}>
          {nav === 'dashboard' && <DashboardView risk={risk} riskScore={riskScore} signalData={signalData} pilotData={pilotData} />}
          {nav === 'live' && (
            <LiveDataView
              signalData={signalData}
              liveHR={liveHR} liveTemp={liveTemp} liveEDA={liveEDA}
              liveAccel={liveAccel}
              chartView={chartView} setChartView={setChartView}
              pilotData={pilotData}
            />
          )}
          {nav === 'history'  && <HistoryView signalData={signalData} pilotData={pilotData} />}
          {nav === 'log'      && <LogView logs={logs} setLogs={setLogs} />}
          {nav === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden flex justify-around px-4" style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
        {navItems.map(item => {
          const color = nav === item.id ? C.navy : C.muted
          return (
            <button key={item.id} onClick={() => setNav(item.id)}
              className="flex flex-col items-center py-2 gap-0.5 px-1"
              style={{ color }}>
              {renderIcon(item.icon, color)}
              <span className="text-[9px] font-500 tracking-wide whitespace-nowrap">{item.label.toUpperCase()}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

const INSIGHT_CATEGORIES: { id: string; label: string; icon: React.ReactNode; color: string; insights: { title: string; body: string }[] }[] = [
  {
    id: 'sleep', label: 'Sleep', icon: LogIcon.sleep, color: '#6b30d6',
    insights: [
      { title: 'Sleep disruption precursor', body: 'In 5 of your 7 events, you slept fewer than 6.5 hours in the preceding 48 hours. Poor deep sleep (under 90 min) appears in 100% of events.' },
      { title: 'Last night', body: '7h 20min total — 1h 45min deep sleep, 1h 30min REM. One wake at 3am. Below your 8h average for event-free nights.' },
    ],
  },
  {
    id: 'cycle', label: 'Cycle', icon: LogIcon.cycle, color: '#c02828',
    insights: [
      { title: 'Cycle-phase clustering', body: '4 of 7 seizures occurred during days 12–16 of your cycle (periovulatory phase). You are currently on day 14.' },
      { title: 'Estrogen and threshold', body: 'Estrogen peaks around ovulation may lower your seizure threshold. Consider discussing cycle-linked dosing with your neurologist.' },
    ],
  },
  {
    id: 'medication', label: 'Medication', icon: LogIcon.medication, color: '#1a6bc4',
    insights: [
      { title: 'Missed evening dose correlation', body: '2 of your last 3 events followed a missed or late evening Lamotrigine dose. Trough levels matter — consistent timing is key.' },
      { title: 'Today', body: 'Morning dose taken at 7:30 AM. Evening dose (8:00 PM) still pending.' },
    ],
  },
  {
    id: 'signals', label: 'Signals', icon: NavyIcon.signals, color: '#b86a00',
    insights: [
      { title: 'EDA spike pattern', body: 'Your skin conductance rises measurably 8–14 minutes before each recorded seizure. This is your strongest leading signal.' },
      { title: 'Temperature elevation', body: 'Sustained body temperature above 37.2°C for more than 3 hours preceded 3 events — possibly reflecting fever, stress, or metabolic load.' },
    ],
  },
  {
    id: 'activity', label: 'Activity', icon: NavyIcon.activity, color: '#1a8c84',
    insights: [
      { title: 'Rest before events', body: 'In 6 of 7 events, movement levels were low for 2+ hours beforehand — consistent with sedentary or pre-sleep periods when thresholds may be lower.' },
      { title: 'Today\'s activity', body: 'Light movement detected this morning. Acceleration peaks consistent with a short walk at 8:15 AM. Otherwise sedentary since 9:00 AM.' },
      { title: 'Sudden acceleration spikes', body: 'Post-ictal movement patterns in your data show sharp acceleration bursts followed by stillness. The model uses this signature to help confirm events retroactively.' },
    ],
  },
]

function InsightCategories() {
  const [open, setOpen] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-2">
      {INSIGHT_CATEGORIES.map(cat => (
        <div key={cat.id} className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${open === cat.id ? cat.color + '50' : C.border}`, background: C.card }}>
          <button
            onClick={() => setOpen(open === cat.id ? null : cat.id)}
            className="w-full flex items-center justify-between px-4 py-3 transition-all"
            style={{ background: open === cat.id ? cat.color + '08' : 'transparent' }}
          >
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: cat.color + '18' }}>{cat.icon}</span>
              <span className="text-sm font-600" style={{ color: C.navy }}>{cat.label}</span>
            </div>
            <span className="text-xs font-mono transition-all" style={{ color: cat.color, transform: open === cat.id ? 'rotate(180deg)' : 'none', display: 'inline-block' }}>▾</span>
          </button>
          {open === cat.id && (
            <div className="flex flex-col gap-3 px-4 pb-4 pt-1">
              {cat.insights.map((ins, i) => (
                <div key={i}>
                  <div className="text-xs font-600 mb-0.5" style={{ color: C.navy }}>{ins.title}</div>
                  <div className="text-xs leading-relaxed" style={{ color: C.muted }}>{ins.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function DashboardView({ risk, riskScore, signalData, pilotData }: { risk: RiskLevel; riskScore?: number; signalData: SignalPoint[]; pilotData: PilotSnapshot | null }) {
  const recentData = signalData.slice(-30)

  return (
    <div className="flex flex-col gap-5">
      {/* Seizure risk */}
      <div className="flex flex-col items-center gap-4 rounded-2xl p-6"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center gap-2 self-start">
          <div className="live-dot w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
          <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: C.green }}>Live wearable stream — updated every second</span>
        </div>
        <RiskBadge level={risk} />
        <RiskMeter level={risk} score={riskScore} />
        {pilotData && <p className="text-xs text-center max-w-md leading-relaxed" style={{ color: C.muted }}>
          Exploratory score from this participant’s heart-rate deviation and reported-event timing. It is not a clinical seizure forecast.
        </p>}
      </div>

      {/* Signal timeline */}
      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-xs font-600 tracking-wider uppercase mb-4" style={{ color: C.muted }}>Signal Timeline — Last 30 min</h2>
        <ChartShell height={180}>
          <LineChart data={recentData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="t" tick={{ fill: C.muted, fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval={9} tickFormatter={(v: string) => v} />
            <YAxis tick={{ fill: C.muted, fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            <Line type="monotone" dataKey="hr" name="Heart rate" stroke={C.hr} strokeWidth={1.5} dot={false} isAnimationActive={false} />
            {!pilotData && <><Line type="monotone" dataKey="temp" name="Temp" stroke={C.temp} strokeWidth={1.5} dot={false} isAnimationActive={false} /><Line type="monotone" dataKey="eda" name="EDA" stroke={C.eda} strokeWidth={1.5} dot={false} isAnimationActive={false} /></>}
          </LineChart>
        </ChartShell>
      </div>

      {/* Insights by category */}
      <div>
        <h2 className="text-xs font-600 tracking-wider uppercase mb-3" style={{ color: C.muted }}>Insights</h2>
        <InsightCategories />
      </div>
    </div>
  )
}

// ─── Live Data ────────────────────────────────────────────────────────────────
function LiveDataView({ signalData, liveHR, liveTemp, liveEDA, liveAccel, chartView, setChartView, pilotData }: {
  signalData: SignalPoint[]
  liveHR: number; liveTemp: number; liveEDA: number; liveAccel: number
  chartView: 'hr' | 'temp' | 'eda' | 'all'; setChartView: (v: any) => void
  pilotData: PilotSnapshot | null
}) {
  const recentData = signalData.slice(-30)
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <div className="live-dot w-1.5 h-1.5 rounded-full" style={{ background: C.green }} />
        <span className="font-mono text-[10px] tracking-widest uppercase" style={{ color: C.green }}>Pulse Band — heart-rate stream</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SignalCard label="Resting HR"       value={liveHR.toFixed(0)}      unit="bpm"  color={C.hr}    delta="+2"   sparkData={signalData} dataKey="hr" />
        {pilotData ? <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}><div className="text-[10px] font-600 tracking-widest uppercase" style={{ color: C.muted }}>Reported events</div><div className="text-2xl font-600 mt-2" style={{ color: C.navy }}>{pilotData.eventCount}</div><div className="text-xs mt-1" style={{ color: C.muted }}>personal event history</div></div> : <SignalCard label="Skin Temperature" value={liveTemp.toFixed(1)} unit="°C" color={C.temp} sparkData={signalData} dataKey="temp" />}
      </div>
      {!pilotData && <div className="grid grid-cols-2 gap-3">
        <SignalCard label="Skin Conductance" value={liveEDA.toFixed(2)} unit="µS" color={C.eda} delta="+0.1" sparkData={signalData} dataKey="eda" />
        <SignalCard label="Acceleration" value={liveAccel.toFixed(2)} unit="m/s²" color={C.accel} sparkData={signalData} dataKey="accel" />
      </div>
      }

      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-600 tracking-wider uppercase" style={{ color: C.muted }}>Signal Detail — Last 30 min</h2>
          <div className="flex gap-1">
            {(['all', 'hr', 'temp', 'eda'] as const).filter(v => !pilotData || v === 'all' || v === 'hr').map(v => (
              <button key={v} onClick={() => setChartView(v)}
                className="px-3 py-1 rounded-full text-[10px] font-mono transition-all"
                style={{
                  background: chartView === v ? C.navy : 'transparent',
                  border: `1px solid ${chartView === v ? C.navy : C.border}`,
                  color: chartView === v ? C.bg : C.muted,
                }}>{v.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <ChartShell height={200}>
          <LineChart data={recentData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={C.border} vertical={false} />
            <XAxis dataKey="t" tick={{ fill: C.muted, fontSize: 9, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval={9} tickFormatter={(v: string) => v} />
            <YAxis tick={{ fill: C.muted, fontSize: 10, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
            <Tooltip content={<CustomTooltip />} />
            {(chartView === 'all' || chartView === 'hr')   && <Line type="monotone" dataKey="hr"   name="HR"   stroke={C.hr}   strokeWidth={1.5} dot={false} isAnimationActive={false} />}
            {!pilotData && (chartView === 'all' || chartView === 'temp') && <Line type="monotone" dataKey="temp" name="Temp" stroke={C.temp} strokeWidth={1.5} dot={false} isAnimationActive={false} />}
            {!pilotData && (chartView === 'all' || chartView === 'eda')  && <Line type="monotone" dataKey="eda" name="EDA" stroke={C.eda} strokeWidth={1.5} dot={false} isAnimationActive={false} />}
          </LineChart>
        </ChartShell>
      </div>
    </div>
  )
}

// ─── History ──────────────────────────────────────────────────────────────────
function HistoryView({ signalData, pilotData }: { signalData: SignalPoint[]; pilotData: PilotSnapshot | null }) {
  const rc = (r: RiskLevel) => r === 'LOW' ? C.low : r === 'ELEVATED' ? C.elevated : C.high
  const historicalEvents = [
    { date: 'Sep 15, 2026', risk: 'HIGH' as RiskLevel, seizure: true,  duration: '~90s',  notes: 'Tonic-clonic. Woke at 3am. EDA spike preceded by 12 min.' },
    { date: 'Sep 3, 2026',  risk: 'ELEVATED' as RiskLevel, seizure: false, duration: '—', notes: 'ELEVATED warning issued at 11pm. No event. Poor sleep prior.' },
    { date: 'Aug 21, 2026', risk: 'HIGH' as RiskLevel, seizure: true,  duration: '~60s',  notes: 'Focal aware. Missed evening medication dose.' },
    { date: 'Aug 7, 2026',  risk: 'ELEVATED' as RiskLevel, seizure: false, duration: '—', notes: 'Elevated for 4h during fever. Resolved without event.' },
    { date: 'Jul 29, 2026', risk: 'HIGH' as RiskLevel, seizure: true,  duration: '~2min', notes: 'Tonic-clonic. Day 14 of cycle. Stress week.' },
  ]
  const events = pilotData ? pilotData.latestEvents.map(date => ({ date, risk: 'ELEVATED' as RiskLevel, seizure: true, duration: 'reported', notes: 'Reported event label from the wearable pilot dataset.' })) : historicalEvents
  const highEvents    = events.filter(e => e.risk === 'HIGH')
  const elevatedEvents = events.filter(e => e.risk === 'ELEVATED')
  const highSeizurePct     = 78
  const elevatedSeizurePct = 20

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-xs font-600 tracking-wider uppercase mb-4" style={{ color: C.muted }}>Event History</h2>
        <div className="flex flex-col gap-3">
          {events.map((e, i) => (
            <div key={i} className="rounded-xl p-4 flex gap-4 items-start"
              style={{ background: C.card, border: `1px solid ${rc(e.risk)}30` }}>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: rc(e.risk) + '18', color: rc(e.risk) }}>{e.risk}</span>
                {e.seizure && <span className="font-mono text-[10px]" style={{ color: C.elevated }}>⚡ seizure</span>}
              </div>
              <div>
                <div className="font-600 text-sm mb-0.5" style={{ color: C.navy }}>{e.date}</div>
                {e.seizure && <div className="font-mono text-[10px] mb-1" style={{ color: C.muted }}>Duration: {e.duration}</div>}
                <div className="text-xs" style={{ color: C.muted }}>{e.notes}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: C.surface, border: `1px solid ${C.elevated}30` }}>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full self-start"
            style={{ background: C.elevated + '18', color: C.elevated }}>ELEVATED</span>
          <div className="font-mono text-4xl font-700 mt-1" style={{ color: C.elevated }}>{elevatedSeizurePct}%</div>
          <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
            of ELEVATED risk periods were followed by a seizure
          </div>
        </div>
        <div className="rounded-2xl p-5 flex flex-col gap-2" style={{ background: C.surface, border: `1px solid ${C.high}30` }}>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full self-start"
            style={{ background: C.high + '18', color: C.high }}>HIGH</span>
          <div className="font-mono text-4xl font-700 mt-1" style={{ color: C.high }}>{highSeizurePct}%</div>
          <div className="text-xs leading-relaxed" style={{ color: C.muted }}>
            of HIGH risk periods were followed by a seizure
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Log View ─────────────────────────────────────────────────────────────────
function LogView({ logs, setLogs }: { logs: LogEntry[]; setLogs: (l: LogEntry[]) => void }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h2 className="text-xs font-600 tracking-wider uppercase mb-1" style={{ color: C.muted }}>Daily Log</h2>
        <p className="text-xs mb-5" style={{ color: C.muted }}>Each entry trains your personal model. Log consistently for better predictions.</p>
        <LogPanel entries={logs} onAdd={e => setLogs([...logs, e])} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[10px] font-600 uppercase tracking-widest" style={{ color: C.muted }}>Sleep last night</h3>
            <span className="font-mono text-[10px]" style={{ color: C.green }}>⇄ from Health</span>
          </div>
          <div className="font-mono text-3xl font-600 mb-1" style={{ color: C.navy }}>7h 20m</div>
          <div className="text-xs" style={{ color: C.muted }}>11:40 PM → 7:00 AM · 1 wake</div>
          <div className="mt-3 text-xs" style={{ color: C.muted }}>
            {[['Deep sleep', '1h 45m'], ['REM', '1h 30m'], ['Light', '4h 05m']].map(([l, v], i, a) => (
              <div key={l} className="flex justify-between py-1"
                style={{ borderBottom: i < a.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <span>{l}</span>
                <span className="font-mono" style={{ color: C.navy }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <h3 className="text-[10px] font-600 uppercase tracking-widest mb-3" style={{ color: C.muted }}>Medications today</h3>
          <div className="flex flex-col gap-2">
            {[
              { name: 'Lamotrigine 200mg', time: '7:30 AM', taken: true },
              { name: 'Lamotrigine 200mg', time: '8:00 PM', taken: false },
              { name: 'Vitamin D 2000IU',  time: '7:30 AM', taken: true },
            ].map((m, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg"
                style={{ background: C.input }}>
                <div>
                  <div style={{ color: C.navy }}>{m.name}</div>
                  <div className="font-mono" style={{ color: C.muted }}>{m.time}</div>
                </div>
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-full"
                  style={{ background: m.taken ? C.green + '18' : C.input, color: m.taken ? C.green : C.muted, border: `1px solid ${m.taken ? C.green + '40' : C.borderMid}` }}>
                  {m.taken ? '✓ taken' : 'pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


// ─── Settings ─────────────────────────────────────────────────────────────────
interface Caregiver { id: number; name: string; phone: string; alertsOn: boolean }

function SettingsView() {
  const [notifLevel,     setNotifLevel]     = useState<'ELEVATED' | 'HIGH'>('ELEVATED')
  const [wristAlert,     setWristAlert]     = useState(true)
  const [caregivers, setCaregivers] = useState<Caregiver[]>([
    { id: 1, name: 'Mom', phone: '+1 (555) 012-3456', alertsOn: true },
  ])
  const [newName,  setNewName]  = useState('')
  const [newPhone, setNewPhone] = useState('')

  const addCaregiver = () => {
    if (!newName.trim() || !newPhone.trim()) return
    setCaregivers(prev => [...prev, { id: Date.now(), name: newName.trim(), phone: newPhone.trim(), alertsOn: false }])
    setNewName(''); setNewPhone('')
  }
  const removeCaregiver = (id: number) => setCaregivers(prev => prev.filter(c => c.id !== id))
  const toggleAlert = (id: number) => setCaregivers(prev => prev.map(c => c.id === id ? { ...c, alertsOn: !c.alertsOn } : c))

  const Toggle = ({ value, onChange }: { value: boolean; onChange: () => void }) => (
    <button onClick={onChange} className="relative rounded-full transition-all"
      style={{ width: 44, height: 24, background: value ? C.green : C.input, border: `1px solid ${value ? C.green : C.borderMid}` }}>
      <div className="absolute top-1 rounded-full w-4 h-4 transition-all"
        style={{ left: value ? 22 : 4, background: value ? C.bg : C.muted }} />
    </button>
  )

  return (
    <div className="flex flex-col gap-4 max-w-xl">
      {[
        { title: 'Vibrate Pulse band', sub: 'Haptic alert on wearable when risk changes', content: <Toggle value={wristAlert} onChange={() => setWristAlert(v => !v)} /> },
      ].map((s, i) => (
        <div key={i} className="flex items-center justify-between rounded-2xl px-5 py-4"
          style={{ background: C.surface, border: `1px solid ${C.border}` }}>
          <div>
            <div className="text-sm font-500" style={{ color: C.navy }}>{s.title}</div>
            {s.sub && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{s.sub}</div>}
          </div>
          {s.content}
        </div>
      ))}

      {/* Caregiver contacts */}
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div>
          <h3 className="text-sm font-600 mb-0.5" style={{ color: C.navy }}>Caregiver contacts</h3>
          <p className="text-xs" style={{ color: C.muted }}>Tick the contacts you want to receive alerts when risk is elevated.</p>
        </div>

        <div className="flex flex-col gap-2">
          {caregivers.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5"
              style={{ background: C.card, border: `1px solid ${C.border}` }}>
              <button onClick={() => toggleAlert(c.id)}
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
                style={{ background: c.alertsOn ? C.navy : 'transparent', border: `1.5px solid ${c.alertsOn ? C.navy : C.borderMid}` }}>
                {c.alertsOn && <span style={{ color: C.bg, fontSize: 11, lineHeight: 1 }}>✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-500 truncate" style={{ color: C.navy }}>{c.name}</div>
                <div className="text-xs" style={{ color: C.muted }}>{c.phone}</div>
              </div>
              {c.alertsOn && (
                <span className="text-[10px] px-2 py-0.5 rounded-full flex-shrink-0"
                  style={{ background: C.green + '18', color: C.green }}>alerts on</span>
              )}
              <button onClick={() => removeCaregiver(c.id)}
                className="text-xs flex-shrink-0 transition-all hover:opacity-60"
                style={{ color: C.muted }}>✕</button>
            </div>
          ))}
        </div>

        {/* Add new caregiver — stacked inputs so phone number never overflows */}
        <div className="flex flex-col gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Name"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: C.input, border: `1px solid ${C.borderMid}`, color: C.navy }} />
          <input value={newPhone} onChange={e => setNewPhone(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: C.input, border: `1px solid ${C.borderMid}`, color: C.navy }} />
          <button onClick={addCaregiver}
            className="rounded-lg py-2 text-sm font-500 transition-all hover:opacity-80"
            style={{ background: C.navy, color: C.bg }}>
            + Add caregiver
          </button>
        </div>
      </div>

      {/* Alert threshold — moved below contacts */}
      <div className="flex items-center justify-between rounded-2xl px-5 py-4"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div>
          <div className="text-sm font-500" style={{ color: C.navy }}>Alert threshold</div>
          <div className="text-xs mt-0.5" style={{ color: C.muted }}>Minimum risk level to notify caregivers</div>
        </div>
        <div className="flex gap-2">
          {(['ELEVATED', 'HIGH'] as const).map(l => (
            <button key={l} onClick={() => setNotifLevel(l)}
              className="px-3 py-1.5 rounded-lg text-xs font-500 transition-all"
              style={{
                background: notifLevel === l ? C.navy : 'transparent',
                border: `1px solid ${notifLevel === l ? C.navy : C.borderMid}`,
                color: notifLevel === l ? C.bg : C.muted,
              }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Pulse Band connection */}
      <div className="rounded-2xl p-5 flex flex-col gap-4" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div>
          <h3 className="text-sm font-600 mb-0.5" style={{ color: C.navy }}>Pulse Band</h3>
          <p className="text-xs" style={{ color: C.muted }}>Manage your connected wearable device.</p>
        </div>
        <div className="flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: C.card, border: `1px solid ${C.green}30` }}>
          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: C.green }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-500" style={{ color: C.navy }}>Pulse Band · Series 1</div>
            <div className="text-xs" style={{ color: C.muted }}>Connected · Battery 84%</div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: C.green + '18', color: C.green }}>LIVE</span>
        </div>
        <button className="w-full rounded-lg px-4 py-2.5 text-sm font-500 text-left transition-all hover:opacity-70"
          style={{ background: C.input, border: `1px solid ${C.borderMid}`, color: C.muted }}>
          Disconnect Pulse Band
        </button>
        <p className="text-xs" style={{ color: C.muted }}>
          To pair a new band you must first disconnect your current band. Ensure Bluetooth is on and hold the new band button for 3 seconds until it pulses white.
        </p>
      </div>

      <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <h3 className="text-sm font-600 mb-3" style={{ color: C.navy }}>Neurologist sharing</h3>
        <p className="text-xs mb-3" style={{ color: C.muted }}>Share a read-only data report with your care team. Reports include signal trends, event log, and model insights.</p>
        <button className="px-4 py-2 rounded-lg text-sm font-500 transition-all hover:opacity-80"
          style={{ background: C.navy, color: C.bg }}>
          Generate shareable report →
        </button>
      </div>
      <div className="rounded-2xl p-5 flex items-center gap-3"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-base font-600"
          style={{ background: C.navy, color: C.bg }}>SE</div>
        <div>
          <div className="text-sm font-600" style={{ color: C.navy }}>Sarah Ellis</div>
          <div className="text-xs" style={{ color: C.muted }}>Member since Aug 2025 · 142 days tracked</div>
        </div>
      </div>
    </div>
  )
}
