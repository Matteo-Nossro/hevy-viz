<script setup>
import { ref, computed } from 'vue'
import { formatDateShort, formatDateFull } from '../utils/dateUtils'
import { SUMMARY_FIELDS } from '../config/inbodyFields'
import InbodyForm from '../components/InbodyForm.vue'
import ScanCompare from '../components/ScanCompare.vue'
import EvolutionCharts from '../components/EvolutionCharts.vue'
import SegmentalChart from '../components/SegmentalChart.vue'

const props = defineProps({
  inbody: { type: Object, required: true },
})

const showForm = ref(false)
const editScan = ref(null)
const deleteConfirmId = ref(null)
const activeSection = ref('compare')

const scans = computed(() => props.inbody.scans.value)
const latestScan = computed(() => props.inbody.latestScan.value)
const loading = computed(() => props.inbody.loading.value)
const error = computed(() => props.inbody.error.value)

function openAdd() {
  editScan.value = null
  showForm.value = true
}

function openEdit(scan) {
  editScan.value = scan
  showForm.value = true
}

async function handleSave({ payload, id }) {
  if (id) {
    await props.inbody.updateScan(id, payload)
  } else {
    await props.inbody.addScan(payload)
  }
  showForm.value = false
}

async function confirmDelete(id) {
  await props.inbody.deleteScan(id)
  deleteConfirmId.value = null
}

function fmt(val, field) {
  if (val === null || val === undefined) return '—'
  return Number(val).toFixed(field.decimals) + (field.unit ? ' ' + field.unit : '')
}

const segmentalScan = computed(() => {
  if (!scans.value.length) return null
  return scans.value[scans.value.length - 1]
})

const SECTIONS = [
  { id: 'compare',   label: 'Comparaison',  minScans: 2 },
  { id: 'evolution', label: 'Évolution',    minScans: 2 },
  { id: 'segmental', label: 'Segmentaire',  minScans: 1 },
  { id: 'list',      label: 'Tous les scans', minScans: 1 },
]

const availableSections = computed(() =>
  SECTIONS.filter(s => scans.value.length >= s.minScans)
)
</script>

<template>
  <div class="space-y-6 fade-in">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold tracking-tight">InBody — Composition corporelle</h2>
      <button @click="openAdd" class="btn bg-accent border-accent text-bg font-medium hover:bg-accent-strong flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M12 5v14M5 12h14" stroke-linecap="round"/>
        </svg>
        <span class="hidden sm:inline">Ajouter un scan</span>
        <span class="sm:hidden">Scan</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-16">
      <div class="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="soft-card p-4 border-danger/30 text-danger text-sm" style="border-color: rgba(224,122,122,0.3)">
      Erreur : {{ error }}
    </div>

    <!-- État vide -->
    <div v-else-if="!scans.length" class="flex flex-col items-center justify-center py-20 gap-4">
      <div class="w-16 h-16 rounded-full flex items-center justify-center" style="background: var(--accent-soft)">
        <svg viewBox="0 0 24 24" class="w-8 h-8 text-accent" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" stroke-linecap="round"/>
          <path d="M12 8v4l3 3" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="text-center">
        <p class="font-medium text-text mb-1">Aucun scan InBody</p>
        <p class="text-sm text-text-muted">Ajoutez votre premier scan pour commencer le suivi.</p>
      </div>
      <button @click="openAdd" class="btn bg-accent border-accent text-bg font-medium hover:bg-accent-strong">
        Ajouter un scan
      </button>
    </div>

    <template v-else>
      <!-- Carte dernier scan -->
      <div class="soft-card p-4">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div>
            <p class="text-[11px] text-text-muted uppercase tracking-wider mb-0.5">Dernier scan</p>
            <p class="font-medium text-text">{{ formatDateFull(latestScan.scan_date) }}</p>
          </div>
          <button @click="openEdit(latestScan)" class="btn text-xs py-1 px-2.5">Modifier</button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div v-for="field in SUMMARY_FIELDS" :key="field.key" class="space-y-0.5">
            <p class="text-[10px] text-text-faint uppercase tracking-wider">{{ field.shortLabel ?? field.label }}</p>
            <p class="text-base font-semibold font-mono text-accent-strong">
              {{ fmt(latestScan[field.key], field) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Navigation sections -->
      <div class="flex gap-1 flex-wrap">
        <button
          v-for="sec in availableSections"
          :key="sec.id"
          @click="activeSection = sec.id"
          :class="[
            'px-3 py-1.5 text-xs font-medium rounded-md border transition-colors',
            activeSection === sec.id
              ? 'bg-accent border-accent text-bg'
              : 'border-border text-text-muted hover:text-text hover:border-border-strong',
          ]"
        >
          {{ sec.label }}
        </button>
      </div>

      <!-- Section : Comparaison -->
      <ScanCompare
        v-if="activeSection === 'compare' && scans.length >= 2"
        :scans="scans"
      />

      <!-- Section : Évolution -->
      <EvolutionCharts
        v-else-if="activeSection === 'evolution'"
        :inbody="inbody"
      />

      <!-- Section : Segmentaire -->
      <div v-else-if="activeSection === 'segmental'">
        <div class="soft-card p-4 mb-3">
          <div class="flex items-center gap-2 mb-3">
            <p class="text-xs text-text-muted uppercase tracking-wider">Scan analysé</p>
          </div>
          <div class="flex gap-2 flex-wrap">
            <button
              v-for="(scan, i) in scans"
              :key="scan.id"
              @click="() => { $refs.segmentalRef && ($refs.segmentalRef.selectedIdx = i) }"
              class="px-2.5 py-1 text-xs border border-border rounded text-text-muted hover:border-accent hover:text-accent transition-colors"
            >
              {{ formatDateShort(scan.scan_date) }}
            </button>
          </div>
        </div>
        <SegmentalChart
          v-if="segmentalScan"
          :scan="segmentalScan"
          ref="segmentalRef"
        />
      </div>

      <!-- Section : Liste des scans -->
      <div v-else-if="activeSection === 'list'" class="space-y-2">
        <div
          v-for="scan in [...scans].reverse()"
          :key="scan.id"
          class="soft-card p-4 flex items-center gap-4"
        >
          <div class="flex-1 min-w-0">
            <p class="font-medium text-sm text-text">{{ formatDateFull(scan.scan_date) }}</p>
            <div class="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
              <span
                v-for="field in SUMMARY_FIELDS.filter(f => scan[f.key] !== null)"
                :key="field.key"
                class="text-[11px] text-text-muted"
              >
                {{ field.shortLabel ?? field.label }}: <span class="text-text font-mono">{{ fmt(scan[field.key], field) }}</span>
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2 flex-shrink-0">
            <button @click="openEdit(scan)" class="btn text-xs py-1 px-2.5">Modifier</button>
            <button
              v-if="deleteConfirmId !== scan.id"
              @click="deleteConfirmId = scan.id"
              class="btn text-xs py-1 px-2.5 text-danger border-danger/30 hover:bg-danger/10"
              style="border-color: rgba(224,122,122,0.3)"
            >
              Supprimer
            </button>
            <div v-else class="flex items-center gap-1.5">
              <button @click="confirmDelete(scan.id)" class="btn text-xs py-1 px-2.5 bg-danger border-danger text-bg font-medium">
                Confirmer
              </button>
              <button @click="deleteConfirmId = null" class="btn text-xs py-1 px-2.5">Annuler</button>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Modal formulaire -->
    <InbodyForm
      v-model="showForm"
      :edit-scan="editScan"
      :latest-scan="latestScan"
      @save="handleSave"
    />
  </div>
</template>
