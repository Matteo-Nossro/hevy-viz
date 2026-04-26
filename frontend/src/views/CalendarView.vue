<script setup>
import { ref, computed, watch } from 'vue'
import { DAYS_FR, MONTHS_FR, getDayKey } from '../utils/dateUtils'
import SessionDrawer from '../components/SessionDrawer.vue'

const props = defineProps(['workout'])

// Démarrage : sur le mois de la dernière donnée
const lastDate = computed(() => props.workout.lastDataDate.value)
const viewYear = ref(lastDate.value.getFullYear())
const viewMonth = ref(lastDate.value.getMonth())

// Si la donnée change (import incrémental) on s'aligne
watch(lastDate, (d) => {
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
})

const selectedSession = ref(null)
const selectedRecords = ref({})

const sessionsRecMap = computed(() => {
  // Map dayKey -> [{session, recordsBroken}]
  const map = new Map()
  for (const item of props.workout.sessionsWithRecords.value) {
    const k = item.session.dayKey
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(item)
  }
  return map
})

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}
function goToLast() {
  viewYear.value = lastDate.value.getFullYear()
  viewMonth.value = lastDate.value.getMonth()
}

const calendarDays = computed(() => {
  const firstDay = new Date(viewYear.value, viewMonth.value, 1)
  const lastDay = new Date(viewYear.value, viewMonth.value + 1, 0)
  const daysInMonth = lastDay.getDate()
  // Lundi = 1ère colonne (0 = lundi)
  let startWeekday = firstDay.getDay() - 1
  if (startWeekday < 0) startWeekday = 6

  const days = []
  for (let i = 0; i < startWeekday; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(viewYear.value, viewMonth.value, d)
    const k = getDayKey(date)
    const items = sessionsRecMap.value.get(k) || []
    days.push({
      date,
      day: d,
      sessions: items.map(i => i.session),
      itemsRec: items,
      hasRecord: items.some(i => Object.keys(i.recordsBroken).length > 0),
    })
  }
  return days
})

function openSession(item) {
  selectedSession.value = item.session
  selectedRecords.value = item.recordsBroken
}
function close() {
  selectedSession.value = null
  selectedRecords.value = {}
}

const monthVolume = computed(() => {
  let total = 0, sessions = 0
  for (const d of calendarDays.value) {
    if (!d) continue
    for (const s of d.sessions) {
      total += s.totalVolume
      sessions++
    }
  }
  return { total, sessions }
})
</script>

<template>
  <div class="space-y-4 fade-in">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold tracking-tight">Calendrier</h2>
      <button @click="goToLast" class="btn btn-ghost text-text-muted hover:text-text">
        <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 12l3-3 3 3M6 9v6M21 12l-3 3-3-3M18 15V9"/>
        </svg>
        Dernière donnée
      </button>
    </div>

    <div class="soft-card p-4">
      <div class="flex items-center justify-between mb-4">
        <button @click="prevMonth" class="btn btn-ghost p-2">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <div class="text-center">
          <h3 class="text-base font-medium">{{ MONTHS_FR[viewMonth] }} {{ viewYear }}</h3>
          <p class="text-[11px] text-text-muted mt-0.5">
            <span v-if="monthVolume.sessions">
              {{ monthVolume.sessions }} séance{{ monthVolume.sessions > 1 ? 's' : '' }} ·
              <span class="font-mono">{{ Math.round(monthVolume.total).toLocaleString('fr-FR') }} kg</span>
            </span>
            <span v-else class="text-text-faint">Aucune séance ce mois-ci</span>
          </p>
        </div>
        <button @click="nextMonth" class="btn btn-ghost p-2">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      <!-- Grille -->
      <div class="grid grid-cols-7 gap-1.5 mb-1.5">
        <div v-for="d in DAYS_FR" :key="d"
          class="text-center text-[10px] uppercase tracking-wider text-text-faint py-1.5">
          {{ d.slice(0, 3) }}
        </div>
      </div>
      <div class="grid grid-cols-7 gap-1.5">
        <template v-for="(day, idx) in calendarDays" :key="idx">
          <div v-if="!day" class="aspect-square"></div>
          <div v-else
            :class="[
              'aspect-square soft-card p-1.5 flex flex-col text-xs transition-all',
              day.sessions.length ? 'cursor-pointer hover:border-accent/60' : '',
              day.hasRecord ? 'border-warning/40' : ''
            ]"
            @click="day.sessions.length && openSession(day.itemsRec[0])"
          >
            <div class="flex items-start justify-between">
              <span :class="day.sessions.length ? 'text-text font-medium' : 'text-text-faint'">
                {{ day.day }}
              </span>
              <span v-if="day.hasRecord" class="text-[10px]">🏆</span>
            </div>
            <div v-if="day.sessions.length" class="flex-1 flex flex-col justify-end gap-0.5">
              <div v-for="(s, si) in day.sessions.slice(0, 2)" :key="si"
                class="w-full h-1 rounded-full"
                :style="{ background: 'var(--accent)' }"></div>
              <div v-if="day.sessions.length > 2" class="text-[9px] text-text-faint text-center">
                +{{ day.sessions.length - 2 }}
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <SessionDrawer
      :session="selectedSession"
      :records-broken="selectedRecords"
      @close="close"
    />
  </div>
</template>
