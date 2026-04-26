<script setup>
import { ref, computed } from 'vue'
import { formatDateShort, formatDuration } from '../utils/dateUtils'
import SessionDrawer from '../components/SessionDrawer.vue'
import { MUSCLE_GROUPS } from '../config/muscleMapping'

const props = defineProps(['workout'])

const search = ref('')
const muscleFilter = ref('all')
const selectedSession = ref(null)
const selectedRecords = ref({})

const sessionsWithRec = computed(() => props.workout.sessionsWithRecords.value)

const filtered = computed(() => {
  let list = [...sessionsWithRec.value].reverse()
  const q = search.value.toLowerCase().trim()
  if (q) {
    list = list.filter(({ session }) => {
      if (session.title.toLowerCase().includes(q)) return true
      return session.exercises.some(e => e.title.toLowerCase().includes(q))
    })
  }
  if (muscleFilter.value !== 'all') {
    list = list.filter(({ session }) => session.muscleGroups.includes(muscleFilter.value))
  }
  return list
})

const muscleOptions = computed(() => {
  const used = new Set()
  for (const { session } of sessionsWithRec.value) {
    for (const mg of session.muscleGroups) used.add(mg)
  }
  return MUSCLE_GROUPS.filter(g => used.has(g))
})

function openSession(item) {
  selectedSession.value = item.session
  selectedRecords.value = item.recordsBroken
}

function closeSession() {
  selectedSession.value = null
  selectedRecords.value = {}
}
</script>

<template>
  <div class="space-y-4 fade-in">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold tracking-tight">Historique des séances</h2>
      <span class="text-xs text-text-muted">
        {{ filtered.length }} séance{{ filtered.length > 1 ? 's' : '' }}
      </span>
    </div>

    <!-- Filtres -->
    <div class="flex flex-col sm:flex-row gap-2">
      <div class="relative flex-1">
        <svg viewBox="0 0 24 24" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>
        </svg>
        <input
          v-model="search"
          type="search"
          placeholder="Rechercher par titre ou exercice…"
          class="w-full pl-9"
        />
      </div>
      <select v-model="muscleFilter">
        <option value="all">Tous les groupes</option>
        <option v-for="g in muscleOptions" :key="g" :value="g">{{ g }}</option>
      </select>
    </div>

    <!-- Liste -->
    <div v-if="filtered.length" class="soft-card divide-y divide-border overflow-hidden">
      <button
        v-for="item in filtered"
        :key="item.session.title + item.session.date.getTime()"
        @click="openSession(item)"
        class="w-full text-left p-4 hover:bg-surface-hover transition-colors flex items-start gap-3"
      >
        <div class="flex-shrink-0 w-12 text-center">
          <div class="text-[10px] text-text-faint uppercase tracking-wide">
            {{ item.session.date.toLocaleDateString('fr-FR', { weekday: 'short' }) }}
          </div>
          <div class="text-lg font-semibold tabular-nums">{{ item.session.date.getDate() }}</div>
          <div class="text-[10px] text-text-faint">
            {{ item.session.date.toLocaleDateString('fr-FR', { month: 'short' }) }}
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1 flex-wrap">
            <h3 class="text-sm font-medium text-text">{{ item.session.title }}</h3>
            <span v-if="Object.keys(item.recordsBroken).length"
              class="badge badge-warning text-[10px]">
              🏆 {{ Object.keys(item.recordsBroken).length }} PR
            </span>
          </div>
          <div class="flex items-center gap-3 text-xs text-text-muted mb-1.5">
            <span>{{ item.session.exercises.length }} exos</span>
            <span>·</span>
            <span>{{ item.session.exercises.reduce((a, e) => a + e.workingSets.length, 0) }} séries</span>
            <span>·</span>
            <span>{{ formatDuration(item.session.duration) }}</span>
            <span>·</span>
            <span class="font-mono text-accent-strong">
              {{ Math.round(item.session.totalVolume).toLocaleString('fr-FR') }} kg
            </span>
          </div>
          <div class="flex items-center gap-1 flex-wrap">
            <span v-for="mg in item.session.muscleGroups.slice(0, 6)" :key="mg" class="badge text-[9px]">
              {{ mg }}
            </span>
            <span v-if="item.session.muscleGroups.length > 6" class="text-[10px] text-text-faint">
              +{{ item.session.muscleGroups.length - 6 }}
            </span>
          </div>
        </div>

        <svg viewBox="0 0 24 24" class="w-4 h-4 text-text-faint flex-shrink-0 mt-1" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>
    <div v-else class="text-center py-16 text-text-muted">
      Aucune séance ne correspond à ces filtres.
    </div>

    <SessionDrawer
      :session="selectedSession"
      :records-broken="selectedRecords"
      @close="closeSession"
    />
  </div>
</template>
