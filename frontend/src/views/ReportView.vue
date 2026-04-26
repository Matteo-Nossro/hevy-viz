<script setup>
import { ref, computed, watch } from 'vue'
import { Bar, Line } from 'vue-chartjs'
import { MONTHS_FR, formatDateShort, formatDuration } from '../utils/dateUtils'
import AnatomyHeatmap from '../components/AnatomyHeatmap.vue'

const props = defineProps(['workout'])

// Démarrer sur le mois de la dernière donnée
const lastDate = computed(() => props.workout.lastDataDate.value)
const viewYear = ref(lastDate.value.getFullYear())
const viewMonth = ref(lastDate.value.getMonth())

watch(lastDate, (d) => {
  viewYear.value = d.getFullYear()
  viewMonth.value = d.getMonth()
})

const report = computed(() => props.workout.monthlyReport(viewYear.value, viewMonth.value))

const monthRange = computed(() => {
  const start = new Date(viewYear.value, viewMonth.value, 1)
  const end = new Date(viewYear.value, viewMonth.value + 1, 0, 23, 59, 59)
  return { start, end }
})

// Heatmap anatomique du mois
const anatomyData = computed(() => {
  return props.workout.setsByMuscleGroup(monthRange.value.start, monthRange.value.end)
})

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- } else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ } else viewMonth.value++
}

function formatVolume(v) {
  if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M'
  if (v >= 1000) return Math.round(v / 1000) + 'k'
  return Math.round(v).toString()
}

const tooltipStyle = {
  backgroundColor: '#1f2730', titleColor: '#e6edf3', bodyColor: '#8b949e',
  borderColor: '#2d3742', borderWidth: 1, cornerRadius: 6, padding: 10,
}

const weeklyVolumeData = computed(() => {
  if (!report.value) return { labels: [], datasets: [] }
  return {
    labels: report.value.weeklyVolume.map(w => 'S' + w.week.split('-W')[1]),
    datasets: [{
      data: report.value.weeklyVolume.map(w => Math.round(w.volume)),
      backgroundColor: 'rgba(94, 184, 196, 0.6)',
      borderColor: '#5eb8c4',
      borderWidth: 1,
      borderRadius: 4,
    }]
  }
})

const weeklyFreqData = computed(() => {
  if (!report.value) return { labels: [], datasets: [] }
  return {
    labels: report.value.weeklyFreq.map(w => 'S' + w.week.split('-W')[1]),
    datasets: [{
      data: report.value.weeklyFreq.map(w => w.count),
      backgroundColor: 'rgba(183, 148, 246, 0.55)',
      borderColor: '#b794f6',
      borderWidth: 1,
      borderRadius: 4,
    }]
  }
})

const muscleData = computed(() => {
  if (!report.value) return { labels: [], datasets: [] }
  return {
    labels: report.value.muscleRepart.map(m => m.group),
    datasets: [{
      data: report.value.muscleRepart.map(m => Math.round(m.pct * 10) / 10),
      backgroundColor: 'rgba(94, 184, 196, 0.55)',
      borderColor: '#5eb8c4',
      borderWidth: 1,
      borderRadius: 3,
    }]
  }
})

const baseOptions = {
  responsive: true, maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: tooltipStyle },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#6e7681', font: { size: 10 } } },
    y: { grid: { color: '#252e38' }, ticks: { color: '#6e7681', font: { size: 10 } }, border: { display: false } },
  },
}

const horizontalOptions = {
  ...baseOptions,
  indexAxis: 'y',
  scales: {
    x: { grid: { color: '#252e38' }, ticks: { color: '#6e7681', font: { size: 10 }, callback: v => v + '%' }, border: { display: false } },
    y: { grid: { display: false }, ticks: { color: '#8b949e', font: { size: 10 } }, border: { display: false } },
  },
}

function printReport() { window.print() }
</script>

<template>
  <div class="space-y-4 fade-in">
    <!-- Selector + actions -->
    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
      <h2 class="text-lg font-semibold tracking-tight">Rapport mensuel</h2>
      <div class="flex items-center gap-2">
        <button @click="prevMonth" class="btn btn-ghost p-2">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <select v-model.number="viewMonth">
          <option v-for="(m, i) in MONTHS_FR" :key="i" :value="i">{{ m }}</option>
        </select>
        <input v-model.number="viewYear" type="number" class="w-20 text-center" />
        <button @click="nextMonth" class="btn btn-ghost p-2">
          <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
        </button>
        <button @click="printReport" class="btn btn-primary ml-2">
          <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/>
          </svg>
          PDF
        </button>
      </div>
    </div>

    <template v-if="report">
      <!-- Hero header -->
      <div class="soft-card p-6" style="background: linear-gradient(135deg, rgba(94,184,196,0.08), rgba(183,148,246,0.05));">
        <p class="text-xs text-text-muted uppercase tracking-widest mb-1">Bilan du mois</p>
        <h1 class="text-3xl font-bold tracking-tight mb-1">{{ MONTHS_FR[viewMonth] }} {{ viewYear }}</h1>
        <p v-if="report.sessionCount" class="text-text-muted text-sm">
          {{ report.sessionCount }} séance{{ report.sessionCount > 1 ? 's' : '' }}
          ·
          <span class="text-accent-strong font-medium">{{ formatVolume(report.totalVolume) }} kg</span>
          de volume
          <template v-if="report.bestPerf">
            · meilleure perf : <span class="text-text">{{ report.bestPerf.exercise }}</span>
            (<span class="font-mono text-secondary">{{ Math.round(report.bestPerf.best1RM * 10) / 10 }} kg 1RM</span>)
          </template>
        </p>
        <p v-else class="text-text-muted text-sm">Aucune séance ce mois-ci.</p>
      </div>

      <template v-if="report.sessionCount > 0">
        <!-- KPIs principaux -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
          <div class="soft-card p-4">
            <p class="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Séances</p>
            <p class="text-2xl font-semibold">{{ report.sessionCount }}</p>
            <p v-if="report.prevSessionCount" class="text-[11px] mt-1"
              :class="report.sessionCount >= report.prevSessionCount ? 'text-success' : 'text-danger'">
              {{ report.sessionCount - report.prevSessionCount > 0 ? '+' : '' }}{{ report.sessionCount - report.prevSessionCount }} vs M-1
            </p>
            <p v-else class="text-[11px] text-text-faint mt-1">—</p>
          </div>
          <div class="soft-card p-4">
            <p class="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Volume</p>
            <p class="text-2xl font-semibold font-mono">{{ formatVolume(report.totalVolume) }}<span class="text-sm text-text-faint ml-0.5">kg</span></p>
            <p v-if="report.prevVolume" class="text-[11px] mt-1"
              :class="report.volumeDelta >= 0 ? 'text-success' : 'text-danger'">
              {{ report.volumeDelta > 0 ? '+' : '' }}{{ report.volumeDelta }}% vs M-1
            </p>
            <p v-else class="text-[11px] text-text-faint mt-1">—</p>
          </div>
          <div class="soft-card p-4">
            <p class="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Séries</p>
            <p class="text-2xl font-semibold">{{ report.totalSets }}</p>
            <p class="text-[11px] text-text-faint mt-1 font-mono">
              ~{{ Math.round(report.totalSets / report.sessionCount) }} / séance
            </p>
          </div>
          <div class="soft-card p-4">
            <p class="text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Fréquence</p>
            <p class="text-2xl font-semibold font-mono">{{ report.avgFrequency }}<span class="text-sm text-text-faint ml-0.5">/sem</span></p>
            <p class="text-[11px] text-text-faint mt-1">
              {{ formatDuration(Math.round(report.totalDuration / report.sessionCount)) }} en moyenne
            </p>
          </div>
        </div>

        <!-- Comparaison N-1 -->
        <div v-if="report.yearAgoVolume > 0" class="soft-card p-4">
          <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
            Comparaison année précédente
          </h3>
          <div class="grid sm:grid-cols-2 gap-4">
            <div>
              <p class="text-[10px] text-text-faint uppercase tracking-wide mb-1">{{ MONTHS_FR[viewMonth] }} {{ viewYear - 1 }}</p>
              <p class="text-lg font-mono">{{ formatVolume(report.yearAgoVolume) }} kg</p>
            </div>
            <div>
              <p class="text-[10px] text-text-faint uppercase tracking-wide mb-1">Évolution</p>
              <p class="text-lg font-semibold"
                :class="report.yearDelta >= 0 ? 'text-success' : 'text-danger'">
                {{ report.yearDelta > 0 ? '+' : '' }}{{ report.yearDelta }}%
              </p>
            </div>
          </div>
        </div>

        <!-- Charts ligne 1 : volume + fréquence par semaine -->
        <div class="grid lg:grid-cols-2 gap-4">
          <div class="soft-card p-4">
            <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Volume par semaine</h3>
            <div class="h-48"><Bar :data="weeklyVolumeData" :options="baseOptions" /></div>
          </div>
          <div class="soft-card p-4">
            <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Séances par semaine</h3>
            <div class="h-48"><Bar :data="weeklyFreqData" :options="baseOptions" /></div>
          </div>
        </div>

        <!-- Anatomie + répartition % -->
        <div class="grid lg:grid-cols-2 gap-4">
          <div class="soft-card p-4">
            <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">Carte thermique du mois</h3>
            <AnatomyHeatmap :data="anatomyData" />
          </div>
          <div class="soft-card p-4">
            <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              Répartition du volume (%)
            </h3>
            <div class="h-72"><Bar :data="muscleData" :options="horizontalOptions" /></div>
          </div>
        </div>

        <!-- Records battus + Top 3 -->
        <div class="grid lg:grid-cols-2 gap-4">
          <div class="soft-card p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider">Records battus</h3>
              <span v-if="report.recordsInMonth.length" class="badge badge-warning">
                🏆 {{ report.recordsInMonth.length }}
              </span>
            </div>
            <div v-if="report.recordsInMonth.length" class="space-y-1.5 max-h-72 overflow-y-auto">
              <div v-for="(r, i) in report.recordsInMonth" :key="i"
                class="flex items-center gap-2 text-xs py-1.5 border-b border-border last:border-0">
                <span class="badge text-[9px]"
                  :class="r.type === '1RM' ? 'badge-accent' : 'badge'">{{ r.type }}</span>
                <span class="flex-1 text-text truncate">{{ r.exercise }}</span>
                <span class="font-mono text-text-muted">{{ Math.round(r.value * 10) / 10 }} kg</span>
                <span class="text-text-faint text-[10px] w-16 text-right">{{ formatDateShort(r.date) }}</span>
              </div>
            </div>
            <p v-else class="text-text-muted text-xs py-6 text-center">
              Aucun record battu ce mois-ci. Le mois prochain peut-être !
            </p>
          </div>

          <div class="soft-card p-4">
            <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
              Top 3 — exercices par volume
            </h3>
            <div v-if="report.top3.length" class="space-y-2.5">
              <div v-for="(ex, i) in report.top3" :key="i" class="flex items-center gap-3">
                <div :class="[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold',
                  i === 0 ? 'bg-warning/20 text-warning' :
                  i === 1 ? 'bg-accent/20 text-accent-strong' :
                  'bg-surface text-text-muted'
                ]">{{ i + 1 }}</div>
                <span class="flex-1 text-sm truncate">{{ ex.name }}</span>
                <span class="font-mono text-sm text-accent-strong">{{ formatVolume(ex.volume) }} kg</span>
              </div>
            </div>
            <p v-else class="text-text-muted text-xs py-6 text-center">Aucune donnée</p>
          </div>
        </div>

        <!-- Top groupes musculaires -->
        <div v-if="report.muscleRepart.length" class="soft-card p-4">
          <h3 class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
            Volume par groupe musculaire
          </h3>
          <div class="space-y-2">
            <div v-for="m in report.muscleRepart" :key="m.group" class="flex items-center gap-3">
              <span class="text-xs w-28 flex-shrink-0">{{ m.group }}</span>
              <div class="flex-1 h-2 bg-bg-elevated rounded-full overflow-hidden">
                <div class="h-full rounded-full"
                  :style="{ width: m.pct + '%', background: 'var(--accent)' }"></div>
              </div>
              <span class="font-mono text-xs text-text-muted w-14 text-right">{{ Math.round(m.volume).toLocaleString('fr-FR') }}</span>
              <span class="font-mono text-xs text-text-faint w-12 text-right">{{ m.pct.toFixed(1) }}%</span>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
