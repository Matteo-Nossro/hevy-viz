import { ref } from 'vue'
import { listUsers, getWorkoutSetsForUser, getInbodyScansForUser } from '../api/client'
import { getWeekKey, getDayKey } from '../utils/dateUtils'
import { normalizeExerciseName } from '../config/exerciseNormalization'

export const USER_COLORS = ['#5eb8c4', '#b794f6', '#7ea7e8', '#67c994']

const WORKING_SET_TYPES = ['normal', 'failure', 'dropset']

// ── Singleton state ─────────────────────────────────────────────────────────
const allUsers = ref([])
const usersDataMap = ref({})  // username → { sessions, scans, loading, loaded, error }
let loadingSet = new Set()
let usersListLoaded = false

// ── Parsing helpers ─────────────────────────────────────────────────────────

function parseSessionsFromRows(rows) {
  const map = new Map()
  for (const row of rows) {
    if (!row.start_time) continue
    const startTime = new Date(row.start_time)
    const endTime = row.end_time ? new Date(row.end_time) : null
    const key = `${row.title}__${startTime.getTime()}`

    if (!map.has(key)) {
      map.set(key, {
        title: row.title || '',
        date: startTime,
        endDate: endTime,
        duration: endTime ? Math.round((endTime - startTime) / 60000) : 0,
        exercises: new Map(),
      })
    }
    const session = map.get(key)
    const title = normalizeExerciseName(row.exercise_title || '')
    if (!session.exercises.has(title)) session.exercises.set(title, [])
    session.exercises.get(title).push(row)
  }

  return Array.from(map.values()).map(s => {
    const exerciseList = Array.from(s.exercises.entries()).map(([title, sets]) => {
      const wSets = sets.filter(st => WORKING_SET_TYPES.includes((st.set_type || '').toLowerCase()))
      const volume = wSets.reduce((a, st) => a + (parseFloat(st.weight_kg) || 0) * (parseInt(st.reps) || 0), 0)
      const valid = wSets.filter(st => parseFloat(st.weight_kg) > 0 && parseInt(st.reps) > 0)
      const best1RM = valid.length ? Math.max(...valid.map(st => parseFloat(st.weight_kg) * (1 + parseInt(st.reps) / 30))) : 0
      const maxWeight = valid.length ? Math.max(...valid.map(st => parseFloat(st.weight_kg))) : 0
      return { title, workingSets: wSets, volume, best1RM, maxWeight }
    })
    const totalVolume = exerciseList.reduce((a, e) => a + e.volume, 0)
    return {
      title: s.title,
      date: s.date,
      endDate: s.endDate,
      duration: s.duration,
      exercises: exerciseList,
      totalVolume,
      dayKey: getDayKey(s.date),
    }
  }).sort((a, b) => a.date - b.date)
}

function parseScans(rows) {
  return (rows ?? []).map(row => ({
    id: row.id,
    scan_date: new Date(row.scan_date),
    weight_kg: parseFloat(row.weight_kg) || null,
    skeletal_muscle_mass_kg: parseFloat(row.skeletal_muscle_mass_kg) || null,
    body_fat_mass_kg: parseFloat(row.body_fat_mass_kg) || null,
    body_fat_percent: parseFloat(row.body_fat_percent) || null,
  })).sort((a, b) => a.scan_date - b.scan_date)
}

// ── Analytics (pure functions, exported for reuse) ──────────────────────────

export function filterSessionsByPeriod(sessions, period, refDate) {
  if (period === 'all') return sessions
  const ref = refDate || (sessions.length ? sessions[sessions.length - 1].date : new Date())
  let cutoff
  if (period === '1w') cutoff = new Date(ref.getTime() - 7 * 24 * 60 * 60 * 1000)
  else if (period === '1m') cutoff = new Date(ref.getFullYear(), ref.getMonth() - 1, ref.getDate())
  else if (period === '3m') cutoff = new Date(ref.getFullYear(), ref.getMonth() - 3, ref.getDate())
  else if (period === '6m') cutoff = new Date(ref.getFullYear(), ref.getMonth() - 6, ref.getDate())
  else if (period === '1y') cutoff = new Date(ref.getFullYear() - 1, ref.getMonth(), ref.getDate())
  else return sessions
  return sessions.filter(s => s.date >= cutoff)
}

// Returns the current streak in consecutive weeks (counting backwards from latest session)
export function computeCurrentStreak(sessions) {
  if (!sessions.length) return 0
  const weeks = [...new Set(sessions.map(s => getWeekKey(s.date)))].sort()
  let streak = 1
  for (let i = weeks.length - 1; i > 0; i--) {
    const [y1, w1] = weeks[i - 1].split('-W').map(Number)
    const [y2, w2] = weeks[i].split('-W').map(Number)
    if ((y2 - y1) * 52 + (w2 - w1) === 1) streak++
    else break
  }
  return streak
}

// Counts PRs beaten in [startDate, endDate] using full session history to detect improvements
export function computeRecordsCount(allSessions, startDate, endDate) {
  const bestSoFar = new Map()
  let count = 0
  for (const s of allSessions) {
    for (const ex of s.exercises) {
      if (!ex.workingSets.length) continue
      if (!bestSoFar.has(ex.title)) {
        bestSoFar.set(ex.title, { best1RM: 0, maxWeight: 0, maxVolume: 0 })
      }
      const prev = bestSoFar.get(ex.title)
      if (s.date >= startDate && s.date <= endDate) {
        if (ex.best1RM > prev.best1RM && prev.best1RM > 0) count++
        if (ex.maxWeight > prev.maxWeight && prev.maxWeight > 0) count++
        if (ex.volume > prev.maxVolume && prev.maxVolume > 0) count++
      }
      if (ex.best1RM > prev.best1RM) prev.best1RM = ex.best1RM
      if (ex.maxWeight > prev.maxWeight) prev.maxWeight = ex.maxWeight
      if (ex.volume > prev.maxVolume) prev.maxVolume = ex.volume
    }
  }
  return count
}

// Top N exercises by set count (sessions already filtered to period)
export function computeTopExercises(sessions, n = 3) {
  const map = new Map()
  for (const s of sessions) {
    for (const ex of s.exercises) {
      map.set(ex.title, (map.get(ex.title) || 0) + ex.workingSets.length)
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name, count]) => ({ name, count }))
}

// Returns an array of YYYY-MM-DD day keys spanning [startDate, endDate]
export function computeHeatmapDays(startDate, endDate) {
  const days = []
  const cur = new Date(startDate)
  cur.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)
  while (cur <= end) {
    days.push(getDayKey(new Date(cur)))
    cur.setDate(cur.getDate() + 1)
  }
  return days
}

// Muscle/fat delta over scans in [startDate, endDate] for recomp ratio
export function computeRecomp(scans, startDate, endDate) {
  const inRange = scans.filter(s => s.scan_date >= startDate && s.scan_date <= endDate)
  if (inRange.length < 2) return null
  const first = inRange[0]
  const last = inRange[inRange.length - 1]
  const muscleDelta = first.skeletal_muscle_mass_kg != null && last.skeletal_muscle_mass_kg != null
    ? last.skeletal_muscle_mass_kg - first.skeletal_muscle_mass_kg
    : null
  const fatDelta = first.body_fat_mass_kg != null && last.body_fat_mass_kg != null
    ? last.body_fat_mass_kg - first.body_fat_mass_kg
    : null
  if (muscleDelta === null || fatDelta === null) return null
  return { muscleDelta, fatDelta }
}

// ── Hex color utility ───────────────────────────────────────────────────────
export function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

// Returns all exercises practiced by at least 2 of the selected users in [start, end]
// usersWithSessions: [{ username, sessions }]
// Title matching is case-insensitive; the first-seen casing is used for display.
export function getExercisesForComparison(usersWithSessions, startDate, endDate) {
  const exerciseUsers = new Map() // normalizedTitle → Set<username>
  const titleMap = new Map()      // normalizedTitle → display title (first seen)
  for (const { username, sessions } of usersWithSessions) {
    const seen = new Set()
    for (const s of sessions) {
      if (s.date < startDate || s.date > endDate) continue
      for (const ex of s.exercises) {
        if (ex.workingSets.length > 0) {
          const normalized = ex.title.toLowerCase().trim()
          if (!seen.has(normalized)) {
            seen.add(normalized)
            if (!exerciseUsers.has(normalized)) {
              exerciseUsers.set(normalized, new Set())
              titleMap.set(normalized, ex.title)
            }
            exerciseUsers.get(normalized).add(username)
          }
        }
      }
    }
  }
  return Array.from(exerciseUsers.entries())
    .filter(([, users]) => users.size >= 2)
    .map(([normalized, users]) => ({ title: titleMap.get(normalized), users: Array.from(users) }))
}

// Per-exercise stats for one user within [startDate, endDate]
// Returns null if the user has no data for this exercise in the period
export function exerciseStatsForUser(sessions, exerciseTitle, startDate, endDate) {
  const normalizedTitle = exerciseTitle.toLowerCase().trim()
  const relevant = sessions.filter(
    s => s.date >= startDate && s.date <= endDate &&
         s.exercises.some(e => e.title.toLowerCase().trim() === normalizedTitle && e.workingSets.length > 0)
  )
  if (!relevant.length) return null

  let best1RM = 0
  let maxWeight = 0
  let bestSet = null
  let totalVolume = 0
  let totalSets = 0
  const history = []

  for (const session of relevant) {
    const ex = session.exercises.find(e => e.title.toLowerCase().trim() === normalizedTitle)
    if (!ex) continue
    totalVolume += ex.volume
    totalSets += ex.workingSets.length
    if (ex.best1RM > best1RM) {
      best1RM = ex.best1RM
      const valid = ex.workingSets.filter(
        st => parseFloat(st.weight_kg) > 0 && parseInt(st.reps) > 0
      )
      const top = valid.reduce((b, st) => {
        const rm = parseFloat(st.weight_kg) * (1 + parseInt(st.reps) / 30)
        const bRm = b ? parseFloat(b.weight_kg) * (1 + parseInt(b.reps) / 30) : 0
        return rm > bRm ? st : b
      }, null)
      if (top) bestSet = { weight: parseFloat(top.weight_kg), reps: parseInt(top.reps) }
    }
    if (ex.maxWeight > maxWeight) maxWeight = ex.maxWeight
    history.push({ date: session.date, best1RM: ex.best1RM, maxWeight: ex.maxWeight })
  }

  let evolutionPct = null
  let evolutionKg = null
  if (history.length >= 2) {
    const first = history[0].best1RM
    const last = history[history.length - 1].best1RM
    if (first > 0) {
      evolutionKg = last - first
      evolutionPct = (evolutionKg / first) * 100
    }
  }

  return { best1RM, maxWeight, bestSet, totalVolume, totalSets, evolutionPct, evolutionKg, history }
}

// ── Composable ──────────────────────────────────────────────────────────────

export function useCompareData() {
  async function loadAllUsers() {
    if (usersListLoaded) return
    const users = await listUsers()
    allUsers.value = users ?? []
    usersListLoaded = true
  }

  async function loadUserData(username) {
    if (usersDataMap.value[username]?.loaded) return
    if (loadingSet.has(username)) return

    loadingSet.add(username)
    usersDataMap.value = {
      ...usersDataMap.value,
      [username]: { sessions: [], scans: [], loading: true, loaded: false, error: null },
    }

    try {
      const [rawSets, rawScans] = await Promise.all([
        getWorkoutSetsForUser(username),
        getInbodyScansForUser(username),
      ])
      usersDataMap.value = {
        ...usersDataMap.value,
        [username]: {
          sessions: parseSessionsFromRows(rawSets ?? []),
          scans: parseScans(rawScans ?? []),
          loading: false,
          loaded: true,
          error: null,
        },
      }
    } catch (e) {
      console.warn('Failed to load data for', username, e)
      usersDataMap.value = {
        ...usersDataMap.value,
        [username]: { sessions: [], scans: [], loading: false, loaded: false, error: e.message },
      }
    } finally {
      loadingSet.delete(username)
    }
  }

  function reset() {
    allUsers.value = []
    usersDataMap.value = {}
    loadingSet = new Set()
    usersListLoaded = false
  }

  return {
    allUsers,
    usersDataMap,
    loadAllUsers,
    loadUserData,
    reset,
  }
}
