<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import { formatDateShort } from '../../utils/dateUtils'

const props = defineProps({
  exerciseTitle: { type: String, required: true },
  usersStats: {
    type: Array, // [{ username, color, stats: {...} | null }]
    required: true,
  },
})

const expanded = ref(false)

const usersWithStats = computed(() => props.usersStats.filter(u => u.stats !== null))

const bestRMUsername = computed(() => {
  let best = 0; let bestUser = null
  for (const u of usersWithStats.value) {
    if (u.stats.best1RM > best) { best = u.stats.best1RM; bestUser = u.username }
  }
  return bestUser
})

function evolStyle(pct) {
  if (pct === null || Math.abs(pct) < 1) return { color: 'var(--text-muted)' }
  return { color: pct > 0 ? 'var(--success)' : 'var(--danger)' }
}

function fmtEvol(pct, kg) {
  if (pct === null || kg === null) return '—'
  if (Math.abs(pct) < 1) return 'stable'
  const sign = kg > 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}% · ${sign}${kg.toFixed(1)} kg`
}

// Line chart: 1RM progression per user
const progressionChart = computed(() => {
  const allTimes = new Set()
  for (const u of usersWithStats.value) {
    u.stats.history.forEach(h => allTimes.add(h.date.getTime()))
  }
  const sorted = Array.from(allTimes).sort((a, b) => a - b)
  return {
    labels: sorted.map(t => formatDateShort(new Date(t))),
    datasets: usersWithStats.value.map(u => {
      const byTime = new Map(u.stats.history.map(h => [h.date.getTime(), h.best1RM]))
      return {
        label: u.username,
        data: sorted.map(t => byTime.get(t) ?? null),
        borderColor: u.color,
        backgroundColor: u.color + '18',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: u.color,
        tension: 0.25,
        spanGaps: true,
        fill: false,
      }
    }),
  }
})

const progressionOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, labels: { color: '#8b949e', font: { size: 11 }, boxWidth: 12, padding: 12 } },
    tooltip: {
      backgroundColor: '#1f2730',
      titleColor: '#e6edf3',
      bodyColor: '#8b949e',
      borderColor: '#2d3742',
      borderWidth: 1,
      cornerRadius: 6,
      padding: 10,
      callbacks: { label: ctx => `${ctx.dataset.label} : ${ctx.raw?.toFixed(1)} kg 1RM` },
    },
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#6e7681', font: { size: 10 } } },
    y: { grid: { color: '#252e38' }, ticks: { color: '#6e7681', font: { size: 10 } }, border: { display: false } },
  },
}

// Metric rows shared between desktop table and mobile stacks
const METRICS = [
  { key: '1rm',    label: '1RM estimé',      fmt: u => u.best1RM.toFixed(1) + ' kg',                              bold: true  },
  { key: 'max',    label: 'Poids max',        fmt: u => u.maxWeight + ' kg',                                       bold: false },
  { key: 'set',    label: 'Meilleure série',  fmt: u => u.bestSet ? `${u.bestSet.weight} kg × ${u.bestSet.reps}` : '—', bold: false },
  { key: 'vol',    label: 'Volume total',     fmt: u => Math.round(u.totalVolume).toLocaleString('fr-FR') + ' kg', bold: false },
  { key: 'sets',   label: 'Séries',           fmt: u => String(u.totalSets),                                       bold: false },
  { key: 'evol',   label: 'Évolution',        fmt: u => fmtEvol(u.evolutionPct, u.evolutionKg),                   bold: false, evolPct: true },
]
</script>

<template>
<div class="soft-card p-4 space-y-3">

  <!-- Exercise title -->
  <p class="text-sm font-semibold leading-tight">{{ exerciseTitle }}</p>

  <!-- ── DESKTOP: side-by-side table (≥ sm) ──────────────────────────────── -->
  <div class="hidden sm:block overflow-x-auto -mx-1 px-1">
    <table class="w-full min-w-max border-collapse">
      <thead>
        <tr>
          <th class="py-1.5 pr-4 text-left w-36 min-w-[9rem]"></th>
          <th v-for="u in usersStats" :key="u.username" class="py-1.5 px-3 text-left font-medium">
            <div class="flex items-center gap-1.5 whitespace-nowrap">
              <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: u.color }"></span>
              <span class="text-xs" :style="{ color: u.color }">{{ u.username }}</span>
              <span v-if="u.username === bestRMUsername" class="text-xs leading-none" title="Meilleur 1RM">🏆</span>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in METRICS" :key="m.key" class="border-t border-border/50">
          <td class="py-1.5 pr-4 text-xs text-text-muted">{{ m.label }}</td>
          <td v-for="u in usersStats" :key="u.username" class="py-1.5 px-3 text-xs">
            <template v-if="u.stats">
              <span
                :class="m.bold ? 'font-medium' : ''"
                :style="m.bold && u.username === bestRMUsername
                  ? { color: u.color }
                  : m.evolPct ? evolStyle(u.stats.evolutionPct) : {}"
              >{{ m.fmt(u.stats) }}</span>
            </template>
            <span v-else class="text-text-muted opacity-40">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ── MOBILE: stacked user blocks (< sm) ──────────────────────────────── -->
  <div class="sm:hidden divide-y divide-border/50">
    <div v-for="u in usersStats" :key="u.username" class="py-3 first:pt-0 last:pb-0">
      <!-- User header -->
      <div class="flex items-center gap-1.5 mb-2">
        <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: u.color }"></span>
        <span class="text-xs font-semibold" :style="{ color: u.color }">{{ u.username }}</span>
        <span v-if="u.username === bestRMUsername" class="text-xs leading-none" title="Meilleur 1RM">🏆</span>
      </div>
      <!-- No data -->
      <p v-if="!u.stats" class="text-xs text-text-muted opacity-40">Aucune donnée sur cette période.</p>
      <!-- Metrics list -->
      <div v-else class="space-y-1">
        <div v-for="m in METRICS" :key="m.key" class="flex justify-between items-baseline gap-2 text-xs">
          <span class="text-text-muted flex-shrink-0">{{ m.label }}</span>
          <span
            :class="m.bold ? 'font-medium' : ''"
            :style="m.bold && u.username === bestRMUsername
              ? { color: u.color }
              : m.evolPct ? evolStyle(u.stats.evolutionPct) : {}"
          >{{ m.fmt(u.stats) }}</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Toggle progression chart -->
  <button
    v-if="usersWithStats.length >= 1"
    @click="expanded = !expanded"
    class="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
  >
    <svg
      viewBox="0 0 24 24"
      class="w-3.5 h-3.5 transition-transform duration-200"
      :class="{ 'rotate-180': expanded }"
      fill="none" stroke="currentColor" stroke-width="2"
    >
      <path d="M19 9l-7 7-7-7" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    {{ expanded ? 'Masquer' : 'Voir' }} l'évolution du 1RM
  </button>

  <!-- Line chart (expanded) -->
  <Transition name="expand">
    <div v-if="expanded" class="h-40 sm:h-48 pt-1">
      <Line :data="progressionChart" :options="progressionOptions" />
    </div>
  </Transition>
</div>
</template>

<style scoped>
.expand-enter-active,
.expand-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
