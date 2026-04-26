<script setup>
import { ref, computed } from 'vue'
import { getMuscleGroups } from '../config/muscleMapping'
import { useExerciseMapping } from '../composables/useExerciseMapping'
import ExerciseEditModal from '../components/ExerciseEditModal.vue'

const props = defineProps(['workout'])

const { customMapping, setMapping, removeMapping } = useExerciseMapping()

const search = ref('')
const showUnmappedOnly = ref(false)
const sortByUnmapped = ref(false)
const editTarget = ref(null) // { name: string, isNew: boolean }

// Exercices du dataset + éventuels custom-only (pré-configurés hors dataset)
const allNames = computed(() => {
  const fromDataset = new Set(props.workout.exerciseNames.value)
  const fromCustom = new Set(Object.keys(customMapping.value))
  return Array.from(new Set([...fromDataset, ...fromCustom]))
})

// Liste enrichie pour l'affichage
const exerciseList = computed(() => {
  const datasetNames = new Set(props.workout.exerciseNames.value)
  return allNames.value.map(name => {
    const groups = getMuscleGroups(name, customMapping.value)
    const isCustom = !!customMapping.value[name]
    const isUnmapped = groups.length === 1 && groups[0] === 'Autre'
    const inDataset = datasetNames.has(name)
    return { name, groups, isCustom, isUnmapped, inDataset }
  })
})

const displayList = computed(() => {
  let list = exerciseList.value

  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(e => e.name.toLowerCase().includes(q))
  }

  if (showUnmappedOnly.value) {
    list = list.filter(e => e.isUnmapped)
  }

  return [...list].sort((a, b) => {
    if (sortByUnmapped.value && a.isUnmapped !== b.isUnmapped) {
      return a.isUnmapped ? -1 : 1
    }
    return a.name.localeCompare(b.name, 'fr')
  })
})

const unmappedCount = computed(() => exerciseList.value.filter(e => e.isUnmapped).length)
const totalCount = computed(() => exerciseList.value.length)

function openAdd() {
  editTarget.value = { name: '', isNew: true }
}

function openEdit(name) {
  editTarget.value = { name, isNew: false }
}

async function handleSave(name, groups) {
  await setMapping(name, groups.length > 0 ? groups : ['Autre'])
  editTarget.value = null
}

async function handleReset(name) {
  await removeMapping(name)
  editTarget.value = null
}
</script>

<template>
  <div class="fade-in">
    <!-- En-tête -->
    <div class="flex items-center justify-between mb-6">
      <div>
        <h2 class="text-xl font-semibold tracking-tight">Exercices</h2>
        <p class="text-sm text-text-muted mt-0.5">
          {{ totalCount }} exercice{{ totalCount !== 1 ? 's' : '' }}
          <template v-if="unmappedCount > 0">
            · <span class="text-warning">{{ unmappedCount }} non mappé{{ unmappedCount !== 1 ? 's' : '' }}</span>
          </template>
        </p>
      </div>
      <button @click="openAdd" class="btn btn-primary flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        <span>Ajouter</span>
      </button>
    </div>

    <!-- Filtres -->
    <div class="soft-card p-3 mb-4 flex flex-wrap items-center gap-3">
      <!-- Recherche -->
      <div class="flex-1 min-w-[160px] relative">
        <svg viewBox="0 0 24 24" class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-faint pointer-events-none" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Rechercher…"
          class="w-full pl-8 pr-3 py-1.5 text-sm"
        >
      </div>

      <!-- Filtre non mappés -->
      <button
        @click="showUnmappedOnly = !showUnmappedOnly"
        :class="['btn text-xs px-3 py-1.5', showUnmappedOnly ? 'btn-primary' : 'btn-ghost border-border']"
      >
        Non mappés
        <span v-if="unmappedCount" class="ml-1 opacity-70">({{ unmappedCount }})</span>
      </button>

      <!-- Tri -->
      <div class="pill-toggle">
        <button :class="{ active: !sortByUnmapped }" @click="sortByUnmapped = false">A–Z</button>
        <button :class="{ active: sortByUnmapped }" @click="sortByUnmapped = true">Non mappés ↑</button>
      </div>
    </div>

    <!-- Liste des exercices -->
    <div class="space-y-1.5">
      <div
        v-for="ex in displayList"
        :key="ex.name"
        class="soft-card px-4 py-3 flex items-center gap-3"
        :class="ex.isUnmapped ? 'border-warning/25 bg-warning/5' : ''"
      >
        <!-- Nom + badges -->
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-sm font-medium text-text">{{ ex.name }}</span>
            <span v-if="!ex.inDataset" class="text-[10px] text-text-faint italic">hors dataset</span>
          </div>
          <div class="flex items-center gap-1 mt-1.5 flex-wrap">
            <template v-if="!ex.isUnmapped">
              <span v-for="g in ex.groups" :key="g" class="badge text-[10px]">{{ g }}</span>
            </template>
            <span v-else class="badge text-[10px] opacity-50">Autre</span>
            <span v-if="ex.isCustom" class="badge badge-accent text-[10px]">custom</span>
          </div>
        </div>

        <!-- Bouton modifier -->
        <button
          @click="openEdit(ex.name)"
          class="btn btn-ghost text-xs px-2.5 py-1.5 flex-shrink-0"
        >
          Modifier
        </button>
      </div>

      <!-- État vide -->
      <div v-if="displayList.length === 0" class="soft-card p-10 text-center text-text-muted text-sm">
        <template v-if="search || showUnmappedOnly">
          Aucun exercice ne correspond aux filtres.
        </template>
        <template v-else>
          Importez un <code class="text-xs bg-bg-elevated px-1.5 py-0.5 rounded">workouts.csv</code> pour voir vos exercices.
        </template>
      </div>
    </div>

    <!-- Modal d'édition -->
    <ExerciseEditModal
      :exercise="editTarget"
      @save="handleSave"
      @reset="handleReset"
      @close="editTarget = null"
    />
  </div>
</template>
