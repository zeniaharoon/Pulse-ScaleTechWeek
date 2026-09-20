export type PilotPoint = { t: string; hr: number }

export type PilotSnapshot = {
  points: PilotPoint[]
  currentHr: number
  score: number
  level: 'LOW' | 'ELEVATED' | 'HIGH'
  eventCount: number
  timeSpan: string
  latestEvents: string[]
  baselineHr: number
  source: string
}

type HeartRateRow = { timestamp: number; bpm: number }

function rows(text: string) {
  return text.trim().split(/\r?\n/).map(line => line.split(',').map(value => value.trim().replace(/^"|"$/g, '')))
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function deviation(values: number[], average: number) {
  return Math.sqrt(mean(values.map(value => (value - average) ** 2)))
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

export async function createPilotSnapshot(heartRateFile: File, eventFile: File): Promise<PilotSnapshot> {
  const [heartRateText, eventText] = await Promise.all([heartRateFile.text(), eventFile.text()])
  const heartRateRows = rows(heartRateText)
  const eventRows = rows(eventText)
  const heartHeader = heartRateRows.shift()?.map(value => value.toLowerCase()) ?? []
  const eventHeader = eventRows.shift()?.map(value => value.toLowerCase()) ?? []
  const timestampIndex = heartHeader.findIndex(value => value === 'timestamp')
  const bpmIndex = heartHeader.findIndex(value => value === 'bpm')
  const eventIndex = eventHeader.findIndex(value => value.includes('reported_event_times'))

  if (timestampIndex === -1 || bpmIndex === -1) {
    throw new Error('The heart-rate file must contain timestamp and BPM columns.')
  }
  if (eventIndex === -1) {
    throw new Error('The event file must contain a reported_event_times column.')
  }

  const heartRate: HeartRateRow[] = heartRateRows
    .map(row => ({ timestamp: Number(row[timestampIndex]), bpm: Number(row[bpmIndex]) }))
    .filter(row => Number.isFinite(row.timestamp) && Number.isFinite(row.bpm) && row.bpm > 20 && row.bpm < 240)
    .sort((a, b) => a.timestamp - b.timestamp)
  const events = eventRows
    .map(row => Number(row[eventIndex]))
    .filter(Number.isFinite)
    .sort((a, b) => a - b)

  if (heartRate.length < 30) throw new Error('The heart-rate file does not contain enough valid readings.')

  const baseline = mean(heartRate.map(row => row.bpm))
  const baselineDeviation = Math.max(deviation(heartRate.map(row => row.bpm), baseline), 1)
  const latestTimestamp = heartRate.at(-1)!.timestamp
  const thirtyMinutesAgo = latestTimestamp - 30 * 60 * 1000
  const recent = heartRate.filter(row => row.timestamp >= thirtyMinutesAgo)
  const chartSource = recent.length >= 12 ? recent : heartRate.slice(-60)
  const stride = Math.max(1, Math.floor(chartSource.length / 30))
  const points = chartSource.filter((_, index) => index % stride === 0).slice(-30).map(row => ({ t: formatTime(row.timestamp), hr: row.bpm }))
  const recentAverage = mean(chartSource.map(row => row.bpm))
  const hrZ = Math.abs(recentAverage - baseline) / baselineDeviation
  const currentHour = new Date(latestTimestamp).getHours()
  const sameHourEvents = events.filter(event => new Date(event).getHours() === currentHour).length
  const circadianSignal = events.length ? sameHourEvents / events.length : 0

  // This is deliberately a transparent research baseline, not a clinical model.
  // It combines personal HR deviation with the observed event-time distribution.
  const score = Math.max(0, Math.min(100, Math.round(12 + hrZ * 17 + circadianSignal * 35)))
  const level = score >= 70 ? 'HIGH' : score >= 40 ? 'ELEVATED' : 'LOW'

  return {
    points,
    currentHr: chartSource.at(-1)!.bpm,
    score,
    level,
    eventCount: events.length,
    timeSpan: `${formatDate(heartRate[0].timestamp)} – ${formatDate(latestTimestamp)}`,
    latestEvents: events.slice(-5).reverse().map(formatDate),
    baselineHr: baseline,
    source: `${heartRateFile.name} + ${eventFile.name}`,
  }
}
