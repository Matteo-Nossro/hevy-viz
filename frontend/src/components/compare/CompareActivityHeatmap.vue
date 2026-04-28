<script setup>
import { computed } from 'vue'
import { getDayKey } from '../../utils/dateUtils'
import { hexToRgb } from '../../composables/useCompareData'

const props = defineProps({
  usersData: { type: Array, required: true }, // [{username, color, sessions, loaded}]
  endDate: { type: Date, required: true },
})

const MONTHS_SHORT = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']

// 60-day range ending at endDate
const startDate = computed(() => {
  const d = new Date(props.endDate.getTime() - 60 * 24 * 60 * 60 * 1000)
  d.setHours(0, 0, 0, 0)
  return d
})

// Week grid: columns of 7 day-slots (Mon=0 … Sun=6)
const weeks = computed(() => {
  const end = new Date(props.endDate)
  end.setHours(23, 59, 59, 999)
  const start = startDate.value

  // Back up to the Monday that starts the week containing start
  const anchor = new Date(start)
  const dow = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1 // 0=Mon
  anchor.setDate(anchor.getDate() - dow)

  const result = []
  const cur = new Date(anchor)
  while (cur <= end) {
    const week = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(cur)
      week.push({
        dayKey: getDayKey(day),
        date: new Date(day),
        inRange: day >= start && day <= end,
      })
      cur.setDate(cur.getDate() + 1)
    }
    result.push(week)
  }
  return result
})

// Month labels: first week column that introduces a new month
const monthLabels = computed(() => {
  const labels = new Map()
  let prevMonth = -1
  weeks.value.forEach((week, wi) => {
    const first = week.find(d => d.inRange)
    if (!first) return
    const m = first.date.getMonth()
    if (m !== prevMonth) {
      labels.set(wi, MONTHS_SHORT[m])
      prevMonth = m
    }
  })
  return labels
})

// Volume per day per user
const volumeMaps = computed(() => {
  const maps = {}
  for (const u of props.usersData) {
    const map = {}
    if (u.loaded) {
      for (const s of u.sessions) {
        map[s.dayKey] = (map[s.dayKey] ?? 0) + s.totalVolume
      }
    }
    maps[u.username] = map
  }
  return maps
})

// Max volume per user within the 60-day window (for intensity scaling)
const maxVolumes = computed(() => {
  const result = {}
  for (const u of props.usersData) {
    const vm = volumeMaps.value[u.username] ?? {}
    const inRangeKeys = weeks.value.flatMap(w => w.filter(d => d.inRange).map(d => d.dayKey))
    result[u.username] = Math.max(1, ...inRangeKeys.map(dk => vm[dk] ?? 0))
  }
  return result
})

function cellStyle(username, day) {
  if (!day.inRange) return { backgroundColor: 'transparent' }
  const vol = volumeMaps.value[username]?.[day.dayKey] ?? 0
  if (vol === 0) return { backgroundColor: 'rgba(255,255,255,0.05)' }
  const ratio = vol / maxVolumes.value[username]
  const alpha = ratio <= 0.25 ? 0.22 : ratio <= 0.5 ? 0.45 : ratio <= 0.75 ? 0.68 : 0.93
  const color = props.usersData.find(u => u.username === username)?.color ?? '#5eb8c4'
  const [r, g, b] = hexToRgb(color)
  return { backgroundColor: `rgba(${r},${g},${b},${alpha})` }
}

function cellTitle(username, day) {
  if (!day.inRange) return ''
  const vol = volumeMaps.value[username]?.[day.dayKey] ?? 0
  const d = day.date
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  const dateStr = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
  if (vol === 0) return dateStr
  const sessions = (props.usersData.find(u => u.username === username)?.sessions ?? [])
    .filter(s => s.dayKey === day.dayKey)
  const exCount = sessions.reduce((a, s) => a + s.exercises.length, 0)
  return `${dateStr} — ${Math.round(vol).toLocaleString('fr-FR')} kg · ${exCount} exercice${exCount !== 1 ? 's' : ''}`
}

// Legend: 5 intensity steps using the first loaded user's color
const legendStyles = computed(() => {
  const color = props.usersData.find(u => u.loaded)?.color ?? '#5eb8c4'
  const [r, g, b] = hexToRgb(color)
  return [0.1, 0.3, 0.52, 0.72, 0.95].map(alpha => ({
    backgroundColor: `rgba(${r},${g},${b},${alpha})`,
  }))
})

const loadedUsers = computed(() => props.usersData.filter(u => u.loaded))
</script>

<template>
<!--
  Cell sizing (CSS variables, responsive via <style scoped>):
    --hm-cell : 10px (mobile) → 12px (≥ sm)
    --hm-gap  : 2px  (mobile) → 3px  (≥ sm)
    --hm-col  : 12px (mobile) → 15px (≥ sm)   = cell + gap
    --hm-name : 64px (constant)
    --hm-off  : 72px (constant)                = name + gap-2
-->
<div class="soft-card p-4 space-y-3 heatmap-root">
  <div class="flex items-center justify-between">
    <p class="text-xs font-medium text-text-muted uppercase tracking-wider">Activité par jour</p>
    <span class="text-xs text-text-muted">60 derniers jours</span>
  </div>

  <div class="overflow-x-auto">
    <div class="inline-block">

      <!-- Month labels — offset = name col + gap -->
      <div class="flex mb-1.5 hm-month-row">
        <div
          v-for="(week, wi) in weeks"
          :key="wi"
          class="flex-shrink-0 relative overflow-visible hm-col-slot"
          style="height: 14px;"
        >
          <span
            v-if="monthLabels.has(wi)"
            class="absolute left-0 top-0 whitespace-nowrap leading-none"
            style="font-size: 10px; color: var(--text-muted);"
          >{{ monthLabels.get(wi) }}</span>
        </div>
      </div>

      <!-- One block per user -->
      <div
        v-for="u in loadedUsers"
        :key="u.username"
        class="flex items-start mb-2.5 hm-user-row"
      >
        <!-- Username label -->
        <span
          class="flex-shrink-0 text-right truncate hm-name"
          :style="{ color: u.color }"
        >{{ u.username }}</span>

        <!-- Week columns -->
        <div class="flex hm-grid-gap">
          <div
            v-for="(week, wi) in weeks"
            :key="wi"
            class="flex flex-col hm-grid-gap"
          >
            <div
              v-for="(day, di) in week"
              :key="di"
              class="flex-shrink-0 rounded-[2px] cursor-default hm-cell"
              :style="cellStyle(u.username, day)"
              :title="cellTitle(u.username, day)"
            ></div>
          </div>
        </div>
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-1.5 hm-legend-row">
        <span style="font-size: 10px; color: var(--text-muted);">Moins</span>
        <div
          v-for="(s, i) in legendStyles"
          :key="i"
          class="flex-shrink-0 rounded-[2px] hm-cell"
          :style="s"
        ></div>
        <span style="font-size: 10px; color: var(--text-muted);">Plus</span>
      </div>

    </div>
  </div>
</div>
</template>

<style scoped>
/* Default (mobile): 10px cells, 2px gap */
.heatmap-root {
  --hm-cell: 10px;
  --hm-gap:  2px;
  --hm-col:  12px;  /* cell + gap */
  --hm-name: 64px;
  --hm-off:  72px;  /* name + 8px gap-2 */
}
@media (min-width: 640px) {
  .heatmap-root {
    --hm-cell: 12px;
    --hm-gap:  3px;
    --hm-col:  15px;
  }
}

.hm-cell       { width: var(--hm-cell); height: var(--hm-cell); }
.hm-col-slot   { width: var(--hm-col); }
.hm-name       { width: var(--hm-name); font-size: 10px; font-weight: 500; line-height: var(--hm-cell); margin-top: 1px; }
.hm-user-row   { gap: 8px; }
.hm-month-row  { margin-left: var(--hm-off); }
.hm-legend-row { margin-left: var(--hm-off); }
.hm-grid-gap   { gap: var(--hm-gap); }
</style>
