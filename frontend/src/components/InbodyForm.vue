<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { INBODY_FIELDS, INBODY_CATEGORIES, getFieldsByCategory } from '../config/inbodyFields'
import { formatDateFull } from '../utils/dateUtils'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  editScan: { type: Object, default: null },
  prefill: { type: Object, default: null },
  latestScan: { type: Object, default: null },
})
const emit = defineEmits(['update:modelValue', 'save'])

const fieldsByCategory = getFieldsByCategory()

// ── Form state ───────────────────────────────────────────────────────────────
const scanDate = ref('')
const notes = ref('')
const fieldValues = ref({})
const saving = ref(false)
const saveError = ref(null)

// Which categories are expanded (all open on desktop, first only on mobile init)
const expanded = ref(
  Object.keys(INBODY_CATEGORIES).reduce((acc, cat) => {
    acc[cat] = true
    return acc
  }, {})
)

function toLocalDatetimeStr(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function initForm(source) {
  scanDate.value = source?.scan_date
    ? toLocalDatetimeStr(source.scan_date instanceof Date ? source.scan_date : new Date(source.scan_date))
    : toLocalDatetimeStr(new Date())
  notes.value = source?.notes ?? ''
  const vals = {}
  for (const f of INBODY_FIELDS) {
    const v = source?.[f.key]
    vals[f.key] = v !== null && v !== undefined ? String(v) : ''
  }
  fieldValues.value = vals
}

onMounted(() => {
  if (props.editScan) {
    initForm(props.editScan)
  } else if (props.prefill) {
    initForm(props.prefill)
  } else {
    initForm(null)
  }
})

watch(() => props.modelValue, (open) => {
  if (!open) return
  if (props.editScan) {
    initForm(props.editScan)
  } else if (props.prefill) {
    initForm(props.prefill)
  } else {
    initForm(null)
  }
  saveError.value = null
})

function prefillFromLatest() {
  if (!props.latestScan) return
  for (const f of INBODY_FIELDS) {
    const v = props.latestScan[f.key]
    fieldValues.value[f.key] = v !== null && v !== undefined ? String(v) : ''
  }
}

function toggleCategory(cat) {
  expanded.value[cat] = !expanded.value[cat]
}

function buildPayload() {
  const payload = {}
  if (scanDate.value) {
    payload.scan_date = new Date(scanDate.value).toISOString()
  }
  if (notes.value.trim()) payload.notes = notes.value.trim()
  for (const f of INBODY_FIELDS) {
    const raw = fieldValues.value[f.key]
    if (raw === '' || raw === null || raw === undefined) {
      payload[f.key] = null
    } else {
      payload[f.key] = f.decimals === 0 ? parseInt(raw, 10) : parseFloat(raw)
    }
  }
  return payload
}

async function handleSave() {
  if (!scanDate.value) return
  saving.value = true
  saveError.value = null
  try {
    const payload = buildPayload()
    emit('save', { payload, id: props.editScan?.id ?? null })
  } catch (e) {
    saveError.value = e.message
  } finally {
    saving.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="fixed inset-0 z-50 flex justify-end" @click.self="close">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="close"></div>

      <div class="relative w-full max-w-lg bg-bg border-l border-border overflow-y-auto slide-in shadow-2xl flex flex-col">
        <!-- Header -->
        <div class="sticky top-0 bg-bg/95 backdrop-blur border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 class="font-semibold text-text">
              {{ editScan ? 'Modifier le scan' : 'Ajouter un scan InBody' }}
            </h3>
            <p v-if="editScan" class="text-xs text-text-muted mt-0.5">
              {{ formatDateFull(editScan.scan_date) }}
            </p>
          </div>
          <button @click="close" class="text-text-muted hover:text-text p-1 -m-1">
            <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="p-5 space-y-4 flex-1">
          <!-- Date obligatoire -->
          <div>
            <label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">
              Date du scan <span class="text-danger">*</span>
            </label>
            <input
              type="datetime-local"
              v-model="scanDate"
              required
              class="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors"
            />
          </div>

          <!-- Bouton pré-remplir -->
          <button
            v-if="latestScan && !editScan"
            type="button"
            @click="prefillFromLatest"
            class="w-full text-xs text-text-muted border border-dashed border-border hover:border-accent hover:text-accent rounded-md py-2 transition-colors"
          >
            Pré-remplir depuis le dernier scan ({{ formatDateFull(latestScan.scan_date) }})
          </button>

          <!-- Sections par catégorie -->
          <div
            v-for="(meta, cat) in fieldsByCategory"
            :key="cat"
            class="soft-card overflow-hidden"
          >
            <!-- Accordéon header -->
            <button
              type="button"
              @click="toggleCategory(cat)"
              class="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-hover transition-colors"
            >
              <span class="text-sm font-medium text-text">{{ meta.label }}</span>
              <svg
                viewBox="0 0 24 24" class="w-4 h-4 text-text-muted transition-transform"
                :class="{ 'rotate-180': expanded[cat] }"
                fill="none" stroke="currentColor" stroke-width="2"
              >
                <path d="M6 9l6 6 6-6" stroke-linecap="round"/>
              </svg>
            </button>

            <!-- Champs -->
            <div v-show="expanded[cat]" class="border-t border-border px-4 pb-4 pt-3 grid grid-cols-2 gap-x-3 gap-y-3">
              <div
                v-for="field in meta.fields"
                :key="field.key"
                :class="field.key === 'notes' ? 'col-span-2' : ''"
              >
                <label class="block text-[11px] text-text-muted mb-1">
                  {{ field.label }}
                  <span v-if="field.unit" class="text-text-faint">({{ field.unit }})</span>
                </label>
                <input
                  type="number"
                  v-model="fieldValues[field.key]"
                  :step="field.inputStep"
                  :min="0"
                  :placeholder="field.decimals > 0 ? (0).toFixed(field.decimals) : '0'"
                  class="w-full bg-bg border border-border rounded px-2.5 py-1.5 text-sm text-text placeholder-text-faint focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>
          </div>

          <!-- Notes -->
          <div>
            <label class="block text-xs font-medium text-text-muted uppercase tracking-wider mb-1.5">Notes</label>
            <textarea
              v-model="notes"
              rows="3"
              placeholder="Observations, conditions du test..."
              class="w-full bg-surface border border-border rounded-md px-3 py-2 text-sm text-text placeholder-text-faint focus:outline-none focus:border-accent transition-colors resize-none"
            ></textarea>
          </div>

          <p v-if="saveError" class="text-xs text-danger">{{ saveError }}</p>
        </div>

        <!-- Footer -->
        <div class="sticky bottom-0 bg-bg/95 backdrop-blur border-t border-border px-5 py-4 flex gap-3">
          <button @click="close" class="btn flex-1">Annuler</button>
          <button
            @click="handleSave"
            :disabled="!scanDate || saving"
            class="btn flex-1 bg-accent border-accent text-bg font-medium hover:bg-accent-strong disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ saving ? 'Enregistrement…' : 'Enregistrer' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
