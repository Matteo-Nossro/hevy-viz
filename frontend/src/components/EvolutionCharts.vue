<script setup>
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import annotationPlugin from 'chartjs-plugin-annotation'
import { Chart as ChartJS } from 'chart.js'
import { INBODY_FIELDS } from '../config/inbodyFields'
import { formatDateShort } from '../utils/dateUtils'

ChartJS.register(annotationPlugin)

const props = defineProps({
  inbody: { type: Object, required: true },
})

const availableFields = computed(() =>
  INBODY_FIELDS.filter(f => props.inbody.getEvolution(f.key).length >= 2)
)

const selectedKey = ref(null)

const selectedField = computed(() => {
  if (selectedKey.value) {
    const f = availableFields.value.find(f => f.key === selectedKey.value)
    if (f) return f
  }
  return availableFields.value[0] ?? null
})

// Sync selectedKey when availableFields changes (first load)
import { watch } from 'vue'
watch(availableFields, (fields) => {
  if (!selectedKey.value && fields.length) selectedKey.value = fields[0].key
}, { immediate: true })

const series = computed(() =>
  selectedField.value ? props.inbody.getEvolution(selectedField.value.key) : []
)

const chartData = computed(() => ({
  labels: series.value.map(s => formatDateShort(s.date)),
  datasets: [{
    label: selectedField.value?.label ?? '',
    data: series.value.map(s => s.value),
    borderColor: '#5eb8c4',
    backgroundColor: 'rgba(94, 184, 196, 0.08)',
    borderWidth: 2.5,
    pointRadius: 4,
    pointBackgroundColor: '#5eb8c4',
    pointBorderColor: '#161b22',
    pointBorderWidth: 1.5,
    tension: 0.25,
    fill: true,
  }],
}))

const chartOptions = computed(() => {
  const field = selectedField.value
  const annotations = {}

  if (field?.normalRange) {
    annotations.normalBand = {
      type: 'box',
      yMin: field.normalRange.min,
      yMax: field.normalRange.max,
      backgroundColor: 'rgba(103, 201, 148, 0.08)',
      borderColor: 'rgba(103, 201, 148, 0.25)',
      borderWidth: 1,
      label: {
        content: `Norme ${field.normalRange.min}–${field.normalRange.max}${field.unit ? ' ' + field.unit : ''}`,
        display: true,
        position: { x: 'end', y: 'start' },
        color: 'rgba(103, 201, 148, 0.6)',
        font: { size: 10 },
      },
    }
  }

  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1f2730',
        titleColor: '#e6edf3',
        bodyColor: '#8b949e',
        borderColor: '#2d3742',
        borderWidth: 1,
        cornerRadius: 6,
        padding: 10,
        callbacks: {
          label(ctx) {
            const val = ctx.parsed.y
            const unit = field?.unit ? ' ' + field.unit : ''
            const decimals = field?.decimals ?? 1
            let label = `${val.toFixed(decimals)}${unit}`
            if (field?.normalRange) {
              const { min, max } = field.normalRange
              if (val < min) label += ` (en dessous de la norme)`
              else if (val > max) label += ` (au-dessus de la norme)`
              else label += ` (dans la norme)`
            }
            return label
          },
        },
      },
      annotation: { annotations },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#6e7681', maxTicksLimit: 8, maxRotation: 0, font: { size: 10 } },
      },
      y: {
        grid: { color: '#252e38' },
        ticks: {
          color: '#6e7681',
          font: { size: 10 },
          callback(v) {
            return v + (field?.unit ? ' ' + field.unit : '')
          },
        },
        border: { display: false },
      },
    },
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- Sélecteur de métrique (pills) -->
    <div class="flex flex-wrap gap-1.5">
      <button
        v-for="field in availableFields"
        :key="field.key"
        @click="selectedKey = field.key"
        :class="[
          'px-2.5 py-1.5 text-xs rounded-md border transition-colors',
          selectedKey === field.key
            ? 'bg-accent border-accent text-bg font-medium'
            : 'border-border text-text-muted hover:text-text hover:border-border-strong',
        ]"
      >
        {{ field.shortLabel ?? field.label }}
        <span v-if="field.unit" class="opacity-60">&nbsp;({{ field.unit }})</span>
      </button>
    </div>

    <!-- Graphique -->
    <div v-if="selectedField && series.length >= 2" class="soft-card p-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider">
          {{ selectedField.label }}
        </h3>
        <div v-if="selectedField.normalRange" class="flex items-center gap-1.5 text-[11px] text-text-faint">
          <span class="w-3 h-2 rounded-sm inline-block" style="background: rgba(103,201,148,0.25)"></span>
          Norme {{ selectedField.normalRange.min }}–{{ selectedField.normalRange.max }}{{ selectedField.unit ? ' ' + selectedField.unit : '' }}
        </div>
      </div>
      <div class="h-72">
        <Line :data="chartData" :options="chartOptions" />
      </div>
    </div>

    <div v-else-if="!availableFields.length" class="text-center py-8 text-text-muted text-sm">
      Il faut au moins 2 scans pour afficher les graphiques d'évolution.
    </div>
  </div>
</template>
