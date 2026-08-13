const CANONICAL_KEYS = [
  'SNA',
  'SNB',
  'ANB',
  'FMA',
  'Overjet',
  'Overbite',
  'Mx1 to SN',
  'MP to Mn1',
  'IIA',
  'Eline to U lip',
  'Eline to L lip',
  'APDI',
  'Combination Factor(CF)'
] as const

const ALIAS_TO_CANONICAL: Record<string, (typeof CANONICAL_KEYS)[number]> = {
  sna: 'SNA',
  snb: 'SNB',
  anb: 'ANB',
  fma: 'FMA',
  overjet: 'Overjet',
  'incisor overjet': 'Overjet',
  overbite: 'Overbite',
  'incisor overbite': 'Overbite',
  apdi: 'APDI',
  iia: 'IIA',
  'mx1 to sn': 'Mx1 to SN',
  'u1 to sn': 'Mx1 to SN',
  'mp to mn1': 'MP to Mn1',
  impa: 'MP to Mn1',
  'interincisal angle': 'IIA',
  'eline to u lip': 'Eline to U lip',
  'upper lip to e-plane': 'Eline to U lip',
  'upper lip to e-plane.': 'Eline to U lip',
  'upper lip e-plane': 'Eline to U lip',
  'eline to l lip': 'Eline to L lip',
  'lower lip to e-plane': 'Eline to L lip',
  'lower lip e-plane': 'Eline to L lip',
  'combination factor': 'Combination Factor(CF)',
  'combination factor(cf)': 'Combination Factor(CF)',
  cf: 'Combination Factor(CF)'
}

function normalizeMeasurementName(name: string): string {
  return name.replace(/\r/g, '').trim()
}

function aliasKey(name: string): string {
  return normalizeMeasurementName(name)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s*\((dg|mm|%)\)\s*$/i, '')
}

export function toNumericMeasurements(
  measurements?: Record<string, number | null>
): Record<string, number> {
  if (!measurements) return {}

  const numeric: Record<string, number> = {}
  for (const [rawName, value] of Object.entries(measurements)) {
    if (typeof value !== 'number' || Number.isNaN(value)) continue
    const name = normalizeMeasurementName(rawName)
    if (!name) continue
    numeric[name] = value
  }
  return numeric
}

export function toOrthoPlannerAnalysisChart(
  measurements?: Record<string, number | null>
): Record<string, number> {
  const numeric = toNumericMeasurements(measurements)
  const chart: Record<string, number> = { ...numeric }

  for (const [name, value] of Object.entries(numeric)) {
    const canonical = ALIAS_TO_CANONICAL[aliasKey(name)]
    if (canonical && chart[canonical] === undefined) {
      chart[canonical] = value
    }
  }

  return chart
}
