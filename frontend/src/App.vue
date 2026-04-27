<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useWorkoutData } from './composables/useWorkoutData'
import { useMeasurementData } from './composables/useMeasurementData'
import { useInbodyData } from './composables/useInbodyData'
import { getStoredUsername, clearStoredUsername, getUser } from './api/client'
import { useExerciseMapping } from './composables/useExerciseMapping'
import UserPickerView from './views/UserPickerView.vue'
import ImportView from './views/ImportView.vue'
import StatsView from './views/StatsView.vue'
import MuscleView from './views/MuscleView.vue'
import HistoryView from './views/HistoryView.vue'
import ProgressionView from './views/ProgressionView.vue'
import RecordsView from './views/RecordsView.vue'
import ExercisesView from './views/ExercisesView.vue'
import CalendarView from './views/CalendarView.vue'
import ReportView from './views/ReportView.vue'
import CorpoView from './views/CorpoView.vue'
import InbodyView from './views/InbodyView.vue'

// ── User state ──────────────────────────────────────────────────────────────
const currentUser = ref(null)
const userLoading = ref(true)
const mobileMenuOpen = ref(false)

onMounted(async () => {
  const stored = getStoredUsername()
  if (stored) {
    try {
      const user = await getUser(stored)
      if (user) {
        currentUser.value = user
      } else {
        clearStoredUsername()
      }
    } catch {
      // API down — passer au picker
    }
  }
  userLoading.value = false
})

function onUserSelected(user) {
  currentUser.value = user
  workout.load()
  measurement.load()
  mapping.load()
  inbody.load()
}

function changeUser() {
  clearStoredUsername()
  currentUser.value = null
  workout.reset()
  measurement.reset()
  mapping.reset()
  inbody.reset()
  currentTab.value = 'import'
  mobileMenuOpen.value = false
}

function selectTab(id) {
  currentTab.value = id
  mobileMenuOpen.value = false
}

// ── Composables ──────────────────────────────────────────────────────────────
const workout = useWorkoutData()
const measurement = useMeasurementData()
const mapping = useExerciseMapping()
const inbody = useInbodyData()

const currentTab = ref('import')

watch(() => workout.loaded.value, (val) => {
  if (val && currentTab.value === 'import') currentTab.value = 'stats'
}, { immediate: true })

const tabs = computed(() => {
  const list = [
    { id: 'import',      label: 'Import',      icon: 'M12 4v12m0 0l-4-4m4 4l4-4M4 20h16' },
    { id: 'stats',       label: 'Stats',       icon: 'M3 13h2v8H3v-8zm4-6h2v14H7V7zm4-4h2v18h-2V3zm4 8h2v10h-2V11zm4 4h2v6h-2v-6z' },
    { id: 'muscles',     label: 'Muscles',     icon: 'M19 4l-3 3M9 19l3-3-1-2 2-1 3 3M5 5l3 3M19 19l-3-3' },
    { id: 'history',     label: 'Historique',  icon: 'M3 5h18M3 12h18M3 19h18' },
    { id: 'progression', label: 'Progression', icon: 'M3 17l6-6 4 4 8-8M14 7h7v7' },
    { id: 'records',     label: 'Records',     icon: 'M12 2l2.4 7.4H22l-6 4.4 2.3 7.2L12 16.5l-6.3 4.5L8 13.8 2 9.4h7.6L12 2z' },
    { id: 'exercises',   label: 'Exercices',   icon: 'M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82zM7 7h.01' },
    { id: 'report',      label: 'Rapport',     icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h6' },
    { id: 'calendar',    label: 'Calendrier',  icon: 'M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z' },
  ]
  if (measurement.loaded.value) {
    list.push({ id: 'corpo', label: 'Corpo', icon: 'M12 5a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 14a4 4 0 014-4h2a4 4 0 014 4v6H7v-6z' })
  }
  // InBody toujours visible
  list.push({
    id: 'inbody',
    label: 'InBody',
    icon: 'M12 3c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3zM6 20v-2c0-2.21 1.79-4 4-4h4c2.21 0 4 1.79 4 4v2H6z',
  })
  return list
})
</script>

<template>
  <!-- Spinner pendant vérification initiale -->
  <div v-if="userLoading" class="min-h-screen bg-bg flex items-center justify-center">
    <div class="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
  </div>

  <!-- Sélection d'utilisateur -->
  <UserPickerView v-else-if="!currentUser" @user-selected="onUserSelected" />

  <!-- App principale -->
  <div v-else class="min-h-screen bg-bg flex flex-col">
    <!-- Header -->
    <header class="no-print border-b border-border bg-bg/80 backdrop-blur-md sticky top-0 z-40">
      <div class="max-w-7xl mx-auto px-4 sm:px-6">
        <div class="flex items-center justify-between h-14">
          <!-- Logo -->
          <div class="flex items-center gap-2.5">
            <div class="w-7 h-7 rounded-md flex items-center justify-center"
              style="background: var(--gradient-soft)">
              <svg viewBox="0 0 24 24" class="w-4 h-4 text-bg" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M6 4v16M18 4v16M3 12h18" stroke-linecap="round"/>
              </svg>
            </div>
            <h1 class="font-semibold text-[15px] tracking-tight">Hevy Viz</h1>
          </div>

          <div class="flex items-center gap-2">
            <!-- Résumé workouts (desktop) -->
            <div v-if="workout.summary.value" class="text-xs text-text-muted hidden lg:block">
              {{ workout.summary.value.totalSessions }} séances ·
              {{ workout.summary.value.uniqueExercises }} exercices
            </div>

            <!-- User + bouton changer -->
            <button
              @click="changeUser"
              class="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors px-2 py-1 rounded-md hover:bg-surface-hover"
              title="Changer d'utilisateur"
            >
              <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/>
              </svg>
              <span class="hidden sm:inline">{{ currentUser.display_name || currentUser.username }}</span>
            </button>

            <!-- Burger menu (mobile uniquement) -->
            <button
              v-if="workout.loaded.value"
              @click="mobileMenuOpen = !mobileMenuOpen"
              class="sm:hidden flex items-center justify-center w-8 h-8 rounded-md text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
              :aria-expanded="mobileMenuOpen"
              aria-label="Menu"
            >
              <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2">
                <path v-if="!mobileMenuOpen" d="M3 6h18M3 12h18M3 18h18" stroke-linecap="round"/>
                <path v-else d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Tabs desktop (≥ sm) -->
        <nav
          v-if="workout.loaded.value"
          class="hidden sm:flex gap-0 overflow-x-auto -mb-px"
        >
          <button
            v-for="tab in tabs"
            :key="tab.id"
            @click="selectTab(tab.id)"
            :class="[
              'flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition-colors relative',
              currentTab === tab.id ? 'tab-active' : 'text-text-muted hover:text-text',
            ]"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path :d="tab.icon"/>
            </svg>
            <span>{{ tab.label }}</span>
          </button>
        </nav>
      </div>

      <!-- Menu mobile (drawer vertical) -->
      <Transition name="mobile-menu">
        <div
          v-if="mobileMenuOpen && workout.loaded.value"
          class="sm:hidden border-t border-border bg-bg/98 backdrop-blur overflow-y-auto max-h-[70vh]"
        >
          <nav class="py-1">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              @click="selectTab(tab.id)"
              :class="[
                'w-full flex items-center gap-3 px-5 py-3 text-sm transition-colors text-left',
                currentTab === tab.id
                  ? 'text-accent bg-accent-soft font-medium'
                  : 'text-text-muted hover:text-text hover:bg-surface-hover',
              ]"
            >
              <svg viewBox="0 0 24 24" class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path :d="tab.icon"/>
              </svg>
              <span>{{ tab.label }}</span>
              <span v-if="currentTab === tab.id" class="ml-auto w-1.5 h-1.5 rounded-full bg-accent"></span>
            </button>
          </nav>
        </div>
      </Transition>
    </header>

    <!-- Overlay pour fermer le menu mobile en cliquant en dehors -->
    <div
      v-if="mobileMenuOpen"
      class="fixed inset-0 z-30 sm:hidden"
      @click="mobileMenuOpen = false"
    ></div>

    <!-- Main -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
      <ImportView
        v-if="currentTab === 'import' || !workout.loaded.value"
        :workout="workout"
        :measurement="measurement"
        @imported="currentTab = 'stats'"
        @go-exercises="currentTab = 'exercises'"
      />
      <StatsView       v-else-if="currentTab === 'stats'"       :workout="workout" />
      <MuscleView      v-else-if="currentTab === 'muscles'"     :workout="workout" />
      <HistoryView     v-else-if="currentTab === 'history'"     :workout="workout" />
      <ProgressionView v-else-if="currentTab === 'progression'" :workout="workout" />
      <RecordsView     v-else-if="currentTab === 'records'"     :workout="workout" />
      <ExercisesView   v-else-if="currentTab === 'exercises'"   :workout="workout" />
      <ReportView      v-else-if="currentTab === 'report'"      :workout="workout" />
      <CalendarView    v-else-if="currentTab === 'calendar'"    :workout="workout" />
      <CorpoView       v-else-if="currentTab === 'corpo'"       :measurement="measurement" />
      <InbodyView      v-else-if="currentTab === 'inbody'"      :inbody="inbody" />
    </main>
  </div>
</template>

<style scoped>
.mobile-menu-enter-active,
.mobile-menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.mobile-menu-enter-from,
.mobile-menu-leave-to {
  opacity: 0;
  transform: translateY(-8px);
}
</style>
