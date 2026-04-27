import { ref, computed } from 'vue'
import { getInbodyScans, addInbodyScan, updateInbodyScan, deleteInbodyScan } from '../api/client'
import { INBODY_FIELDS } from '../config/inbodyFields'

// Singleton state — isolé par user via RLS (reset() appelé au changement de user)
const rawScans = ref([])
const loading = ref(false)
const error = ref(null)
const initPromise = ref(null)

const NUMERIC_KEYS = INBODY_FIELDS.map(f => f.key)

async function fetchScans() {
  loading.value = true
  error.value = null
  try {
    const rows = await getInbodyScans()
    rawScans.value = rows ?? []
  } catch (e) {
    error.value = e.message
    console.warn('Failed to load inbody scans', e)
  } finally {
    loading.value = false
  }
}

function ensureInit() {
  if (!initPromise.value) initPromise.value = fetchScans()
  return initPromise.value
}

function reset() {
  rawScans.value = []
  error.value = null
  initPromise.value = null
}

export function useInbodyData() {
  ensureInit()

  const scans = computed(() =>
    rawScans.value
      .map(row => {
        const scan = { id: row.id, scan_date: new Date(row.scan_date), notes: row.notes ?? '' }
        for (const key of NUMERIC_KEYS) {
          const v = parseFloat(row[key])
          scan[key] = isNaN(v) ? null : v
        }
        return scan
      })
      .sort((a, b) => a.scan_date - b.scan_date)
  )

  const latestScan = computed(() =>
    scans.value.length ? scans.value[scans.value.length - 1] : null
  )

  async function addScan(data) {
    const row = await addInbodyScan(data)
    if (row) rawScans.value = [...rawScans.value, row]
    return row
  }

  async function updateScan(id, data) {
    const row = await updateInbodyScan(id, data)
    if (row) {
      rawScans.value = rawScans.value.map(s => s.id === id ? row : s)
    }
    return row
  }

  async function deleteScan(id) {
    await deleteInbodyScan(id)
    rawScans.value = rawScans.value.filter(s => s.id !== id)
  }

  function getEvolution(fieldKey) {
    return scans.value
      .filter(s => s[fieldKey] !== null)
      .map(s => ({ date: s.scan_date, value: s[fieldKey] }))
  }

  function getDelta(fieldKey, idxA, idxB) {
    const a = scans.value[idxA]
    const b = scans.value[idxB]
    if (!a || !b || a[fieldKey] === null || b[fieldKey] === null) return null
    const abs = b[fieldKey] - a[fieldKey]
    const pct = a[fieldKey] !== 0 ? (abs / a[fieldKey]) * 100 : null
    return { abs, pct }
  }

  return {
    scans,
    latestScan,
    loading,
    error,
    fetchScans,
    addScan,
    updateScan,
    deleteScan,
    getEvolution,
    getDelta,
    reset,
    load: fetchScans,
  }
}
