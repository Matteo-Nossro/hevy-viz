<script setup>
import { ref, computed } from 'vue'
import { formatDateFull } from '../utils/dateUtils'

const props = defineProps(['workout', 'measurement'])
const emit = defineEmits(['imported', 'go-exercises'])

const dragOver1 = ref(false)
const dragOver2 = ref(false)
const importing = ref(false)
const error = ref(null)
const lastResult = ref(null)
const replaceMode = ref(false)

// Bannière d'erreur API (remontée depuis les composables)
const apiError = computed(() => props.workout.apiError?.value || props.measurement.apiError?.value)

async function handleWorkoutFile(file) {
  if (!file) return
  importing.value = true
  error.value = null
  lastResult.value = null
  try {
    const result = await props.workout.importCSV(file, replaceMode.value)
    lastResult.value = { type: 'workout', ...result }
  } catch (e) {
    error.value = "Erreur lors de l'import workout : " + e.message
  } finally {
    importing.value = false
  }
}

async function handleMeasurementFile(file) {
  if (!file) return
  importing.value = true
  error.value = null
  lastResult.value = null
  try {
    const result = await props.measurement.importCSV(file, replaceMode.value)
    lastResult.value = { type: 'measurement', ...result }
  } catch (e) {
    error.value = "Erreur lors de l'import mesures : " + e.message
  } finally {
    importing.value = false
  }
}

function onDrop1(e) { dragOver1.value = false; const f = e.dataTransfer?.files[0]; if (f) handleWorkoutFile(f) }
function onDrop2(e) { dragOver2.value = false; const f = e.dataTransfer?.files[0]; if (f) handleMeasurementFile(f) }
function onFileInput1(e) { handleWorkoutFile(e.target.files[0]) }
function onFileInput2(e) { handleMeasurementFile(e.target.files[0]) }

async function clearAll() {
  if (!confirm('Effacer toutes les données de ce compte ?')) return
  importing.value = true
  try {
    await props.workout.clearData()
    await props.measurement.clearData()
    lastResult.value = null
  } catch (e) {
    error.value = "Erreur lors de la suppression : " + e.message
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="max-w-2xl mx-auto py-8 fade-in">
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
        style="background: var(--gradient-soft)">
        <svg viewBox="0 0 24 24" class="w-6 h-6 text-bg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 4v12m0 0l-4-4m4 4l4-4M4 20h16"/>
        </svg>
      </div>
      <h2 class="text-2xl font-semibold mb-2 tracking-tight">Importer vos données</h2>
      <p class="text-text-muted text-sm leading-relaxed">
        Exportez vos données depuis l'app Hevy, puis déposez les fichiers CSV ici.<br>
        Vos données sont stockées sur votre serveur personnel.
      </p>
    </div>

    <!-- Bannière erreur API avec bouton Réessayer -->
    <div v-if="apiError" class="soft-card p-4 mb-5 border-danger/30 bg-danger/5">
      <div class="flex items-start gap-3">
        <span class="text-base">⚠️</span>
        <div class="text-sm flex-1">
          <p class="font-medium text-danger mb-1">Erreur de connexion au serveur</p>
          <p class="text-text-muted text-xs">{{ apiError }}</p>
        </div>
      </div>
    </div>

    <!-- Mode replace toggle -->
    <div v-if="workout.loaded.value || measurement.loaded.value"
      class="soft-card p-4 mb-5 flex items-start gap-3">
      <div class="w-1 self-stretch rounded-full bg-accent flex-shrink-0"></div>
      <div class="flex-1">
        <div class="flex items-center justify-between gap-3 mb-1">
          <span class="text-sm font-medium">Mode d'import</span>
          <div class="pill-toggle">
            <button :class="{ active: !replaceMode }" @click="replaceMode = false">Ajout</button>
            <button :class="{ active: replaceMode }" @click="replaceMode = true">Remplacer</button>
          </div>
        </div>
        <p class="text-xs text-text-muted leading-relaxed">
          <template v-if="!replaceMode">
            Les nouvelles séances sont ajoutées, les doublons sont ignorés automatiquement.
          </template>
          <template v-else>
            Les données existantes seront supprimées en base puis remplacées par le nouveau fichier.
          </template>
        </p>
      </div>
    </div>

    <!-- Avertissement exercices non mappés -->
    <div v-if="workout.loaded.value && workout.unmappedExerciseNames.value.length"
      class="soft-card p-4 mb-5 border-warning/30 bg-warning/5">
      <div class="flex items-start gap-3">
        <span class="text-base">⚠️</span>
        <div class="text-sm flex-1 min-w-0">
          <p class="font-medium text-warning mb-1">
            {{ workout.unmappedExerciseNames.value.length }} exercice{{ workout.unmappedExerciseNames.value.length > 1 ? 's' : '' }} non reconnu{{ workout.unmappedExerciseNames.value.length > 1 ? 's' : '' }}
          </p>
          <div class="flex items-center justify-between gap-3 mb-2">
            <p class="text-text-muted text-xs leading-relaxed">
              Ces exercices apparaîtront sous le groupe « Autre ». Assignez-leur des groupes musculaires pour qu'ils apparaissent dans vos statistiques.
            </p>
            <button
              @click="emit('go-exercises')"
              class="btn btn-ghost text-xs px-2.5 py-1.5 flex-shrink-0 text-accent border-accent/30 hover:bg-accent-soft"
            >
              Mapper maintenant →
            </button>
          </div>
          <ul class="text-xs text-text-muted space-y-0.5">
            <li v-for="ex in workout.unmappedExerciseNames.value" :key="ex" class="font-mono">› {{ ex }}</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Résultat import -->
    <div v-if="lastResult" class="soft-card p-4 mb-5 border-success/30 bg-success/5">
      <div class="flex items-start gap-3">
        <span class="text-xl">✓</span>
        <div class="text-sm">
          <p class="font-medium text-success mb-0.5">Import réussi</p>
          <p class="text-text-muted text-xs">
            <span class="text-success font-mono">+{{ lastResult.added }}</span> ajout{{ lastResult.added !== 1 ? 's' : '' }}
            <template v-if="lastResult.duplicates > 0">
              · <span class="text-text-faint">{{ lastResult.duplicates }} doublon{{ lastResult.duplicates > 1 ? 's' : '' }} ignoré{{ lastResult.duplicates > 1 ? 's' : '' }}</span>
            </template>
            · {{ lastResult.total }} ligne{{ lastResult.total !== 1 ? 's' : '' }} au total
          </p>
        </div>
      </div>
    </div>

    <div v-if="error" class="soft-card p-3 mb-5 border-danger/30 bg-danger/5 text-danger text-sm">
      {{ error }}
    </div>

    <!-- Workout CSV -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium">workout_data.csv</label>
        <span v-if="!workout.loaded.value" class="text-xs text-text-faint">requis</span>
      </div>
      <div
        class="drop-zone rounded-xl p-8 text-center cursor-pointer"
        :class="{ 'drag-over': dragOver1, 'opacity-50 pointer-events-none': importing }"
        @dragover.prevent="dragOver1 = true"
        @dragleave="dragOver1 = false"
        @drop.prevent="onDrop1"
        @click="$refs.file1.click()"
      >
        <input ref="file1" type="file" accept=".csv" class="hidden" @change="onFileInput1" :disabled="importing">
        <div v-if="workout.loaded.value && workout.summary.value" class="space-y-1.5">
          <div class="text-success text-2xl">✓</div>
          <p class="text-text font-medium text-sm">{{ workout.summary.value.totalSessions }} séances chargées</p>
          <p class="text-text-muted text-xs">
            {{ formatDateFull(workout.summary.value.startDate) }} → {{ formatDateFull(workout.summary.value.endDate) }}
          </p>
          <p class="text-text-muted text-xs">{{ workout.summary.value.uniqueExercises }} exercices différents</p>
          <p class="text-text-faint text-xs mt-2">Cliquez pour {{ replaceMode ? 'remplacer' : 'ajouter plus' }}</p>
        </div>
        <div v-else class="space-y-2">
          <svg viewBox="0 0 24 24" class="w-10 h-10 mx-auto text-text-faint" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
            <path d="M14 2v6h6"/>
          </svg>
          <p class="text-text-muted text-sm">Glissez le fichier ou cliquez pour parcourir</p>
        </div>
      </div>
    </div>

    <!-- Measurement CSV -->
    <div class="mb-4">
      <div class="flex items-center justify-between mb-2">
        <label class="text-sm font-medium">measurement_data.csv</label>
        <span class="text-xs text-text-faint">optionnel</span>
      </div>
      <div
        class="drop-zone rounded-xl p-8 text-center cursor-pointer"
        :class="{ 'drag-over': dragOver2, 'opacity-50 pointer-events-none': importing }"
        @dragover.prevent="dragOver2 = true"
        @dragleave="dragOver2 = false"
        @drop.prevent="onDrop2"
        @click="$refs.file2.click()"
      >
        <input ref="file2" type="file" accept=".csv" class="hidden" @change="onFileInput2" :disabled="importing">
        <div v-if="measurement.loaded.value" class="space-y-1.5">
          <div class="text-success text-2xl">✓</div>
          <p class="text-text font-medium text-sm">{{ measurement.measurements.value.length }} entrées</p>
          <p class="text-text-faint text-xs mt-2">Cliquez pour {{ replaceMode ? 'remplacer' : 'ajouter plus' }}</p>
        </div>
        <div v-else class="space-y-2">
          <svg viewBox="0 0 24 24" class="w-10 h-10 mx-auto text-text-faint" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 12l2-2 4 4 8-8 4 4"/>
          </svg>
          <p class="text-text-muted text-sm">Glissez vos mensurations ou cliquez pour parcourir</p>
        </div>
      </div>
    </div>

    <!-- Spinner import en cours -->
    <div v-if="importing" class="text-center py-3">
      <div class="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
      <p class="text-text-muted text-xs mt-2">Import en cours…</p>
    </div>

    <div v-if="workout.loaded.value && !importing" class="flex items-center justify-center gap-3 mt-6">
      <button @click="emit('imported')" class="btn btn-primary">
        Voir mes statistiques
      </button>
      <button @click="clearAll" class="btn btn-ghost text-text-muted hover:text-danger">
        Effacer tout
      </button>
    </div>
  </div>
</template>
