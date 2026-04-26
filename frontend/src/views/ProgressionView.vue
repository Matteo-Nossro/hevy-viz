<script setup>
import { ref, computed, watch } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import { formatDateShort } from '../utils/dateUtils'

const props = defineProps(['workout'])

const selectedExercise = ref('')
const searchQuery = ref('')
const aggMode = ref('session') // 'session' | 'week'

watch(() => props.workout.exerciseNames.value, (names) => {
  if (names.length && !selectedExercise.value) {
    // Choisir l'exercice avec le plus de sessions
    const counts = {}
    for (const s of props.workout.sessions.value) {
      for (const ex of s.exercises) counts[ex.title] = (counts[ex.title] || 0) + 1
    }
    selectedExercise.value = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || names[0]
  }
}, { immediate: true })

const filteredExercises = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return props.workout.exerciseNames.value
  return props.workout.exerciseNames.value.filter(n => n.toLowerCase().includes(q))
})

const progression = computed(() => {
  if (!selectedExercise.value) return null
  return props.workout.exerciseProgression(selectedExercise.value, aggMode.value)
})

const performanceChart = computed(() => {
  if (!progression.value) return { labels: [], datasets: [] }
  const hist = progression.value.history
  return {
    labels: hist.map(h => formatDateShort(h.date)),
    datasets: [
      {
        label: '1RM estimé (kg)',
        data: hist.map(h => h.best1RM),
        borderColor: '#5eb8c4',
        backgroundColor: 'rgba(94, 184, 196, 0.08)',
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: '#5eb8c4',
        tension: 0.25,
        fill: true,
        yAxisID: 'y',
      },
      {
        label: 'Poids max (kg)',
        data: hist.map(h => h.maxWeight),
        borderColor: '#b794f6',
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 3,
        pointBackgroundColor: '#b794f6',
        tension: 0.25,
        fill: false,
        borderDash: [4, 4],
        yAxisID: 'y',
      },
    ]
  }
})

const volumeChart = computed(() => {
  if (!progression.value) return { labels: [], datasets: [] }
  const hist = progression.value.history
  return {
    labels: hist.map(h => formatDateShort(h.date)),
    datasets: [{
      data: hist.map(h => Math.round(h.volume)),
      backgroundColor: 'rgba(126, 167, 232, 0.45)',
      borderColor: '#7ea7e8',
      borderWidth: 1,
      borderRadius: 3,
    }]
  }
})

const tooltipStyle = {
  backgroundColor: '#1f2730', titleColor: '#e6edf3', bodyColor: '#8b949e',
  borderColor: '#2d3742', borderWidth: 1, cornerRadius: 6, padding: 10,
}

const lineOptions = {
  responsive: true, maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: {
      labels: { color: '#8b949e', usePointStyle: true, pointStyle: 'circle', padding: 14, font: { size: 11 } }
    },
    tooltip: tooltipStyle,
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#6e7681', maxTicksLimit: 12, maxRotation: 45, font: { size: 10 } } },
    y: { grid: { color: '#252e38' }, ticks: { color: '#6e7681', font: { size: 10 } }, border: { display: false } },
  },
}

const barOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: tooltipStyle },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#6e7681', maxTicksLimit: 12, maxRotation: 45, font: { size: 10 } } },
    y: { grid: { color: '#252e38' }, ticks: { color: '#6e7681', font: { size: 10 } }, border: { display: false } },
  },
}

// Stats résumées
const stats = computed(() => {
  if (!progression.value || !progression.value.history.length) return null
  const hist = progression.value.history
  const sessions = props.workout.exerciseProgression(selectedExercise.value, 'session').history
  return {
    sessions: sessions.length,
    bestRM: Math.max(...hist.map(h => h.best1RM)),
    maxWeight: Math.max(...hist.map(h => h.maxWeight)),
    totalVolume: sessions.reduce((a, h) => a + h.volume, 0),
  }
})
</script>

<template>
  <div class="space-y-4 fade-in">
    <h2 class="text-lg font-semibold tracking-tight">Progression par exercice</h2>

    <!-- Search + selector -->
    <div class="soft-card p-4">
      <div class="relative mb-3">
        <svg viewBox="0 0 24 24" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>
        </svg>
        <input v-model="searchQuery" type="search" placeholder="Rechercher un exercice…" class="w-full pl-9"/>
      </div>
      <div class="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
        <button v-for="ex in filteredExercises" :key="ex"
          @click="selectedExercise = ex"
          :class="[
            'px-2.5 py-1 text-[11px] rounded-md border transition-colors',
            selectedExercise === ex
              ? 'bg-accent border-accent text-bg font-medium'
              : 'border-border text-text-muted hover:text-text hover:border-border-strong'
          ]">
          {{ ex }}
        </button>
      </div>
    </div>

    <template v-if="progression && progression.history.length">
      <!-- Stats card -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="soft-card p-3">
          <p class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Séances</p>
          <p class="text-xl font-semibold">{{ stats.sessions }}</p>
        </div>
        <div class="soft-card p-3">
          <p class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Meilleur 1RM</p>
          <p class="text-xl font-semibold text-accent-strong font-mono">{{ Math.round(stats.bestRM * 10) / 10 }} kg</p>
        </div>
        <div class="soft-card p-3">
          <p class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Poids max</p>
          <p class="text-xl font-semibold text-secondary font-mono">{{ stats.maxWeight }} kg</p>
        </div>
        <div class="soft-card p-3">
          <p class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Volume total</p>
          <p class="text-xl font-semibold font-mono">{{ Math.round(stats.totalVolume).toLocaleString('fr-FR') }}</p>
        </div>
      </div>

      <!-- Toggle agg mode -->
      <div class="flex items-center justify-end">
        <div class="pill-toggle">
          <button :class="{ active: aggMode === 'session' }" @click="aggMode = 'session'">Par séance</button>
          <button :class="{ active: aggMode === 'week' }" @click="aggMode = 'week'">Par semaine</button>
        </div>
      </div>

      <!-- Charts -->
      <div class="soft-card p-4">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
          Évolution — 1RM estimé & poids max
        </h3>
        <div class="h-64"><Line :data="performanceChart" :options="lineOptions" /></div>
      </div>

      <div class="soft-card p-4">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Volume</h3>
        <div class="h-48"><Bar :data="volumeChart" :options="barOptions" /></div>
      </div>

      <!-- Meilleure séance (volume hors warm-up) -->
      <div v-if="progression.bestVolumeSession" class="soft-card p-4 border-secondary/30">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider">
            🏅 Meilleure séance — volume
          </h3>
          <span class="text-[10px] text-text-faint">warm-ups exclus</span>
        </div>
        <div class="flex flex-wrap items-baseline gap-x-6 gap-y-2 mb-3">
          <div>
            <p class="text-[10px] text-text-faint uppercase tracking-wide">Date</p>
            <p class="text-sm font-medium">{{ formatDateShort(progression.bestVolumeSession.date) }}</p>
          </div>
          <div>
            <p class="text-[10px] text-text-faint uppercase tracking-wide">Volume</p>
            <p class="text-lg font-semibold text-secondary font-mono">
              {{ Math.round(progression.bestVolumeSession.volume).toLocaleString('fr-FR') }} kg
            </p>
          </div>
          <div>
            <p class="text-[10px] text-text-faint uppercase tracking-wide">Séries</p>
            <p class="text-sm font-medium font-mono">{{ progression.bestVolumeSession.sets.length }}</p>
          </div>
          <div>
            <p class="text-[10px] text-text-faint uppercase tracking-wide">1RM ce jour-là</p>
            <p class="text-sm font-medium font-mono text-accent-strong">
              {{ progression.bestVolumeSession.best1RM }} kg
            </p>
          </div>
        </div>
        <details class="text-xs">
          <summary class="cursor-pointer text-text-muted hover:text-text select-none">
            Détail des séries
          </summary>
          <div class="mt-2 space-y-0.5 pl-2 border-l border-border">
            <div v-for="(set, si) in progression.bestVolumeSession.sets" :key="si"
              class="flex items-center gap-3 py-0.5">
              <span :class="[
                'w-14 text-[10px] uppercase tracking-wide',
                set.setType === 'failure' ? 'text-danger' :
                set.setType === 'dropset' ? 'text-warning' :
                'text-text-muted'
              ]">{{ set.setType }}</span>
              <span class="font-mono text-text">
                {{ set.weightKg }}<span class="text-text-faint">kg</span>
                <span class="text-text-faint mx-1">×</span>
                {{ set.reps }}
              </span>
              <span v-if="set.rpe" class="text-[10px] text-text-faint ml-auto font-mono">
                RPE {{ set.rpe }}
              </span>
            </div>
          </div>
        </details>
      </div>

      <!-- Top 5 -->
      <div class="soft-card overflow-hidden">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider px-4 pt-4 pb-2">
          Top 5 performances
        </h3>
        <table class="w-full text-sm">
          <thead>
            <tr class="text-text-faint text-[10px] uppercase tracking-wider border-y border-border">
              <th class="text-left py-2 px-4 font-medium">#</th>
              <th class="text-left py-2 px-4 font-medium">Date</th>
              <th class="text-right py-2 px-4 font-medium">Charge</th>
              <th class="text-right py-2 px-4 font-medium">Reps</th>
              <th class="text-right py-2 px-4 font-medium">1RM</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(p, i) in progression.top5" :key="i" class="border-b border-border last:border-0">
              <td class="py-2.5 px-4 text-text-faint">{{ i + 1 }}</td>
              <td class="py-2.5 px-4">{{ formatDateShort(p.date) }}</td>
              <td class="py-2.5 px-4 text-right font-mono">{{ p.bestWeight }} kg</td>
              <td class="py-2.5 px-4 text-right font-mono">{{ p.bestReps }}</td>
              <td class="py-2.5 px-4 text-right font-mono font-semibold text-accent-strong">{{ p.best1RM }} kg</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <div v-else-if="selectedExercise" class="text-center py-12 text-text-muted">
      Aucune donnée pour cet exercice.
    </div>
  </div>
</template>
