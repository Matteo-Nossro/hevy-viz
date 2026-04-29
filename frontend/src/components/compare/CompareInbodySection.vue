<script setup>
import { computed, ref, watch } from 'vue'
import { Line } from 'vue-chartjs'
import { getDayKey, formatDateShort } from '../../utils/dateUtils'
import { computeRecomp } from '../../composables/useCompareData'

const props = defineProps({
  usersData: { type: Array, required: true }, // [{username, color, scans, loaded}]
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
})

const tooltipBase = {
  backgroundColor: '#1f2730',
  titleColor: '#e6edf3',
  bodyColor: '#8b949e',
  borderColor: '#2d3742',
  borderWidth: 1,
  cornerRadius: 6,
  padding: 10,
}

function makeLineOptions(unit = '') {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12, padding: 12 },
      },
      tooltip: {
        ...tooltipBase,
        callbacks: {
          label: ctx => `${ctx.dataset.label} : ${ctx.raw}${unit}`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#6e7681', font: { size: 10 } } },
      y: {
        grid: { color: '#252e38' },
        ticks: { color: '#6e7681', font: { size: 10 } },
        border: { display: false },
      },
    },
  }
}

// Users with at least 1 scan in the period
const usersWithScans = computed(() =>
  props.usersData.filter(u => {
    if (!u.loaded) return false
    return (u.scans ?? []).some(s => s.scan_date >= props.startDate && s.scan_date <= props.endDate)
  })
)

function scansInPeriod(u) {
  return (u.scans ?? []).filter(s => s.scan_date >= props.startDate && s.scan_date <= props.endDate)
}

// Per-user selected scan index (defaults to last scan)
const selectedIdx = ref({})

watch(
  () => usersWithScans.value,
  (users) => {
    users.forEach(u => {
      const scans = scansInPeriod(u)
      if (selectedIdx.value[u.username] === undefined || selectedIdx.value[u.username] >= scans.length) {
        selectedIdx.value[u.username] = Math.max(0, scans.length - 1)
      }
    })
  },
  { immediate: true }
)

function lastScan(u) {
  const s = scansInPeriod(u)
  return s.length ? s[s.length - 1] : null
}

function selectedScan(u) {
  const scans = scansInPeriod(u)
  if (!scans.length) return null
  const idx = selectedIdx.value[u.username] ?? scans.length - 1
  return scans[Math.min(idx, scans.length - 1)]
}

function prevScan(u) {
  const idx = selectedIdx.value[u.username] ?? 0
  if (idx > 0) selectedIdx.value[u.username] = idx - 1
}

function nextScan(u) {
  const scans = scansInPeriod(u)
  const idx = selectedIdx.value[u.username] ?? scans.length - 1
  if (idx < scans.length - 1) selectedIdx.value[u.username] = idx + 1
}

function scanNav(u) {
  const scans = scansInPeriod(u)
  const idx = selectedIdx.value[u.username] ?? scans.length - 1
  return { current: idx + 1, total: scans.length }
}

function fmt(val, dec = 1, unit = '') {
  if (val === null || val === undefined) return '—'
  return `${Number(val).toFixed(dec)}${unit ? ' ' + unit : ''}`
}

function buildLineChart(fieldKey) {
  const allDates = new Set()
  usersWithScans.value.forEach(u =>
    (u.scans ?? [])
      .filter(s => s.scan_date >= props.startDate && s.scan_date <= props.endDate && s[fieldKey] != null)
      .forEach(s => allDates.add(getDayKey(s.scan_date)))
  )
  const sorted = Array.from(allDates).sort()
  return {
    labels: sorted,
    datasets: usersWithScans.value.map(u => {
      const byDate = {}
      ;(u.scans ?? [])
        .filter(s => s.scan_date >= props.startDate && s.scan_date <= props.endDate)
        .forEach(s => { byDate[getDayKey(s.scan_date)] = s[fieldKey] })
      return {
        label: u.username,
        data: sorted.map(d => byDate[d] ?? null),
        borderColor: u.color,
        backgroundColor: u.color + '1a',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: u.color,
        tension: 0.3,
        spanGaps: true,
        fill: false,
      }
    }),
  }
}

const weightChart = computed(() => buildLineChart('weight_kg'))
const muscleChart = computed(() => buildLineChart('skeletal_muscle_mass_kg'))
const fatChart    = computed(() => buildLineChart('body_fat_percent'))

function hasData(chart) {
  return chart.datasets.some(d => d.data.some(v => v != null))
}

// Recomp scoreboard — sorted by ratio (best first)
const recompData = computed(() => {
  return props.usersData
    .map(u => {
      if (!u.loaded) return null
      const r = computeRecomp(u.scans ?? [], props.startDate, props.endDate)
      return r ? { username: u.username, color: u.color, ...r } : null
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ra = a.fatDelta <= 0 ? Infinity : a.muscleDelta / Math.abs(a.fatDelta)
      const rb = b.fatDelta <= 0 ? Infinity : b.muscleDelta / Math.abs(b.fatDelta)
      return rb - ra
    })
})

function recompRatioDisplay(r) {
  if (r.fatDelta <= 0 && r.muscleDelta > 0) return '∞'
  if (r.fatDelta === 0) return '—'
  return (r.muscleDelta / Math.abs(r.fatDelta)).toFixed(1) + 'x'
}

function fmtDelta(v) {
  if (v === null || v === undefined) return '—'
  return `${v > 0 ? '+' : ''}${v.toFixed(2)} kg`
}
</script>

<template>
<div class="soft-card p-4 space-y-4">

  <p class="text-xs font-medium text-text-muted uppercase tracking-wider">Comparaison InBody</p>

  <!-- Not enough data -->
  <div v-if="usersWithScans.length < 2" class="text-center py-6 space-y-1">
    <p class="text-sm text-text-muted">Aucun scan InBody à comparer pour ces utilisateurs sur cette période.</p>
    <p v-if="usersWithScans.length === 1" class="text-xs text-text-muted">
      Seul(e) <span :style="{ color: usersWithScans[0].color }">{{ usersWithScans[0].username }}</span> a des données InBody.
    </p>
  </div>

  <template v-else>

    <!-- Last scan cards -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div
        v-for="u in usersWithScans"
        :key="u.username"
        class="rounded-xl p-3 space-y-2"
        style="border: 1px solid var(--border);"
        :style="{ borderColor: u.color + '44' }"
      >
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: u.color }"></span>
            <span class="text-xs font-medium truncate" :style="{ color: u.color }">{{ u.username }}</span>
          </div>
          <div v-if="scanNav(u).total > 1" class="flex items-center gap-1 flex-shrink-0">
            <button
              @click="prevScan(u)"
              :disabled="scanNav(u).current === 1"
              class="w-4 h-4 flex items-center justify-center rounded text-text-muted hover:text-text-primary disabled:opacity-30"
            >‹</button>
            <span class="text-[10px] text-text-muted tabular-nums">{{ scanNav(u).current }}/{{ scanNav(u).total }}</span>
            <button
              @click="nextScan(u)"
              :disabled="scanNav(u).current === scanNav(u).total"
              class="w-4 h-4 flex items-center justify-center rounded text-text-muted hover:text-text-primary disabled:opacity-30"
            >›</button>
          </div>
        </div>
        <template v-if="selectedScan(u)">
          <p class="text-[10px] text-text-muted">{{ formatDateShort(selectedScan(u).scan_date) }}</p>
          <div class="space-y-1 text-xs">
            <div class="flex justify-between gap-2">
              <span class="text-text-muted">Poids</span>
              <span class="font-medium">{{ fmt(selectedScan(u).weight_kg, 1, 'kg') }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-text-muted">Muscle</span>
              <span class="font-medium">{{ fmt(selectedScan(u).skeletal_muscle_mass_kg, 1, 'kg') }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-text-muted">Masse grasse</span>
              <span class="font-medium">{{ fmt(selectedScan(u).body_fat_mass_kg, 1, 'kg') }}</span>
            </div>
            <div class="flex justify-between gap-2">
              <span class="text-text-muted">% graisse</span>
              <span class="font-medium">{{ fmt(selectedScan(u).body_fat_percent, 1, '%') }}</span>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Line charts -->
    <div class="space-y-5">
      <div v-if="hasData(weightChart)">
        <p class="text-xs text-text-muted mb-2">Poids (kg)</p>
        <div class="h-48">
          <Line :data="weightChart" :options="makeLineOptions('kg')" />
        </div>
      </div>
      <div v-if="hasData(muscleChart)">
        <p class="text-xs text-text-muted mb-2">Masse musculaire squelettique (kg)</p>
        <div class="h-48">
          <Line :data="muscleChart" :options="makeLineOptions('kg')" />
        </div>
      </div>
      <div v-if="hasData(fatChart)">
        <p class="text-xs text-text-muted mb-2">% de masse grasse</p>
        <div class="h-48">
          <Line :data="fatChart" :options="makeLineOptions('%')" />
        </div>
      </div>
    </div>

    <!-- Recomp scoreboard -->
    <div v-if="recompData.length >= 2" class="rounded-xl p-3 space-y-2" style="border: 1px solid var(--border);">
      <p class="text-xs font-medium text-text-muted uppercase tracking-wider">Recomposition corporelle</p>
      <div
        v-for="(r, i) in recompData"
        :key="r.username"
        class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs"
      >
        <span class="font-semibold" :style="{ color: r.color }">{{ r.username }}</span>
        <span>{{ fmtDelta(r.muscleDelta) }} muscle</span>
        <span class="text-text-muted">/</span>
        <span>{{ fmtDelta(r.fatDelta) }} graisse</span>
        <span class="text-text-muted">→</span>
        <span class="font-semibold" :style="{ color: r.color }">{{ recompRatioDisplay(r) }} ratio</span>
        <span v-if="i === 0">🥇</span>
      </div>
    </div>

  </template>
</div>
</template>
