<script setup>
import { ref, computed, watch } from 'vue'
import { MUSCLE_GROUPS, getMuscleGroups } from '../config/muscleMapping'
import { useExerciseMapping } from '../composables/useExerciseMapping'
import { useWorkoutData } from '../composables/useWorkoutData'

const props = defineProps({
  exercise: { type: Object, default: null }, // { name: string, isNew: boolean }
})
const emit = defineEmits(['save', 'reset', 'close'])

const { customMapping } = useExerciseMapping()
const workout = useWorkoutData()

const editName = ref('')
const selectedGroups = ref([])

const checkboxGroups = MUSCLE_GROUPS.filter(g => g !== 'Autre')

// Avertissement pour les nouveaux exercices
const nameWarning = computed(() => {
  if (!props.exercise?.isNew || !editName.value.trim()) return null
  const name = editName.value.trim()
  if (customMapping.value[name]) return 'Ce nom a déjà un mapping custom. Il sera remplacé.'
  if (workout.exerciseNames.value.includes(name)) return 'Cet exercice existe dans votre dataset. Le mapping custom prendra le dessus sur le mapping auto.'
  return null
})

const canSave = computed(() => {
  if (props.exercise?.isNew) return editName.value.trim().length > 0
  return true
})

const hasCustomOverride = computed(() => {
  if (!props.exercise || props.exercise.isNew) return false
  return !!customMapping.value[props.exercise.name]
})

watch(() => props.exercise, (ex) => {
  if (!ex) return
  if (ex.isNew) {
    editName.value = ''
    selectedGroups.value = []
  } else {
    editName.value = ex.name
    const groups = getMuscleGroups(ex.name, customMapping.value)
    selectedGroups.value = groups.filter(g => g !== 'Autre')
  }
}, { immediate: true })

function toggleGroup(group) {
  if (selectedGroups.value.includes(group)) {
    selectedGroups.value = selectedGroups.value.filter(g => g !== group)
  } else {
    selectedGroups.value = [...selectedGroups.value, group]
  }
}

function handleSave() {
  const name = props.exercise.isNew ? editName.value.trim() : props.exercise.name
  if (!name) return
  emit('save', name, selectedGroups.value)
}

function handleReset() {
  emit('reset', props.exercise.name)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="exercise" class="fixed inset-0 z-50 flex justify-end" @click.self="emit('close')">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>

      <div class="relative w-full max-w-md bg-bg border-l border-border overflow-y-auto slide-in shadow-2xl flex flex-col">
        <!-- Header -->
        <div class="sticky top-0 bg-bg/95 backdrop-blur border-b border-border px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div class="min-w-0">
            <h3 class="font-semibold text-text">
              {{ exercise.isNew ? 'Ajouter un exercice' : 'Modifier le mapping' }}
            </h3>
            <p v-if="!exercise.isNew" class="text-xs text-text-muted mt-0.5 truncate">{{ exercise.name }}</p>
          </div>
          <button @click="emit('close')"
            class="text-text-muted hover:text-text text-xl leading-none p-1 -m-1 flex-shrink-0">✕</button>
        </div>

        <!-- Body -->
        <div class="flex-1 p-5 space-y-5">
          <!-- Nom (nouveaux exercices seulement) -->
          <div v-if="exercise.isNew">
            <label class="block text-xs uppercase tracking-wide text-text-muted mb-2">Nom de l'exercice</label>
            <input
              v-model="editName"
              type="text"
              placeholder="ex. Curl Incliné (Haltère)"
              class="w-full"
              autofocus
            >
            <div v-if="nameWarning" class="mt-2 flex items-start gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/25">
              <span class="text-warning text-xs flex-shrink-0 mt-0.5">⚠</span>
              <p class="text-xs text-warning leading-relaxed">{{ nameWarning }}</p>
            </div>
          </div>

          <!-- Groupes musculaires -->
          <div>
            <label class="block text-xs uppercase tracking-wide text-text-muted mb-3">Groupes musculaires</label>
            <div class="grid grid-cols-2 gap-0.5">
              <label
                v-for="group in checkboxGroups"
                :key="group"
                class="flex items-center gap-2.5 px-3 py-2 rounded-md cursor-pointer hover:bg-bg-elevated transition-colors select-none"
                :class="selectedGroups.includes(group) ? 'bg-accent-soft' : ''"
              >
                <input
                  type="checkbox"
                  :checked="selectedGroups.includes(group)"
                  @change="toggleGroup(group)"
                  class="w-3.5 h-3.5 flex-shrink-0"
                  style="accent-color: var(--accent)"
                >
                <span class="text-sm" :class="selectedGroups.includes(group) ? 'text-text' : 'text-text-muted'">
                  {{ group }}
                </span>
              </label>
            </div>
            <p class="text-xs text-text-faint mt-3">
              Laisser vide → groupe « Autre »
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div class="sticky bottom-0 bg-bg/95 backdrop-blur border-t border-border px-5 py-4 flex items-center gap-2">
          <button @click="emit('close')" class="btn btn-ghost text-text-muted">
            Annuler
          </button>
          <button
            v-if="hasCustomOverride"
            @click="handleReset"
            class="btn btn-ghost text-text-muted hover:text-danger"
          >
            Réinitialiser
          </button>
          <div class="flex-1"></div>
          <button
            @click="handleSave"
            :disabled="!canSave"
            class="btn btn-primary"
            :class="!canSave ? 'opacity-40 cursor-not-allowed' : ''"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
