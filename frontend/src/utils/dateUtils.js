// Mapping des mois français — accepte les formes complètes ET abrégées,
// avec ou sans point, avec ou sans accent
const MOIS_MAP = {
  // Janvier
  janvier: 0, 'janv': 0, 'janv.': 0, 'jan': 0, 'jan.': 0,
  // Février
  février: 1, fevrier: 1, 'févr': 1, 'févr.': 1, 'fevr': 1, 'fevr.': 1, 'fév': 1, 'fév.': 1, 'fev': 1, 'fev.': 1,
  // Mars
  mars: 2,
  // Avril
  avril: 3, 'avr': 3, 'avr.': 3,
  // Mai
  mai: 4,
  // Juin
  juin: 5,
  // Juillet
  juillet: 6, 'juil': 6, 'juil.': 6, 'jui': 6, 'jui.': 6,
  // Août
  août: 7, aout: 7, 'aoû': 7, 'aoû.': 7, 'aou': 7, 'aou.': 7,
  // Septembre
  septembre: 8, 'sept': 8, 'sept.': 8, 'sep': 8, 'sep.': 8,
  // Octobre
  octobre: 9, 'oct': 9, 'oct.': 9,
  // Novembre
  novembre: 10, 'nov': 10, 'nov.': 10,
  // Décembre
  décembre: 11, decembre: 11, 'déc': 11, 'déc.': 11, 'dec': 11, 'dec.': 11,
}

/**
 * Parse une date française.
 * Formats acceptés :
 *   "17 mars 2026, 17:10"      (forme longue avec heure)
 *   "24 avr. 2026, 16:28"      (forme abrégée avec point)
 *   "24 avr 2026, 16:28"       (forme abrégée sans point)
 *   "17 mars 2026"             (sans heure)
 */
export function parseFrenchDate(str) {
  if (!str || typeof str !== 'string') return null

  const cleaned = str.trim()
  // Pattern : DD <mois> YYYY[, HH:MM]
  // \S+ pour matcher mois avec ou sans point, accentué ou pas
  const match = cleaned.match(/^(\d{1,2})\s+(\S+?)\s+(\d{4})(?:,?\s*(\d{1,2}):(\d{2}))?$/)
  if (!match) return null

  const [, day, moisStrRaw, year, hour, minute] = match
  // Normaliser : minuscules, on garde le point pour matcher "avr."
  const moisStr = moisStrRaw.toLowerCase()
  const monthIndex = MOIS_MAP[moisStr]
  if (monthIndex === undefined) return null

  return new Date(
    parseInt(year),
    monthIndex,
    parseInt(day),
    hour ? parseInt(hour) : 0,
    minute ? parseInt(minute) : 0
  )
}

export function formatDateShort(date) {
  if (!date) return ''
  const d = date.getDate()
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  return `${d} ${months[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDateFull(date) {
  if (!date) return ''
  const d = date.getDate()
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre']
  return `${d} ${months[date.getMonth()]} ${date.getFullYear()}`
}

export function formatTime(date) {
  if (!date) return ''
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return '0 min'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return `${h}h${m > 0 ? String(m).padStart(2, '0') : ''}`
}

export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
}

export function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}

export function getWeekKey(date) {
  const ws = getWeekStart(date)
  return `${ws.getFullYear()}-W${String(getWeekNumber(ws)).padStart(2, '0')}`
}

export function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function getDayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
export const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']
