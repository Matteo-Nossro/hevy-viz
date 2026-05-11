import { ref, computed } from 'vue'
import Papa from 'papaparse'
import { parseFrenchDate, getWeekKey, getMonthKey, getDayKey, getWeekStart } from '../utils/dateUtils'
import { getWorkoutSets, importWorkoutSets, clearWorkoutSets } from '../api/client'
import { getMuscleGroups, MUSCLE_GROUPS, unmappedExercises } from '../config/muscleMapping'
import { useExerciseMapping } from './useExerciseMapping'
import { normalizeExerciseName } from '../config/exerciseNormalization'

const WORKING_SET_TYPES = ['normal', 'failure', 'dropset']

// Singleton state
const rawRows = ref([])
const loaded = ref(false)
const loading = ref(false)
const apiError = ref(null)
const initPromise = ref(null)

const { customMapping } = useExerciseMapping()

async function loadFromAPI() {
  loading.value = true
  apiError.value = null
  try {
    const rows = await getWorkoutSets()
    if (rows && rows.length > 0) {
      rawRows.value = rows
      loaded.value = true
    }
  } catch (e) {
    apiError.value = e.message
    console.warn('Failed to load workout sets from API', e)
  } finally {
    loading.value = false
  }
}

async function clearData() {
  await clearWorkoutSets()
  rawRows.value = []
  loaded.value = false
}

function reset() {
  rawRows.value = []
  loaded.value = false
  apiError.value = null
  initPromise.value = null
}

/**
 * Import CSV : parse côté frontend (PapaParse + parseFrenchDate),
 * convertit en ISO strings, envoie en batch via RPC PostgREST.
 * Retourne { added, duplicates, total }.
 */
function importCSV(file, replace = false) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (replace) {
            await clearWorkoutSets()
            rawRows.value = []
          }

          const rows = results.data.map(row => ({
            title:            row.title || '',
            start_time:       parseFrenchDate(row.start_time)?.toISOString() ?? null,
            end_time:         parseFrenchDate(row.end_time)?.toISOString() ?? null,
            description:      row.description || null,
            exercise_title:   normalizeExerciseName(row.exercise_title || ''),
            superset_id:      row.superset_id || null,
            exercise_notes:   row.exercise_notes || null,
            set_index:        parseInt(row.set_index) || 0,
            set_type:         row.set_type || null,
            weight_kg:        row.weight_kg !== '' && row.weight_kg != null ? row.weight_kg : null,
            reps:             row.reps !== '' && row.reps != null ? row.reps : null,
            distance_km:      row.distance_km !== '' && row.distance_km != null ? row.distance_km : null,
            duration_seconds: row.duration_seconds !== '' && row.duration_seconds != null ? row.duration_seconds : null,
            rpe:              row.rpe !== '' && row.rpe != null ? row.rpe : null,
          })).filter(r => r.start_time !== null)

          const result = await importWorkoutSets(rows)

          // Recharge depuis l'API pour avoir l'état canonique de la BDD
          await loadFromAPI()
          loaded.value = true

          resolve({
            added:      result?.added ?? rows.length,
            duplicates: result?.duplicates ?? 0,
            total:      result?.total ?? rows.length,
          })
        } catch (e) {
          reject(e)
        }
      },
      error: reject,
    })
  })
}

function ensureInit() {
  if (!initPromise.value) {
    initPromise.value = loadFromAPI()
  }
  return initPromise.value
}

export function useWorkoutData() {
  ensureInit()

  // Parse rows — les dates viennent de Postgres en ISO 8601, new Date() les comprend
  const parsedRows = computed(() => {
    return rawRows.value.map(row => ({
      title:           row.title || '',
      startTime:       row.start_time ? new Date(row.start_time) : null,
      endTime:         row.end_time   ? new Date(row.end_time)   : null,
      exerciseTitle:   normalizeExerciseName(row.exercise_title || ''),
      supersetId:      row.superset_id || null,
      exerciseNotes:   row.exercise_notes || '',
      setIndex:        parseInt(row.set_index) || 0,
      setType:         (row.set_type || '').toLowerCase(),
      weightKg:        parseFloat(row.weight_kg) || 0,
      reps:            parseInt(row.reps) || 0,
      distanceKm:      parseFloat(row.distance_km) || 0,
      durationSeconds: parseInt(row.duration_seconds) || 0,
      rpe:             parseFloat(row.rpe) || null,
    })).filter(r => r.startTime !== null)
  })

  // Sessions
  const sessions = computed(() => {
    const map = new Map()
    for (const row of parsedRows.value) {
      const key = `${row.title}__${row.startTime.getTime()}`
      if (!map.has(key)) {
        map.set(key, {
          title: row.title,
          date: row.startTime,
          endDate: row.endTime,
          duration: row.endTime && row.startTime
            ? Math.round((row.endTime - row.startTime) / 60000)
            : 0,
          exercises: new Map(),
        })
      }
      const session = map.get(key)
      if (!session.exercises.has(row.exerciseTitle)) {
        session.exercises.set(row.exerciseTitle, [])
      }
      session.exercises.get(row.exerciseTitle).push(row)
    }

    return Array.from(map.values()).map(s => {
      const exerciseList = Array.from(s.exercises.entries()).map(([title, sets]) => {
        sets.sort((a, b) => a.setIndex - b.setIndex)
        const workingSets = sets.filter(st => WORKING_SET_TYPES.includes(st.setType))
        const volume = workingSets.reduce((acc, st) => acc + st.weightKg * st.reps, 0)
        const validForRM = workingSets.filter(st => st.weightKg > 0 && st.reps > 0)
        const best1RM = Math.max(0, ...validForRM.map(st => st.weightKg * (1 + st.reps / 30)))
        const maxWeight = Math.max(0, ...validForRM.map(st => st.weightKg))
        const bestSet = validForRM.sort((a, b) => (b.weightKg * (1 + b.reps / 30)) - (a.weightKg * (1 + a.reps / 30)))[0]

        return {
          title,
          sets,
          workingSets,
          volume,
          best1RM,
          maxWeight,
          bestSet,
          muscleGroups: getMuscleGroups(title, customMapping.value),
        }
      })

      const totalVolume = exerciseList.reduce((a, e) => a + e.volume, 0)
      const allMuscles = new Set()
      exerciseList.forEach(e => e.muscleGroups.forEach(m => allMuscles.add(m)))

      return {
        title: s.title,
        date: s.date,
        endDate: s.endDate,
        duration: s.duration,
        exercises: exerciseList,
        totalVolume,
        muscleGroups: Array.from(allMuscles),
        dayKey: getDayKey(s.date),
      }
    }).sort((a, b) => a.date - b.date)
  })

  const sessionsReverse = computed(() => [...sessions.value].reverse())

  const summary = computed(() => {
    if (!sessions.value.length) return null
    const dates = sessions.value.map(s => s.date)
    const exerciseNames = new Set()
    sessions.value.forEach(s => s.exercises.forEach(e => exerciseNames.add(e.title)))
    return {
      totalSessions: sessions.value.length,
      startDate: new Date(Math.min(...dates)),
      endDate: new Date(Math.max(...dates)),
      uniqueExercises: exerciseNames.size,
    }
  })

  const lastDataDate = computed(() => {
    if (!sessions.value.length) return new Date()
    return sessions.value[sessions.value.length - 1].date
  })

  const exerciseNames = computed(() => {
    const names = new Set()
    parsedRows.value.forEach(r => names.add(r.exerciseTitle))
    return Array.from(names).sort()
  })

  function filterByPeriod(sessionsArr, period, refDate = null) {
    if (period === 'all') return sessionsArr
    const ref = refDate || lastDataDate.value
    let cutoff
    if (period === '1m') cutoff = new Date(ref.getFullYear(), ref.getMonth() - 1, ref.getDate())
    else if (period === '3m') cutoff = new Date(ref.getFullYear(), ref.getMonth() - 3, ref.getDate())
    else if (period === '6m') cutoff = new Date(ref.getFullYear(), ref.getMonth() - 6, ref.getDate())
    else if (period === '1y') cutoff = new Date(ref.getFullYear() - 1, ref.getMonth(), ref.getDate())
    else return sessionsArr
    return sessionsArr.filter(s => s.date >= cutoff)
  }

  function volumeByWeek(period = 'all') {
    const filtered = filterByPeriod(sessions.value, period)
    const map = new Map()
    for (const s of filtered) {
      const wk = getWeekKey(s.date)
      map.set(wk, (map.get(wk) || 0) + s.totalVolume)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, volume]) => ({ week, volume }))
  }

  const volumeByMonth = computed(() => {
    const map = new Map()
    for (const s of sessions.value) {
      const mk = getMonthKey(s.date)
      map.set(mk, (map.get(mk) || 0) + s.totalVolume)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, volume]) => ({ month, volume }))
  })

  function frequencyByWeek(period = 'all') {
    const filtered = filterByPeriod(sessions.value, period)
    const map = new Map()
    for (const s of filtered) {
      const wk = getWeekKey(s.date)
      map.set(wk, (map.get(wk) || 0) + 1)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, count]) => ({ week, count }))
  }

  function avgDuration(period = 'all') {
    const filtered = filterByPeriod(sessions.value, period)
    if (!filtered.length) return 0
    const total = filtered.reduce((a, s) => a + s.duration, 0)
    return Math.round(total / filtered.length)
  }

  function topExercises(n = 5, period = 'all') {
    const filtered = filterByPeriod(sessions.value, period)
    const map = new Map()
    for (const s of filtered) {
      for (const ex of s.exercises) {
        const count = ex.workingSets.length
        map.set(ex.title, (map.get(ex.title) || 0) + count)
      }
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }))
  }

  function setsByMuscleGroup(startDate = null, endDate = null) {
    let filtered = sessions.value
    if (startDate) filtered = filtered.filter(s => s.date >= startDate)
    if (endDate) filtered = filtered.filter(s => s.date <= endDate)

    const map = {}
    MUSCLE_GROUPS.forEach(g => map[g] = 0)

    for (const s of filtered) {
      for (const ex of s.exercises) {
        const count = ex.workingSets.length
        for (const mg of ex.muscleGroups) {
          if (map[mg] !== undefined) map[mg] += count
        }
      }
    }
    return map
  }

  function setsByMuscleGroupWithDelta(startDate, endDate) {
    const current = setsByMuscleGroup(startDate, endDate)
    if (!startDate || !endDate) {
      return Object.fromEntries(MUSCLE_GROUPS.map(g => [g, { current: current[g], delta: 0 }]))
    }
    const span = endDate - startDate
    const prevStart = new Date(startDate.getTime() - span)
    const prevEnd = new Date(startDate.getTime() - 1)
    const prev = setsByMuscleGroup(prevStart, prevEnd)
    const result = {}
    for (const g of MUSCLE_GROUPS) {
      result[g] = { current: current[g], delta: current[g] - prev[g] }
    }
    return result
  }

  function muscleRepartition(startDate, endDate) {
    let filtered = sessions.value
    if (startDate) filtered = filtered.filter(s => s.date >= startDate)
    if (endDate) filtered = filtered.filter(s => s.date <= endDate)

    const map = {}
    MUSCLE_GROUPS.forEach(g => map[g] = 0)
    let total = 0

    for (const s of filtered) {
      for (const ex of s.exercises) {
        const vol = ex.volume
        const groups = ex.muscleGroups
        const share = vol / groups.length
        for (const mg of groups) {
          if (map[mg] !== undefined) { map[mg] += share; total += share }
        }
      }
    }

    if (total === 0) return map
    for (const g of MUSCLE_GROUPS) {
      map[g] = Math.round((map[g] / total) * 1000) / 10
    }
    return map
  }

  function weeklyHeatmap(weekStartDate) {
    const ws = getWeekStart(weekStartDate)
    const days = []
    for (let i = 0; i < 7; i++) {
      days.push(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i))
    }

    const result = {}
    MUSCLE_GROUPS.forEach(g => { result[g] = [0, 0, 0, 0, 0, 0, 0] })

    for (let i = 0; i < days.length; i++) {
      const dk = getDayKey(days[i])
      const daySessions = sessions.value.filter(s => s.dayKey === dk)
      for (const s of daySessions) {
        for (const ex of s.exercises) {
          const count = ex.workingSets.length
          for (const mg of ex.muscleGroups) {
            if (result[mg]) result[mg][i] += count
          }
        }
      }
    }

    return { days, data: result }
  }

  function exerciseProgression(exerciseTitle, mode = 'session') {
    const sessionsWithExercise = sessions.value
      .map(s => {
        const ex = s.exercises.find(e => e.title === exerciseTitle)
        if (!ex) return null
        const workingSets = ex.workingSets
        const validForRM = workingSets.filter(st => st.weightKg > 0 && st.reps > 0)
        const volume = workingSets.reduce((a, st) => a + st.weightKg * st.reps, 0)
        const best1RM = Math.max(0, ...validForRM.map(st => st.weightKg * (1 + st.reps / 30)))
        const maxWeight = Math.max(0, ...validForRM.map(st => st.weightKg))
        const bestSet = validForRM.sort((a, b) => (b.weightKg * (1 + b.reps / 30)) - (a.weightKg * (1 + a.reps / 30)))[0]
        return {
          date: s.date,
          volume,
          best1RM: Math.round(best1RM * 10) / 10,
          maxWeight,
          bestWeight: bestSet?.weightKg || 0,
          bestReps: bestSet?.reps || 0,
          sets: workingSets,
        }
      })
      .filter(Boolean)

    let history = sessionsWithExercise

    if (mode === 'week') {
      const weekMap = new Map()
      for (const h of sessionsWithExercise) {
        const wk = getWeekKey(h.date)
        const ws = getWeekStart(h.date)
        if (!weekMap.has(wk)) {
          weekMap.set(wk, { date: ws, volume: 0, best1RM: 0, maxWeight: 0, bestWeight: 0, bestReps: 0, sets: [] })
        }
        const w = weekMap.get(wk)
        w.volume += h.volume
        if (h.best1RM > w.best1RM) { w.best1RM = h.best1RM; w.bestWeight = h.bestWeight; w.bestReps = h.bestReps }
        if (h.maxWeight > w.maxWeight) w.maxWeight = h.maxWeight
        w.sets.push(...h.sets)
      }
      history = Array.from(weekMap.values()).sort((a, b) => a.date - b.date)
    }

    const top5 = [...sessionsWithExercise].sort((a, b) => b.best1RM - a.best1RM).slice(0, 5)
    const bestVolumeSession = sessionsWithExercise.length
      ? [...sessionsWithExercise].sort((a, b) => b.volume - a.volume)[0]
      : null

    return { history, top5, bestVolumeSession }
  }

  const personalRecords = computed(() => {
    const records = new Map()

    for (const s of sessions.value) {
      for (const ex of s.exercises) {
        if (!ex.workingSets.length) continue
        if (!records.has(ex.title)) {
          records.set(ex.title, {
            exercise: ex.title,
            muscleGroups: ex.muscleGroups,
            best1RM: 0, best1RMDate: null, best1RMSet: null,
            maxWeight: 0, maxWeightDate: null, maxWeightReps: 0,
            maxVolume: 0, maxVolumeDate: null,
            totalSets: 0,
          })
        }
        const r = records.get(ex.title)
        r.totalSets += ex.workingSets.length

        if (ex.best1RM > r.best1RM) { r.best1RM = ex.best1RM; r.best1RMDate = s.date; r.best1RMSet = ex.bestSet }
        if (ex.maxWeight > r.maxWeight) {
          r.maxWeight = ex.maxWeight; r.maxWeightDate = s.date
          const setsAtMax = ex.workingSets.filter(st => st.weightKg === ex.maxWeight)
          r.maxWeightReps = Math.max(0, ...setsAtMax.map(st => st.reps))
        }
        if (ex.volume > r.maxVolume) { r.maxVolume = ex.volume; r.maxVolumeDate = s.date }
      }
    }

    return Array.from(records.values()).sort((a, b) => b.best1RM - a.best1RM)
  })

  function recordsInSession(session) {
    const broken = {}
    if (!session) return broken

    for (const ex of session.exercises) {
      if (!ex.workingSets.length) continue
      const prevSessions = sessions.value.filter(s => s.date < session.date)
      let prevBest1RM = 0, prevMaxWeight = 0, prevMaxVolume = 0

      for (const ps of prevSessions) {
        const pex = ps.exercises.find(e => e.title === ex.title)
        if (!pex) continue
        if (pex.best1RM > prevBest1RM) prevBest1RM = pex.best1RM
        if (pex.maxWeight > prevMaxWeight) prevMaxWeight = pex.maxWeight
        if (pex.volume > prevMaxVolume) prevMaxVolume = pex.volume
      }

      const reasons = []
      if (ex.best1RM > prevBest1RM && prevBest1RM > 0) reasons.push('1RM')
      if (ex.maxWeight > prevMaxWeight && prevMaxWeight > 0) reasons.push('Poids max')
      if (ex.volume > prevMaxVolume && prevMaxVolume > 0) reasons.push('Volume')
      if (reasons.length) broken[ex.title] = reasons
    }

    return broken
  }

  const sessionsWithRecords = computed(() => {
    const result = []
    const bestSoFar = new Map()

    for (const s of sessions.value) {
      const broken = {}
      for (const ex of s.exercises) {
        if (!ex.workingSets.length) continue
        if (!bestSoFar.has(ex.title)) {
          bestSoFar.set(ex.title, { best1RM: 0, maxWeight: 0, maxVolume: 0 })
        }
        const prev = bestSoFar.get(ex.title)
        const reasons = []
        if (ex.best1RM > prev.best1RM && prev.best1RM > 0) reasons.push('1RM')
        if (ex.maxWeight > prev.maxWeight && prev.maxWeight > 0) reasons.push('Poids max')
        if (ex.volume > prev.maxVolume && prev.maxVolume > 0) reasons.push('Volume')
        if (reasons.length) broken[ex.title] = reasons

        if (ex.best1RM > prev.best1RM) prev.best1RM = ex.best1RM
        if (ex.maxWeight > prev.maxWeight) prev.maxWeight = ex.maxWeight
        if (ex.volume > prev.maxVolume) prev.maxVolume = ex.volume
      }
      result.push({ session: s, recordsBroken: broken })
    }
    return result
  })

  const badges = computed(() => {
    const list = []
    const all = sessions.value

    const milestones = [
      { count: 1,   name: 'Première séance', icon: '🌱', desc: 'Le voyage commence' },
      { count: 10,  name: '10 séances',      icon: '🔥', desc: 'On entre dans le rythme' },
      { count: 50,  name: '50 séances',      icon: '💪', desc: 'Régularité confirmée' },
      { count: 100, name: '100 séances',     icon: '⭐', desc: 'Centurion' },
      { count: 200, name: '200 séances',     icon: '🏆', desc: 'Athlète sérieux' },
      { count: 500, name: '500 séances',     icon: '👑', desc: 'Légende' },
    ]
    for (const m of milestones) {
      if (all.length >= m.count) {
        list.push({ id: `sessions-${m.count}`, ...m, unlocked: true, date: all[m.count - 1].date, progress: 1 })
      } else if (all.length > 0) {
        list.push({ id: `sessions-${m.count}`, ...m, unlocked: false, progress: all.length / m.count, progressLabel: `${all.length} / ${m.count}` })
      }
    }

    const totalVolume = all.reduce((a, s) => a + s.totalVolume, 0)
    const volumeMilestones = [
      { vol: 100000,  name: '100t levés',  icon: '🪨', desc: 'Volume cumulé : 100 tonnes' },
      { vol: 500000,  name: '500t levés',  icon: '🗿', desc: 'Volume cumulé : 500 tonnes' },
      { vol: 1000000, name: '1000t levés', icon: '🏔️', desc: 'Volume cumulé : 1 million de kg' },
    ]
    for (const m of volumeMilestones) {
      if (totalVolume >= m.vol) {
        list.push({ id: `vol-${m.vol}`, ...m, unlocked: true, progress: 1 })
      } else if (totalVolume > 0) {
        list.push({ id: `vol-${m.vol}`, ...m, unlocked: false, progress: totalVolume / m.vol, progressLabel: `${Math.round(totalVolume / 1000)} / ${m.vol / 1000} t` })
      }
    }

    if (all.length > 0) {
      const weeks = new Set(all.map(s => getWeekKey(s.date)))
      const sortedWeeks = Array.from(weeks).sort()
      let currentStreak = 1, maxStreak = 1
      for (let i = 1; i < sortedWeeks.length; i++) {
        const [y1, w1] = sortedWeeks[i - 1].split('-W').map(Number)
        const [y2, w2] = sortedWeeks[i].split('-W').map(Number)
        const diff = (y2 - y1) * 52 + (w2 - w1)
        if (diff === 1) { currentStreak++; if (currentStreak > maxStreak) maxStreak = currentStreak }
        else currentStreak = 1
      }
      const streakMilestones = [
        { count: 4,  name: 'Régulier 4 sem',    icon: '📆', desc: '4 semaines consécutives' },
        { count: 8,  name: 'Discipliné 8 sem',  icon: '🎯', desc: '8 semaines consécutives' },
        { count: 12, name: 'Trimestre complet', icon: '⚡', desc: '12 semaines consécutives' },
        { count: 26, name: 'Semestre complet',  icon: '💎', desc: '26 semaines consécutives' },
        { count: 52, name: 'Année complète',    icon: '🌟', desc: '52 semaines consécutives' },
      ]
      for (const m of streakMilestones) {
        if (maxStreak >= m.count) {
          list.push({ id: `streak-${m.count}`, ...m, unlocked: true, progress: 1 })
        } else {
          list.push({ id: `streak-${m.count}`, ...m, unlocked: false, progress: maxStreak / m.count, progressLabel: `${maxStreak} / ${m.count}` })
        }
      }
    }

    const allMaxWeights = []
    for (const s of all) {
      for (const ex of s.exercises) {
        if (ex.maxWeight > 0) allMaxWeights.push(ex.maxWeight)
      }
    }
    const maxEver = allMaxWeights.length ? Math.max(...allMaxWeights) : 0
    const weightMilestones = [
      { kg: 50,  name: '50 kg',  icon: '🥉' },
      { kg: 80,  name: '80 kg',  icon: '🥈' },
      { kg: 100, name: '100 kg', icon: '🥇' },
      { kg: 150, name: '150 kg', icon: '💯' },
      { kg: 200, name: '200 kg', icon: '🚀' },
    ]
    for (const m of weightMilestones) {
      const desc = `Premier exercice à ${m.kg} kg`
      if (maxEver >= m.kg) {
        list.push({ id: `weight-${m.kg}`, name: m.name, icon: m.icon, desc, unlocked: true, progress: 1 })
      } else if (allMaxWeights.length) {
        list.push({ id: `weight-${m.kg}`, name: m.name, icon: m.icon, desc, unlocked: false, progress: maxEver / m.kg, progressLabel: `${maxEver} / ${m.kg} kg` })
      }
    }

    return list
  })

  function monthlyReport(year, month) {
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0, 23, 59, 59)
    const prevStart = new Date(year, month - 1, 1)
    const prevEnd = new Date(year, month, 0, 23, 59, 59)
    const yearAgoStart = new Date(year - 1, month, 1)
    const yearAgoEnd = new Date(year - 1, month + 1, 0, 23, 59, 59)

    const monthSessions = sessions.value.filter(s => s.date >= start && s.date <= end)
    const prevSessions = sessions.value.filter(s => s.date >= prevStart && s.date <= prevEnd)
    const yearAgoSessions = sessions.value.filter(s => s.date >= yearAgoStart && s.date <= yearAgoEnd)

    const totalVolume = monthSessions.reduce((a, s) => a + s.totalVolume, 0)
    const prevVolume = prevSessions.reduce((a, s) => a + s.totalVolume, 0)
    const yearAgoVolume = yearAgoSessions.reduce((a, s) => a + s.totalVolume, 0)
    const volumeDelta = prevVolume > 0 ? ((totalVolume - prevVolume) / prevVolume * 100) : 0
    const yearDelta = yearAgoVolume > 0 ? ((totalVolume - yearAgoVolume) / yearAgoVolume * 100) : null

    const totalDuration = monthSessions.reduce((a, s) => a + s.duration, 0)
    const totalSets = monthSessions.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.workingSets.length, 0), 0)

    const weekMap = new Map()
    for (const s of monthSessions) {
      const wk = getWeekKey(s.date)
      weekMap.set(wk, (weekMap.get(wk) || 0) + s.totalVolume)
    }
    const weeklyVolume = Array.from(weekMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([week, volume]) => ({ week, volume }))

    const weekFreq = new Map()
    for (const s of monthSessions) {
      const wk = getWeekKey(s.date)
      weekFreq.set(wk, (weekFreq.get(wk) || 0) + 1)
    }
    const weeklyFreq = Array.from(weekFreq.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([week, count]) => ({ week, count }))

    const muscleVolMap = {}
    MUSCLE_GROUPS.forEach(g => muscleVolMap[g] = 0)
    for (const s of monthSessions) {
      for (const ex of s.exercises) {
        const share = ex.volume / Math.max(1, ex.muscleGroups.length)
        for (const mg of ex.muscleGroups) {
          if (muscleVolMap[mg] !== undefined) muscleVolMap[mg] += share
        }
      }
    }
    const totalMuscleVol = Object.values(muscleVolMap).reduce((a, v) => a + v, 0)
    const muscleRepart = MUSCLE_GROUPS
      .map(g => ({ group: g, volume: muscleVolMap[g], pct: totalMuscleVol > 0 ? (muscleVolMap[g] / totalMuscleVol * 100) : 0 }))
      .filter(m => m.volume > 0)
      .sort((a, b) => b.volume - a.volume)

    const recordsInMonth = []
    const bestSoFar = new Map()
    for (const s of sessions.value) {
      for (const ex of s.exercises) {
        if (!ex.workingSets.length) continue
        if (!bestSoFar.has(ex.title)) bestSoFar.set(ex.title, { best1RM: 0, maxWeight: 0 })
        const prev = bestSoFar.get(ex.title)
        if (s.date >= start && s.date <= end) {
          if (ex.best1RM > prev.best1RM && prev.best1RM > 0) recordsInMonth.push({ type: '1RM', exercise: ex.title, value: Math.round(ex.best1RM * 10) / 10, date: s.date })
          if (ex.maxWeight > prev.maxWeight && prev.maxWeight > 0) recordsInMonth.push({ type: 'Poids max', exercise: ex.title, value: ex.maxWeight, date: s.date })
        }
        if (ex.best1RM > prev.best1RM) prev.best1RM = ex.best1RM
        if (ex.maxWeight > prev.maxWeight) prev.maxWeight = ex.maxWeight
      }
    }

    let bestPerf = null
    for (const s of monthSessions) {
      for (const ex of s.exercises) {
        if (ex.best1RM > (bestPerf?.best1RM || 0)) bestPerf = { exercise: ex.title, best1RM: ex.best1RM, date: s.date }
      }
    }

    const exVolMap = new Map()
    for (const s of monthSessions) {
      for (const ex of s.exercises) exVolMap.set(ex.title, (exVolMap.get(ex.title) || 0) + ex.volume)
    }
    const top3 = Array.from(exVolMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name, volume]) => ({ name, volume }))

    return {
      sessionCount: monthSessions.length,
      prevSessionCount: prevSessions.length,
      totalSets, totalVolume, prevVolume, yearAgoVolume,
      volumeDelta: Math.round(volumeDelta * 10) / 10,
      yearDelta: yearDelta !== null ? Math.round(yearDelta * 10) / 10 : null,
      avgFrequency: weekMap.size > 0 ? Math.round(monthSessions.length / weekMap.size * 10) / 10 : 0,
      totalDuration,
      topMuscle: muscleRepart[0] || null,
      bestPerf, weeklyVolume, weeklyFreq, muscleRepart, recordsInMonth, top3, monthSessions,
    }
  }

  const sessionsByDay = computed(() => {
    const map = new Map()
    for (const s of sessions.value) {
      if (!map.has(s.dayKey)) map.set(s.dayKey, [])
      map.get(s.dayKey).push(s)
    }
    return map
  })

  const unmappedExerciseNames = computed(() => {
    return unmappedExercises(exerciseNames.value, customMapping.value)
  })

  return {
    rawRows, loaded, loading, apiError,
    sessions, sessionsReverse, summary, lastDataDate, exerciseNames,
    unmappedExerciseNames, volumeByWeek, volumeByMonth, frequencyByWeek,
    avgDuration, topExercises, setsByMuscleGroup, setsByMuscleGroupWithDelta,
    muscleRepartition, weeklyHeatmap, exerciseProgression, monthlyReport,
    sessionsByDay, sessionsWithRecords, personalRecords, recordsInSession,
    badges, importCSV, clearData, filterByPeriod, reset, load: loadFromAPI,
  }
}
