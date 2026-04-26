<script setup>
import { ref, computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { formatDuration } from '../utils/dateUtils'

const props = defineProps(['workout'])
const period = ref('all')

const periods = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1A' },
  { value: 'all', label: 'Tout' },
]

const filteredSessions = computed(() => props.workout.filterByPeriod(props.workout.sessions.value, period.value))

const totalVolume = computed(() => filteredSessions.value.reduce((a, s) => a + s.totalVolume, 0))
const totalSessions = computed(() => filteredSessions.value.length)
const totalSets = computed(() => filteredSessions.value.reduce((a, s) => a + s.exercises.reduce((b, e) => b + e.workingSets.length, 0), 0))
const avgDur = computed(() => props.workout.avgDuration(period.value))

const weeklyVolumeData = computed(() => {
  const data = props.workout.volumeByWeek(period.value)
  return {
    labels: data.map(d => d.week.replace(/^\d{4}-/, '').replace('W', 'S')),
    datasets: [{
      data: data.map(d => Math.round(d.volume)),
      backgroundColor: 'rgba(94, 184, 196, 0.6)',
      borderColor: '#5eb8c4',
      borderWidth: 1,
      borderRadius: 3,
    }]
  }
})

const monthlyVolumeData = computed(() => {
  const mLabels = ['Janv', 'Févr', 'Mars', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sept', 'Oct', 'Nov', 'Déc']
  const data = props.workout.volumeByMonth.value
  return {
    labels: data.map(d => {
      const [y, m] = d.month.split('-')
      return `${mLabels[parseInt(m) - 1]} ${y.slice(2)}`
    }),
    datasets: [{
      data: data.map(d => Math.round(d.volume)),
      backgroundColor: 'rgba(183, 148, 246, 0.5)',
      borderColor: '#b794f6',
      borderWidth: 1,
      borderRadius: 3,
    }]
  }
})

const frequencyData = computed(() => {
  const data = props.workout.frequencyByWeek(period.value)
  return {
    labels: data.map(d => d.week.replace(/^\d{4}-/, '').replace('W', 'S')),
    datasets: [{
      data: data.map(d => d.count),
      backgroundColor: 'rgba(126, 167, 232, 0.5)',
      borderColor: '#7ea7e8',
      borderWidth: 1,
      borderRadius: 3,
    }]
  }
})

const topExData = computed(() => {
  const data = props.workout.topExercises(8, period.value)
  return {
    labels: data.map(d => d.name.length > 30 ? d.name.slice(0, 30) + '…' : d.name),
    datasets: [{
      data: data.map(d => d.count),
      backgroundColor: data.map((_, i) => `rgba(94, 184, 196, ${0.85 - i * 0.07})`),
      borderRadius: 3,
    }]
  }
})

const tooltipStyle = {
  backgroundColor: '#1f2730',
  titleColor: '#e6edf3',
  bodyColor: '#8b949e',
  borderColor: '#2d3742',
  borderWidth: 1,
  cornerRadius: 6,
  padding: 10,
  titleFont: { size: 12, weight: 'normal' },
  bodyFont: { size: 12 },
}

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: tooltipStyle },
  scales: {
    x: { grid: { display: false }, ticks: { maxTicksLimit: 12, maxRotation: 0, color: '#6e7681', font: { size: 10 } } },
    y: { grid: { color: '#252e38' }, ticks: { maxTicksLimit: 5, color: '#6e7681', font: { size: 10 } }, border: { display: false } }
  },
}

const horizontalOptions = {
  ...baseOptions,
  indexAxis: 'y',
  scales: {
    x: { grid: { color: '#252e38' }, ticks: { color: '#6e7681', font: { size: 10 } }, border: { display: false } },
    y: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 11 } }, border: { display: false } },
  },
}

function formatVolume(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return Math.round(v / 1000) + 'k'
  return Math.round(v).toString()
}
</script>

<template>
  <div class="space-y-5 fade-in">
    <!-- Period filter -->
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold tracking-tight">Statistiques</h2>
      <div class="pill-toggle">
        <button v-for="p in periods" :key="p.value"
          :class="{ active: period === p.value }"
          @click="period = p.value">{{ p.label }}</button>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
      <div class="soft-card p-4">
        <p class="text-text-muted text-[11px] uppercase tracking-wider mb-2">Volume total</p>
        <p class="text-2xl font-semibold tracking-tight">
          {{ formatVolume(totalVolume) }}<span class="text-sm text-text-faint font-normal ml-1">kg</span>
        </p>
      </div>
      <div class="soft-card p-4">
        <p class="text-text-muted text-[11px] uppercase tracking-wider mb-2">Séances</p>
        <p class="text-2xl font-semibold tracking-tight">{{ totalSessions }}</p>
      </div>
      <div class="soft-card p-4">
        <p class="text-text-muted text-[11px] uppercase tracking-wider mb-2">Séries</p>
        <p class="text-2xl font-semibold tracking-tight">{{ totalSets }}</p>
      </div>
      <div class="soft-card p-4">
        <p class="text-text-muted text-[11px] uppercase tracking-wider mb-2">Durée moyenne</p>
        <p class="text-2xl font-semibold tracking-tight">{{ formatDuration(avgDur) }}</p>
      </div>
    </div>

    <!-- Charts -->
    <div class="grid lg:grid-cols-2 gap-4">
      <div class="soft-card p-4">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Volume hebdomadaire</h3>
        <div class="h-56"><Bar :data="weeklyVolumeData" :options="baseOptions" /></div>
      </div>
      <div class="soft-card p-4">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Volume mensuel</h3>
        <div class="h-56"><Bar :data="monthlyVolumeData" :options="baseOptions" /></div>
      </div>
      <div class="soft-card p-4">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Fréquence (séances/semaine)</h3>
        <div class="h-56"><Bar :data="frequencyData" :options="baseOptions" /></div>
      </div>
      <div class="soft-card p-4">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Top exercices</h3>
        <div class="h-56"><Bar :data="topExData" :options="horizontalOptions" /></div>
      </div>
    </div>
  </div>
</template>
