import { ref, computed } from 'vue'
import Papa from 'papaparse'
import { parseFrenchDate } from '../utils/dateUtils'
import { getMeasurements, importMeasurements, clearMeasurements } from '../api/client'

const rawRows = ref([])
const loaded = ref(false)
const loading = ref(false)
const apiError = ref(null)
const initPromise = ref(null)

const METRIC_LABELS = {
  weight_kg:        'Poids (kg)',
  fat_percent:      'Taux de graisse (%)',
  neck_cm:          'Cou (cm)',
  shoulder_cm:      'Épaules (cm)',
  chest_cm:         'Poitrine (cm)',
  left_bicep_cm:    'Biceps gauche (cm)',
  right_bicep_cm:   'Biceps droit (cm)',
  left_forearm_cm:  'Avant-bras gauche (cm)',
  right_forearm_cm: 'Avant-bras droit (cm)',
  abdomen_cm:       'Abdomen (cm)',
  waist_cm:         'Tour de taille (cm)',
  hips_cm:          'Hanches (cm)',
  left_thigh_cm:    'Cuisse gauche (cm)',
  right_thigh_cm:   'Cuisse droite (cm)',
  left_calf_cm:     'Mollet gauche (cm)',
  right_calf_cm:    'Mollet droit (cm)',
}
const METRIC_KEYS = Object.keys(METRIC_LABELS)

async function loadFromAPI() {
  loading.value = true
  apiError.value = null
  try {
    const rows = await getMeasurements()
    if (rows && rows.length > 0) {
      rawRows.value = rows
      loaded.value = true
    }
  } catch (e) {
    apiError.value = e.message
    console.warn('Failed to load measurements from API', e)
  } finally {
    loading.value = false
  }
}

async function clearData() {
  await clearMeasurements()
  rawRows.value = []
  loaded.value = false
}

function reset() {
  rawRows.value = []
  loaded.value = false
  apiError.value = null
  initPromise.value = null
}

function importCSV(file, replace = false) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          if (replace) {
            await clearMeasurements()
            rawRows.value = []
          }

          const rows = results.data.map(row => ({
            date:             parseFrenchDate(row.date)?.toISOString() ?? null,
            weight_kg:        row.weight_kg !== '' && row.weight_kg != null ? row.weight_kg : null,
            fat_percent:      row.fat_percent !== '' && row.fat_percent != null ? row.fat_percent : null,
            neck_cm:          row.neck_cm !== '' && row.neck_cm != null ? row.neck_cm : null,
            shoulder_cm:      row.shoulder_cm !== '' && row.shoulder_cm != null ? row.shoulder_cm : null,
            chest_cm:         row.chest_cm !== '' && row.chest_cm != null ? row.chest_cm : null,
            left_bicep_cm:    row.left_bicep_cm !== '' && row.left_bicep_cm != null ? row.left_bicep_cm : null,
            right_bicep_cm:   row.right_bicep_cm !== '' && row.right_bicep_cm != null ? row.right_bicep_cm : null,
            left_forearm_cm:  row.left_forearm_cm !== '' && row.left_forearm_cm != null ? row.left_forearm_cm : null,
            right_forearm_cm: row.right_forearm_cm !== '' && row.right_forearm_cm != null ? row.right_forearm_cm : null,
            abdomen_cm:       row.abdomen_cm !== '' && row.abdomen_cm != null ? row.abdomen_cm : null,
            waist_cm:         row.waist_cm !== '' && row.waist_cm != null ? row.waist_cm : null,
            hips_cm:          row.hips_cm !== '' && row.hips_cm != null ? row.hips_cm : null,
            left_thigh_cm:    row.left_thigh_cm !== '' && row.left_thigh_cm != null ? row.left_thigh_cm : null,
            right_thigh_cm:   row.right_thigh_cm !== '' && row.right_thigh_cm != null ? row.right_thigh_cm : null,
            left_calf_cm:     row.left_calf_cm !== '' && row.left_calf_cm != null ? row.left_calf_cm : null,
            right_calf_cm:    row.right_calf_cm !== '' && row.right_calf_cm != null ? row.right_calf_cm : null,
          })).filter(r => r.date !== null)

          const result = await importMeasurements(rows)

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
  if (!initPromise.value) initPromise.value = loadFromAPI()
  return initPromise.value
}

export function useMeasurementData() {
  ensureInit()

  // Les dates viennent de Postgres en ISO 8601
  const measurements = computed(() => {
    return rawRows.value
      .map(row => {
        const date = row.date ? new Date(row.date) : null
        if (!date) return null
        const entry = { date }
        for (const key of METRIC_KEYS) {
          const val = parseFloat(row[key])
          entry[key] = isNaN(val) ? null : val
        }
        return entry
      })
      .filter(Boolean)
      .sort((a, b) => a.date - b.date)
  })

  const availableMetrics = computed(() => {
    return METRIC_KEYS.filter(key =>
      measurements.value.some(m => m[key] !== null)
    )
  })

  function getMetricSeries(metricKey) {
    return measurements.value
      .filter(m => m[metricKey] !== null)
      .map(m => ({ date: m.date, value: m[metricKey] }))
  }

  return {
    rawRows, loaded, loading, apiError,
    measurements, availableMetrics, getMetricSeries,
    importCSV, clearData, reset, load: loadFromAPI,
    METRIC_LABELS, METRIC_KEYS,
  }
}
