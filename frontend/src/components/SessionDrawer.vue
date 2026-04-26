<script setup>
import { computed } from 'vue'
import { formatTime, formatDuration, formatDateFull } from '../utils/dateUtils'

const props = defineProps({
  session: { type: Object, default: null },
  recordsBroken: { type: Object, default: () => ({}) },
})
const emit = defineEmits(['close'])

const muscleVolumes = computed(() => {
  if (!props.session) return []
  const map = {}
  for (const ex of props.session.exercises) {
    const share = ex.volume / Math.max(1, ex.muscleGroups.length)
    for (const mg of ex.muscleGroups) {
      map[mg] = (map[mg] || 0) + share
    }
  }
  const total = Object.values(map).reduce((a, v) => a + v, 0)
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .map(([group, vol]) => ({
      group,
      volume: Math.round(vol),
      pct: total > 0 ? Math.round(vol / total * 100) : 0,
    }))
})

const totalSets = computed(() => {
  if (!props.session) return 0
  return props.session.exercises.reduce((a, e) => a + e.workingSets.length, 0)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="session" class="fixed inset-0 z-50 flex justify-end" @click.self="emit('close')">
      <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="emit('close')"></div>
      <div class="relative w-full max-w-md bg-bg border-l border-border overflow-y-auto slide-in shadow-2xl">
        <!-- Header -->
        <div class="sticky top-0 bg-bg/95 backdrop-blur border-b border-border px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div class="min-w-0">
            <h3 class="font-semibold text-text truncate">{{ session.title }}</h3>
            <p class="text-xs text-text-muted mt-0.5">{{ formatDateFull(session.date) }}</p>
          </div>
          <button @click="emit('close')"
            class="text-text-muted hover:text-text text-xl leading-none p-1 -m-1 flex-shrink-0">✕</button>
        </div>

        <div class="p-5 space-y-5">
          <!-- Stats top -->
          <div class="grid grid-cols-3 gap-2">
            <div class="soft-card p-3">
              <div class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Durée</div>
              <div class="text-sm font-semibold">{{ formatDuration(session.duration) }}</div>
              <div class="text-[10px] text-text-faint mt-0.5">
                {{ formatTime(session.date) }} → {{ formatTime(session.endDate) }}
              </div>
            </div>
            <div class="soft-card p-3">
              <div class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Volume</div>
              <div class="text-sm font-semibold text-accent-strong font-mono">
                {{ Math.round(session.totalVolume).toLocaleString('fr-FR') }}<span class="text-text-faint text-xs"> kg</span>
              </div>
            </div>
            <div class="soft-card p-3">
              <div class="text-[10px] text-text-muted uppercase tracking-wide mb-1">Séries</div>
              <div class="text-sm font-semibold">{{ totalSets }}</div>
            </div>
          </div>

          <!-- Records battus -->
          <div v-if="Object.keys(recordsBroken).length"
            class="soft-card p-3 border border-warning/30 bg-warning/5">
            <div class="flex items-center gap-2 mb-2">
              <span class="text-base">🏆</span>
              <span class="text-xs font-semibold text-warning uppercase tracking-wide">
                {{ Object.keys(recordsBroken).length }} record{{ Object.keys(recordsBroken).length > 1 ? 's' : '' }} battu{{ Object.keys(recordsBroken).length > 1 ? 's' : '' }}
              </span>
            </div>
            <div class="space-y-1.5 text-xs">
              <div v-for="(reasons, exTitle) in recordsBroken" :key="exTitle" class="flex items-start gap-2">
                <span class="text-text-faint">›</span>
                <div class="flex-1">
                  <span class="text-text">{{ exTitle }}</span>
                  <span class="text-text-muted ml-1">— {{ reasons.join(', ') }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Split musculaire -->
          <div>
            <h4 class="text-xs uppercase tracking-wide text-text-muted mb-2">Split musculaire</h4>
            <div class="space-y-1.5">
              <div v-for="m in muscleVolumes" :key="m.group" class="flex items-center gap-2">
                <span class="text-xs w-28 flex-shrink-0">{{ m.group }}</span>
                <div class="flex-1 h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div class="h-full rounded-full"
                    :style="{ width: m.pct + '%', background: 'var(--accent)' }"></div>
                </div>
                <span class="text-xs text-text-muted font-mono w-10 text-right">{{ m.pct }}%</span>
              </div>
            </div>
          </div>

          <!-- Détail exercices -->
          <div>
            <h4 class="text-xs uppercase tracking-wide text-text-muted mb-2">
              Exercices ({{ session.exercises.length }})
            </h4>
            <div class="space-y-2.5">
              <div v-for="ex in session.exercises" :key="ex.title"
                class="soft-card p-3"
                :class="recordsBroken[ex.title] ? 'border-warning/40' : ''">
                <div class="flex items-start justify-between gap-2 mb-2">
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <h5 class="text-sm font-medium text-text">{{ ex.title }}</h5>
                      <span v-if="recordsBroken[ex.title]" class="text-xs">🏆</span>
                    </div>
                    <div class="flex items-center gap-1 mt-1 flex-wrap">
                      <span v-for="mg in ex.muscleGroups" :key="mg"
                        class="badge text-[9px]">{{ mg }}</span>
                    </div>
                  </div>
                  <div class="text-right flex-shrink-0">
                    <div class="text-xs font-mono text-accent-strong">
                      {{ Math.round(ex.volume).toLocaleString('fr-FR') }} kg
                    </div>
                    <div v-if="ex.best1RM > 0" class="text-[10px] text-text-faint font-mono">
                      1RM: {{ Math.round(ex.best1RM * 10) / 10 }}
                    </div>
                  </div>
                </div>
                <div class="space-y-0.5">
                  <div v-for="(set, si) in ex.sets" :key="si"
                    class="flex items-center gap-3 text-xs py-0.5">
                    <span :class="[
                      'w-14 text-[10px] uppercase tracking-wide',
                      set.setType === 'warmup' ? 'text-text-faint' :
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
