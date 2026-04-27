<script setup>
import { ref, computed } from 'vue'
import { INBODY_FIELDS, INBODY_CATEGORIES } from '../config/inbodyFields'
import { formatDateShort } from '../utils/dateUtils'

const props = defineProps({
  scans: { type: Array, required: true },
})

const idxA = ref(0)
const idxB = ref(1)

const scanA = computed(() => props.scans[idxA.value] ?? null)
const scanB = computed(() => props.scans[idxB.value] ?? null)

function deltaColor(field, abs) {
  if (field.higherIsBetter === null || abs === null) return 'text-text-muted'
  if (abs === 0) return 'text-text-muted'
  const good = field.higherIsBetter ? abs > 0 : abs < 0
  return good ? 'text-success' : 'text-danger'
}

function deltaIcon(field, abs) {
  if (abs === null || abs === 0) return '—'
  if (abs > 0) return '▲'
  return '▼'
}

function fmt(val, field) {
  if (val === null || val === undefined) return '—'
  return Number(val).toFixed(field.decimals) + (field.unit ? ' ' + field.unit : '')
}

function fmtDelta(abs, field) {
  if (abs === null) return ''
  const sign = abs > 0 ? '+' : ''
  return `${sign}${Number(abs).toFixed(field.decimals)}${field.unit ? ' ' + field.unit : ''}`
}

function getDelta(field) {
  if (!scanA.value || !scanB.value) return null
  const a = scanA.value[field.key]
  const b = scanB.value[field.key]
  if (a === null || b === null) return null
  return b - a
}

// Bilan : n'affiche que les métriques clés du résumé
const keyHighlights = computed(() => {
  if (!scanA.value || !scanB.value) return []
  const days = Math.round(
    Math.abs(scanB.value.scan_date - scanA.value.scan_date) / (1000 * 60 * 60 * 24)
  )
  const muscle = INBODY_FIELDS.find(f => f.key === 'skeletal_muscle_mass_kg')
  const fat = INBODY_FIELDS.find(f => f.key === 'body_fat_mass_kg')
  const items = []
  const dMuscle = getDelta(muscle)
  const dFat = getDelta(fat)
  if (dMuscle !== null) {
    const sign = dMuscle > 0 ? '+' : ''
    items.push({
      text: `${sign}${dMuscle.toFixed(1)} kg de masse musculaire`,
      good: dMuscle > 0,
    })
  }
  if (dFat !== null) {
    const sign = dFat > 0 ? '+' : ''
    items.push({
      text: `${sign}${dFat.toFixed(1)} kg de masse grasse`,
      good: dFat < 0,
    })
  }
  return { items, days }
})

// Categories with at least one non-null value in either scan
const activeCategories = computed(() => {
  return Object.entries(INBODY_CATEGORIES)
    .sort((a, b) => a[1].order - b[1].order)
    .filter(([cat]) => {
      const fields = INBODY_FIELDS.filter(f => f.category === cat)
      return fields.some(f =>
        (scanA.value?.[f.key] !== null) || (scanB.value?.[f.key] !== null)
      )
    })
})
</script>

<template>
  <div class="space-y-4">
    <!-- Sélecteurs -->
    <div class="flex flex-col sm:flex-row gap-3">
      <div class="flex-1">
        <label class="block text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Scan A</label>
        <select
          v-model.number="idxA"
          class="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
        >
          <option v-for="(scan, i) in scans" :key="scan.id" :value="i">
            {{ formatDateShort(scan.scan_date) }}
          </option>
        </select>
      </div>
      <div class="flex-1">
        <label class="block text-[11px] text-text-muted uppercase tracking-wider mb-1.5">Scan B</label>
        <select
          v-model.number="idxB"
          class="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
        >
          <option v-for="(scan, i) in scans" :key="scan.id" :value="i">
            {{ formatDateShort(scan.scan_date) }}
          </option>
        </select>
      </div>
    </div>

    <!-- Bilan express -->
    <div
      v-if="keyHighlights.items?.length"
      class="soft-card p-4 border-accent/20"
      style="border-color: rgba(94,184,196,0.2); background: rgba(94,184,196,0.04);"
    >
      <p class="text-xs text-text-muted uppercase tracking-wider mb-2">Bilan sur {{ keyHighlights.days }} jours</p>
      <div class="flex flex-wrap gap-3">
        <span
          v-for="item in keyHighlights.items"
          :key="item.text"
          class="text-sm font-medium"
          :class="item.good ? 'text-success' : 'text-danger'"
        >
          {{ item.text }}
        </span>
      </div>
    </div>

    <!-- Tableau comparatif -->
    <div
      v-for="[cat, meta] in activeCategories"
      :key="cat"
      class="soft-card overflow-hidden"
    >
      <div class="px-4 py-2.5 border-b border-border bg-surface-hover">
        <span class="text-xs font-medium text-text-muted uppercase tracking-wider">{{ meta.label }}</span>
      </div>

      <!-- En-tête colonnes (mobile: empilé, desktop: 3 colonnes) -->
      <div class="hidden sm:grid grid-cols-[1fr_auto_1fr_auto] gap-0 px-4 pt-2.5 pb-1 text-[11px] text-text-faint">
        <span>{{ formatDateShort(scanA?.scan_date) }}</span>
        <span class="w-24 text-center">Évolution</span>
        <span class="text-right">{{ formatDateShort(scanB?.scan_date) }}</span>
        <span></span>
      </div>

      <div class="divide-y divide-border">
        <div
          v-for="field in INBODY_FIELDS.filter(f => f.category === cat)"
          :key="field.key"
          v-show="scanA?.[field.key] !== null || scanB?.[field.key] !== null"
        >
          <!-- Desktop: ligne en 4 cols -->
          <div class="hidden sm:grid grid-cols-[1fr_auto_1fr_auto] gap-0 items-center px-4 py-2.5">
            <span class="text-sm font-mono text-text">{{ fmt(scanA?.[field.key], field) }}</span>
            <div class="w-24 flex flex-col items-center">
              <span class="text-[11px] text-text-faint mb-0.5">{{ field.shortLabel ?? field.label }}</span>
              <span
                v-if="getDelta(field) !== null"
                class="text-xs font-medium"
                :class="deltaColor(field, getDelta(field))"
              >
                {{ deltaIcon(field, getDelta(field)) }} {{ fmtDelta(getDelta(field), field) }}
              </span>
              <span v-else class="text-xs text-text-faint">—</span>
            </div>
            <span class="text-sm font-mono text-text text-right">{{ fmt(scanB?.[field.key], field) }}</span>
            <span></span>
          </div>

          <!-- Mobile: empilé -->
          <div class="sm:hidden px-4 py-2.5 space-y-1">
            <p class="text-[11px] text-text-muted">{{ field.label }}</p>
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-mono">{{ fmt(scanA?.[field.key], field) }}</span>
              <span
                v-if="getDelta(field) !== null"
                class="text-xs font-medium px-1.5 py-0.5 rounded"
                :class="deltaColor(field, getDelta(field))"
              >
                {{ deltaIcon(field, getDelta(field)) }} {{ fmtDelta(getDelta(field), field) }}
              </span>
              <span class="text-sm font-mono">{{ fmt(scanB?.[field.key], field) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
