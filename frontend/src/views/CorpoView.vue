<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import { formatDateShort } from '../utils/dateUtils'

const props = defineProps(['measurement'])

const selectedMetric = ref('weight_kg')

const series = computed(() => {
  return props.measurement.getMetricSeries(selectedMetric.value)
})

const chartData = computed(() => {
  return {
    labels: series.value.map(s => formatDateShort(s.date)),
    datasets: [{
      label: props.measurement.METRIC_LABELS[selectedMetric.value],
      data: series.value.map(s => s.value),
      borderColor: '#5eb8c4',
      backgroundColor: 'rgba(94, 184, 196, 0.08)',
      borderWidth: 2.5,
      pointRadius: 3,
      pointBackgroundColor: '#5eb8c4',
      tension: 0.25,
      fill: true,
    }]
  }
})

const stats = computed(() => {
  if (!series.value.length) return null
  const values = series.value.map(s => s.value)
  const first = values[0]
  const last = values[values.length - 1]
  return {
    current: last,
    min: Math.min(...values),
    max: Math.max(...values),
    delta: last - first,
    pct: first > 0 ? ((last - first) / first * 100) : 0,
  }
})

const chartOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#1f2730', titleColor: '#e6edf3', bodyColor: '#8b949e',
      borderColor: '#2d3742', borderWidth: 1, cornerRadius: 6, padding: 10,
    }
  },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#6e7681', maxTicksLimit: 12, maxRotation: 0, font: { size: 10 } } },
    y: { grid: { color: '#252e38' }, ticks: { color: '#6e7681', font: { size: 10 } }, border: { display: false } },
  },
}
</script>

<template>
  <div class="space-y-4 fade-in">
    <h2 class="text-lg font-semibold tracking-tight">Mensurations corporelles</h2>

    <!-- Métrique sélecteur -->
    <div class="flex flex-wrap gap-1.5">
      <button v-for="m in measurement.availableMetrics.value" :key="m"
        @click="selectedMetric = m"
        :class="[
          'px-2.5 py-1.5 text-xs rounded-md border transition-colors',
          selectedMetric === m
            ? 'bg-accent border-accent text-bg font-medium'
            : 'border-border text-text-muted hover:text-text hover:border-border-strong'
        ]">
        {{ measurement.METRIC_LABELS[m] }}
      </button>
    </div>

    <template v-if="stats">
      <!-- KPIs -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="soft-card p-4">
          <p class="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Actuel</p>
          <p class="text-2xl font-semibold font-mono text-accent-strong">{{ stats.current }}</p>
        </div>
        <div class="soft-card p-4">
          <p class="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Minimum</p>
          <p class="text-2xl font-semibold font-mono">{{ stats.min }}</p>
        </div>
        <div class="soft-card p-4">
          <p class="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Maximum</p>
          <p class="text-2xl font-semibold font-mono">{{ stats.max }}</p>
        </div>
        <div class="soft-card p-4">
          <p class="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Évolution</p>
          <p class="text-2xl font-semibold font-mono"
            :class="stats.delta >= 0 ? 'text-success' : 'text-danger'">
            {{ stats.delta > 0 ? '+' : '' }}{{ stats.delta.toFixed(1) }}
          </p>
          <p class="text-[11px] text-text-faint mt-0.5 font-mono">
            {{ stats.pct > 0 ? '+' : '' }}{{ stats.pct.toFixed(1) }}%
          </p>
        </div>
      </div>

      <!-- Chart -->
      <div class="soft-card p-4">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
          {{ measurement.METRIC_LABELS[selectedMetric] }}
        </h3>
        <div class="h-72"><Line :data="chartData" :options="chartOptions" /></div>
      </div>
    </template>

    <div v-else class="text-center py-16 text-text-muted">
      Aucune donnée pour cette métrique.
    </div>
  </div>
</template>
