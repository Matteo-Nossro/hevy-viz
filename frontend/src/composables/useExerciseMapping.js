import { ref } from 'vue'
import { getMappingOverrides, setMappingOverride, deleteMappingOverride } from '../api/client'

// Singleton state — format { exerciseName: [groupes] } identique à l'ancien IndexedDB
// pour que getMuscleGroups() fonctionne sans modification
const customMapping = ref({})
let initPromise = null

async function loadMapping() {
  try {
    const rows = await getMappingOverrides()
    customMapping.value = Object.fromEntries(
      rows.map(r => [r.exercise_title, r.muscle_groups])
    )
  } catch (e) {
    console.warn('Failed to load exercise mapping overrides', e)
  }
}

function ensureInit() {
  if (!initPromise) initPromise = loadMapping()
  return initPromise
}

function reset() {
  customMapping.value = {}
  initPromise = null
}

async function setMapping(exerciseName, groups) {
  try {
    await setMappingOverride(exerciseName, groups)
    customMapping.value = { ...customMapping.value, [exerciseName]: groups }
  } catch (e) {
    console.warn('Failed to save exercise mapping override', e)
    throw e
  }
}

async function removeMapping(exerciseName) {
  try {
    await deleteMappingOverride(exerciseName)
    const next = { ...customMapping.value }
    delete next[exerciseName]
    customMapping.value = next
  } catch (e) {
    console.warn('Failed to delete exercise mapping override', e)
    throw e
  }
}

export function useExerciseMapping() {
  ensureInit()
  return { customMapping, setMapping, removeMapping, reset, load: loadMapping }
}
