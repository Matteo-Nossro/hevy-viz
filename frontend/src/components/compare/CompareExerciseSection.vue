<script setup>
import { ref, computed } from 'vue'
import { getExercisesForComparison, exerciseStatsForUser } from '../../composables/useCompareData'
import CompareExerciseCard from './CompareExerciseCard.vue'

const props = defineProps({
  usersData: { type: Array, required: true }, // [{username, color, sessions, loaded}]
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
})

const searchQuery = ref('')
const sortBy = ref('1rm')
const showAll = ref(false)
const PAGE_SIZE = 10

const SORT_OPTIONS = [
  { value: '1rm',    label: '1RM max' },
  { value: 'volume', label: 'Volume' },
  { value: 'users',  label: 'Exécutants' },
  { value: 'alpha',  label: 'A–Z' },
]

const loadedUsers = computed(() => props.usersData.filter(u => u.loaded))

// All exercises with at least 2 users having done them in the period
const allExercises = computed(() => {
  if (loadedUsers.value.length < 2) return []
  return getExercisesForComparison(
    loadedUsers.value.map(u => ({ username: u.username, sessions: u.sessions ?? [] })),
    props.startDate,
    props.endDate,
  )
})

// For each exercise: stats per user (null if user hasn't done it in the period)
const exercisesWithStats = computed(() => {
  return allExercises.value.map(ex => {
    const usersStats = props.usersData.map(u => ({
      username: u.username,
      color: u.color,
      stats: u.loaded
        ? exerciseStatsForUser(u.sessions ?? [], ex.title, props.startDate, props.endDate)
        : null,
    }))
    const bestRM = Math.max(0, ...usersStats.map(u => u.stats?.best1RM ?? 0))
    const totalVolume = usersStats.reduce((a, u) => a + (u.stats?.totalVolume ?? 0), 0)
    const usersCount = usersStats.filter(u => u.stats !== null).length
    return { title: ex.title, usersStats, bestRM, totalVolume, usersCount }
  })
})

// Reset pagination when filters change
function onSearchChange() { showAll.value = false }
function onSortChange() { showAll.value = false }

const filtered = computed(() => {
  let list = [...exercisesWithStats.value]

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter(e => e.title.toLowerCase().includes(q))
  }

  if (sortBy.value === '1rm')    list.sort((a, b) => b.bestRM - a.bestRM)
  else if (sortBy.value === 'volume') list.sort((a, b) => b.totalVolume - a.totalVolume)
  else if (sortBy.value === 'users')  list.sort((a, b) => b.usersCount - a.usersCount)
  else list.sort((a, b) => a.title.localeCompare(b.title, 'fr'))

  return list
})

const visible = computed(() =>
  showAll.value ? filtered.value : filtered.value.slice(0, PAGE_SIZE)
)

const hiddenCount = computed(() => Math.max(0, filtered.value.length - PAGE_SIZE))
</script>

<template>
<div class="soft-card p-4 space-y-4">

  <!-- Section header -->
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="text-xs font-medium text-text-muted uppercase tracking-wider">Comparaison par exercice</p>
    <span v-if="loadedUsers.length >= 2" class="text-xs text-text-muted">
      {{ allExercises.length }} exercice{{ allExercises.length !== 1 ? 's' : '' }} en commun
    </span>
  </div>

  <!-- Not enough users -->
  <p v-if="loadedUsers.length < 2" class="text-sm text-text-muted text-center py-6">
    Sélectionne au moins un autre utilisateur pour comparer les exercices.
  </p>

  <template v-else>
    <!-- Toolbar: search + sort -->
    <div class="flex flex-wrap gap-2 items-center">
      <!-- Search -->
      <div class="relative flex-1 min-w-[160px]">
        <svg
          viewBox="0 0 24 24"
          class="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
          style="color: var(--text-muted);"
          fill="none" stroke="currentColor" stroke-width="2"
        >
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35" stroke-linecap="round"/>
        </svg>
        <input
          v-model="searchQuery"
          @input="onSearchChange"
          type="text"
          placeholder="Filtrer…"
          class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg focus:outline-none transition-colors"
          style="background: var(--bg-elevated); border: 1px solid var(--border); color: var(--text);"
          @focus="$event.target.style.borderColor = 'var(--accent)'"
          @blur="$event.target.style.borderColor = 'var(--border)'"
        />
      </div>
      <!-- Sort pills -->
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="opt in SORT_OPTIONS"
          :key="opt.value"
          @click="sortBy = opt.value; onSortChange()"
          class="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border"
          :class="sortBy === opt.value
            ? 'bg-accent text-bg border-accent'
            : 'text-text-muted border-border hover:border-border-strong hover:text-text'"
        >{{ opt.label }}</button>
      </div>
    </div>

    <!-- Empty: no common exercises -->
    <div v-if="filtered.length === 0" class="text-center py-8 space-y-1">
      <p class="text-sm text-text-muted">
        <template v-if="searchQuery">Aucun exercice ne correspond à « {{ searchQuery }} ».</template>
        <template v-else>Aucun exercice en commun sur cette période.</template>
      </p>
      <p v-if="!searchQuery" class="text-xs text-text-muted">
        Essayez d'élargir la période ou de sélectionner d'autres utilisateurs.
      </p>
    </div>

    <!-- Exercise cards -->
    <div v-else class="space-y-3">
      <CompareExerciseCard
        v-for="ex in visible"
        :key="ex.title"
        :exercise-title="ex.title"
        :users-stats="ex.usersStats"
      />
    </div>

    <!-- Show more -->
    <div v-if="!showAll && hiddenCount > 0" class="text-center pt-1">
      <button
        @click="showAll = true"
        class="px-4 py-2 text-xs font-medium border rounded-lg transition-colors"
        style="color: var(--text-muted); border-color: var(--border);"
        @mouseenter="$event.target.style.borderColor = 'var(--border-strong)'; $event.target.style.color = 'var(--text)'"
        @mouseleave="$event.target.style.borderColor = 'var(--border)'; $event.target.style.color = 'var(--text-muted)'"
      >
        Voir {{ hiddenCount }} exercice{{ hiddenCount > 1 ? 's' : '' }} de plus
      </button>
    </div>
  </template>
</div>
</template>
