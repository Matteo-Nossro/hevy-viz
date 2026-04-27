<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'

const props = defineProps({
  scan: { type: Object, required: true },
})

// Segments dans l'ordre d'affichage (bras en haut, tronc au milieu, jambes en bas)
const SEGMENTS = [
  { rightKey: 'segmental_lean_right_arm_kg',  leftKey: 'segmental_lean_left_arm_kg',  label: 'Bras' },
  { rightKey: 'segmental_lean_right_leg_kg',  leftKey: 'segmental_lean_left_leg_kg',  label: 'Jambes' },
]
const TRUNK_KEY = 'segmental_lean_trunk_kg'

// Paires droite/gauche pour détection d'asymétrie
const pairs = computed(() => SEGMENTS.map(seg => {
  const right = props.scan[seg.rightKey]
  const left  = props.scan[seg.leftKey]
  if (right === null || left === null) return null
  const max = Math.max(right, left)
  const asymPct = max > 0 ? Math.abs(right - left) / max * 100 : 0
  return { label: seg.label, right, left, asymPct }
}).filter(Boolean))

const trunkValue = computed(() => props.scan[TRUNK_KEY])

// Chart horizontal symétrique
// Gauche : valeurs négatives (axe gauche), Droite : valeurs positives (axe droite)
const chartLabels = computed(() => pairs.value.map(p => p.label))

const chartData = computed(() => ({
  labels: chartLabels.value,
  datasets: [
    {
      label: 'Gauche',
      data: pairs.value.map(p => -p.left),
      backgroundColor: pairs.value.map(p =>
        p.asymPct > 5 ? 'rgba(232, 185, 107, 0.7)' : 'rgba(94, 184, 196, 0.7)'
      ),
      borderColor: pairs.value.map(p =>
        p.asymPct > 5 ? '#e8b96b' : '#5eb8c4'
      ),
      borderWidth: 1.5,
      borderRadius: 4,
    },
    {
      label: 'Droite',
      data: pairs.value.map(p => p.right),
      backgroundColor: pairs.value.map(p =>
        p.asymPct > 5 ? 'rgba(232, 185, 107, 0.7)' : 'rgba(183, 148, 246, 0.7)'
      ),
      borderColor: pairs.value.map(p =>
        p.asymPct > 5 ? '#e8b96b' : '#b794f6'
      ),
      borderWidth: 1.5,
      borderRadius: 4,
    },
  ],
}))

const maxVal = computed(() => {
  const vals = pairs.value.flatMap(p => [p.right, p.left])
  return Math.max(...vals, 0)
})

const chartOptions = computed(() => ({
  indexAxis: 'y',
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
          const val = Math.abs(ctx.parsed.x)
          const side = ctx.dataset.label
          return `${side} : ${val.toFixed(2)} kg`
        },
      },
    },
  },
  scales: {
    x: {
      min: -maxVal.value * 1.2,
      max: maxVal.value * 1.2,
      grid: { color: '#252e38' },
      ticks: {
        color: '#6e7681',
        font: { size: 10 },
        callback: v => Math.abs(v).toFixed(1),
      },
      border: { display: false },
    },
    y: {
      grid: { display: false },
      ticks: { color: '#8b949e', font: { size: 11 } },
    },
  },
}))

const asymmetryWarnings = computed(() =>
  pairs.value.filter(p => p.asymPct > 5)
)

const hasData = computed(() => pairs.value.length > 0 || trunkValue.value !== null)
</script>

<template>
  <div class="space-y-4">
    <div v-if="!hasData" class="text-center py-6 text-text-muted text-sm">
      Aucune donnée segmentaire dans ce scan.
    </div>

    <template v-else>
      <!-- Tronc séparé (pas de symétrie) -->
      <div v-if="trunkValue !== null" class="soft-card p-4">
        <p class="text-xs text-text-muted uppercase tracking-wider mb-1">Tronc</p>
        <div class="flex items-center gap-3">
          <div class="flex-1 h-3 rounded-full overflow-hidden bg-surface-hover">
            <div
              class="h-full rounded-full"
              style="background: linear-gradient(90deg, #5eb8c4, #b794f6)"
              :style="{ width: '100%' }"
            ></div>
          </div>
          <span class="text-sm font-mono text-accent-strong font-semibold">{{ trunkValue.toFixed(2) }} kg</span>
        </div>
      </div>

      <!-- Chart symétrique bras / jambes -->
      <div v-if="pairs.length" class="soft-card p-4">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider">Symétrie droite / gauche</h3>
          <div class="flex items-center gap-3 text-[11px] text-text-faint">
            <span class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background: rgba(94,184,196,0.7)"></span>
              Droite
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2.5 h-2.5 rounded-sm inline-block" style="background: rgba(183,148,246,0.7)"></span>
              Gauche
            </span>
          </div>
        </div>

        <div :style="{ height: pairs.length * 56 + 40 + 'px' }">
          <Bar :data="chartData" :options="chartOptions" />
        </div>

        <!-- Valeurs numériques sous le chart -->
        <div class="mt-3 space-y-1.5">
          <div v-for="pair in pairs" :key="pair.label" class="flex items-center justify-between text-xs">
            <span class="font-mono text-accent">{{ pair.right.toFixed(2) }} kg</span>
            <span class="text-text-muted">{{ pair.label }}</span>
            <span class="font-mono text-secondary">{{ pair.left.toFixed(2) }} kg</span>
          </div>
        </div>
      </div>

      <!-- Avertissements asymétrie -->
      <div v-if="asymmetryWarnings.length" class="soft-card p-3 border-warning/30" style="border-color: rgba(232,185,107,0.3)">
        <p class="text-xs font-medium text-warning mb-1">Asymétrie détectée (&gt; 5%)</p>
        <ul class="space-y-0.5">
          <li v-for="w in asymmetryWarnings" :key="w.label" class="text-xs text-text-muted">
            {{ w.label }} : {{ w.asymPct.toFixed(1) }}% d'écart
            (D {{ w.right.toFixed(2) }} / G {{ w.left.toFixed(2) }} kg)
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
