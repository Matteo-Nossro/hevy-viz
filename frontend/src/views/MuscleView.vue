<script setup>
import { ref, computed } from 'vue'
import { Radar } from 'vue-chartjs'
import { MUSCLE_GROUPS } from '../config/muscleMapping'
import { getWeekStart, formatDateShort, MONTHS_FR } from '../utils/dateUtils'
import AnatomyHeatmap from '../components/AnatomyHeatmap.vue'

const props = defineProps(['workout'])

const view = ref('week')  // 'week' | 'month'
const offset = ref(0)     // Recul depuis aujourd'hui (en semaines ou mois)

// Période courante (en fonction du mode)
const currentRange = computed(() => {
  const ref = props.workout.lastDataDate.value
  if (view.value === 'week') {
    const ws = getWeekStart(ref)
    const start = new Date(ws.getTime() - offset.value * 7 * 86400000)
    const end = new Date(start.getTime() + 7 * 86400000 - 1)
    return { start, end, label: `Semaine du ${formatDateShort(start)}` }
  } else {
    const baseY = ref.getFullYear()
    const baseM = ref.getMonth() - offset.value
    const start = new Date(baseY, baseM, 1)
    const end = new Date(baseY, baseM + 1, 0, 23, 59, 59)
    return { start, end, label: `${MONTHS_FR[start.getMonth()]} ${start.getFullYear()}` }
  }
})

// Données de la silhouette
const anatomyData = computed(() => {
  return props.workout.setsByMuscleGroup(currentRange.value.start, currentRange.value.end)
})

// Sets avec delta
const setsWithDelta = computed(() => {
  const data = props.workout.setsByMuscleGroupWithDelta(currentRange.value.start, currentRange.value.end)
  return MUSCLE_GROUPS
    .map(g => ({ group: g, ...data[g] }))
    .filter(d => d.current > 0 || Math.abs(d.delta) > 0)
    .sort((a, b) => b.current - a.current)
})

const maxSets = computed(() => Math.max(1, ...setsWithDelta.value.map(d => d.current)))

// Radar comparaison
const radarWeeks = ref(4)
const radarRecent = computed(() => {
  const ref = props.workout.lastDataDate.value
  const start = new Date(ref.getTime() - radarWeeks.value * 7 * 86400000)
  return props.workout.muscleRepartition(start, ref)
})
const radarPast = computed(() => {
  const ref = props.workout.lastDataDate.value
  const start = new Date(ref.getTime() - radarWeeks.value * 2 * 7 * 86400000)
  const end = new Date(ref.getTime() - radarWeeks.value * 7 * 86400000)
  return props.workout.muscleRepartition(start, end)
})
const radarChartData = computed(() => {
  const groups = MUSCLE_GROUPS.filter(g => radarRecent.value[g] > 0 || radarPast.value[g] > 0)
  return {
    labels: groups,
    datasets: [
      {
        label: `Période actuelle (${radarWeeks.value} sem.)`,
        data: groups.map(g => radarRecent.value[g] || 0),
        backgroundColor: 'rgba(94, 184, 196, 0.18)',
        borderColor: '#5eb8c4',
        borderWidth: 2,
        pointBackgroundColor: '#5eb8c4',
        pointRadius: 3,
      },
      {
        label: `Période précédente`,
        data: groups.map(g => radarPast.value[g] || 0),
        backgroundColor: 'rgba(183, 148, 246, 0.12)',
        borderColor: '#b794f6',
        borderWidth: 2,
        pointBackgroundColor: '#b794f6',
        pointRadius: 3,
      },
    ]
  }
})

const radarOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: '#8b949e', usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11 } } },
    tooltip: {
      backgroundColor: '#1f2730', titleColor: '#e6edf3', bodyColor: '#8b949e',
      borderColor: '#2d3742', borderWidth: 1, cornerRadius: 6,
      callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw}%` }
    },
  },
  scales: {
    r: {
      angleLines: { color: '#2d3742' }, grid: { color: '#2d3742' },
      pointLabels: { color: '#8b949e', font: { size: 10 } },
      ticks: { display: false },
    }
  },
}

function shiftBack() { offset.value++ }
function shiftForward() { if (offset.value > 0) offset.value-- }
</script>

<template>
  <div class="space-y-5 fade-in">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold tracking-tight">Groupes musculaires</h2>
      <div class="flex items-center gap-3">
        <div class="pill-toggle">
          <button :class="{ active: view === 'week' }" @click="view = 'week'; offset = 0">Semaine</button>
          <button :class="{ active: view === 'month' }" @click="view = 'month'; offset = 0">Mois</button>
        </div>
      </div>
    </div>

    <!-- Anatomie + barres séries côte à côte -->
    <div class="grid lg:grid-cols-2 gap-4">
      <div class="soft-card p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider">
            Carte thermique anatomique
          </h3>
          <div class="flex items-center gap-2">
            <button @click="shiftBack" class="btn btn-ghost p-1 text-text-muted hover:text-text">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <span class="text-xs text-text">{{ currentRange.label }}</span>
            <button @click="shiftForward"
              :class="['btn btn-ghost p-1', offset === 0 ? 'opacity-30 cursor-not-allowed' : 'text-text-muted hover:text-text']">
              <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
            </button>
          </div>
        </div>
        <AnatomyHeatmap :data="anatomyData" />
      </div>

      <div class="soft-card p-4">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
          Séries par groupe — {{ currentRange.label }}
        </h3>
        <div v-if="setsWithDelta.length" class="space-y-2">
          <div v-for="m in setsWithDelta" :key="m.group" class="flex items-center gap-3">
            <span class="text-xs w-28 flex-shrink-0">{{ m.group }}</span>
            <div class="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all"
                :style="{ width: (m.current / maxSets * 100) + '%', background: 'var(--accent)' }"></div>
            </div>
            <span class="text-xs font-mono text-text w-8 text-right">{{ m.current }}</span>
            <span v-if="m.delta !== 0"
              :class="['text-[10px] font-mono w-10 text-right', m.delta > 0 ? 'text-success' : 'text-danger']">
              {{ m.delta > 0 ? '+' : '' }}{{ m.delta }}
            </span>
            <span v-else class="text-[10px] text-text-faint w-10 text-right">—</span>
          </div>
        </div>
        <div v-else class="text-center py-12 text-text-muted text-sm">
          Aucune donnée pour cette période
        </div>
      </div>
    </div>

    <!-- Radar comparaison -->
    <div class="soft-card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider">
          Répartition musculaire — comparaison
        </h3>
        <select v-model.number="radarWeeks">
          <option :value="2">2 semaines</option>
          <option :value="4">4 semaines</option>
          <option :value="8">8 semaines</option>
          <option :value="12">12 semaines</option>
        </select>
      </div>
      <div class="h-80 max-w-md mx-auto">
        <Radar :data="radarChartData" :options="radarOptions" />
      </div>
    </div>
  </div>
</template>
