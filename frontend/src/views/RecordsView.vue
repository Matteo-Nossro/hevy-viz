<script setup>
import { ref, computed } from 'vue'
import { formatDateShort } from '../utils/dateUtils'
import { MUSCLE_GROUPS } from '../config/muscleMapping'

const props = defineProps(['workout'])

const muscleFilter = ref('all')
const sortBy = ref('1rm')

const records = computed(() => {
  let list = [...props.workout.personalRecords.value]
  if (muscleFilter.value !== 'all') {
    list = list.filter(r => r.muscleGroups.includes(muscleFilter.value))
  }
  if (sortBy.value === '1rm') list.sort((a, b) => b.best1RM - a.best1RM)
  else if (sortBy.value === 'maxWeight') list.sort((a, b) => b.maxWeight - a.maxWeight)
  else if (sortBy.value === 'volume') list.sort((a, b) => b.maxVolume - a.maxVolume)
  else if (sortBy.value === 'sets') list.sort((a, b) => b.totalSets - a.totalSets)
  return list
})

const muscleOptions = computed(() => {
  const used = new Set()
  for (const r of props.workout.personalRecords.value) {
    for (const mg of r.muscleGroups) used.add(mg)
  }
  return MUSCLE_GROUPS.filter(g => used.has(g))
})

const badges = computed(() => props.workout.badges.value)
const unlockedCount = computed(() => badges.value.filter(b => b.unlocked).length)
const totalBadges = computed(() => badges.value.length)
</script>

<template>
  <div class="space-y-6 fade-in">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-semibold tracking-tight">Records & succès</h2>
    </div>

    <!-- Badges -->
    <section>
      <div class="flex items-center justify-between mb-3">
        <h3 class="text-sm font-medium">Succès débloqués</h3>
        <span class="text-xs text-text-muted">
          {{ unlockedCount }} / {{ totalBadges }}
        </span>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <div v-for="b in badges" :key="b.id"
          :class="[
            'soft-card p-3 transition-all',
            b.unlocked ? 'border-accent/40' : 'opacity-50'
          ]">
          <div class="flex items-start gap-2.5">
            <div :class="[
              'w-9 h-9 rounded-lg flex items-center justify-center text-xl flex-shrink-0',
              b.unlocked ? 'bg-accent/10' : 'bg-bg-elevated'
            ]">
              {{ b.icon }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate">{{ b.name }}</p>
              <p class="text-[11px] text-text-muted leading-tight">{{ b.desc }}</p>
              <p v-if="b.unlocked && b.date" class="text-[10px] text-text-faint mt-1">
                {{ formatDateShort(b.date) }}
              </p>
              <div v-else-if="!b.unlocked" class="mt-1.5">
                <div class="h-1 bg-bg-elevated rounded-full overflow-hidden">
                  <div class="h-full bg-accent/60 rounded-full" :style="{ width: Math.min(100, b.progress * 100) + '%' }"></div>
                </div>
                <p class="text-[10px] text-text-faint mt-0.5 font-mono">{{ b.progressLabel }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Records par exercice -->
    <section>
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-3">
        <h3 class="text-sm font-medium">Records par exercice</h3>
        <div class="flex gap-2">
          <select v-model="muscleFilter">
            <option value="all">Tous les groupes</option>
            <option v-for="g in muscleOptions" :key="g" :value="g">{{ g }}</option>
          </select>
          <select v-model="sortBy">
            <option value="1rm">Tri : 1RM</option>
            <option value="maxWeight">Tri : Poids max</option>
            <option value="volume">Tri : Volume</option>
            <option value="sets">Tri : Séries</option>
          </select>
        </div>
      </div>

      <div v-if="records.length" class="soft-card overflow-hidden">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-text-faint text-[10px] uppercase tracking-wider border-b border-border">
              <th class="text-left py-2.5 px-4 font-medium">Exercice</th>
              <th class="text-right py-2.5 px-3 font-medium">1RM estimé</th>
              <th class="text-right py-2.5 px-3 font-medium hidden sm:table-cell">Poids max</th>
              <th class="text-right py-2.5 px-3 font-medium hidden md:table-cell">Volume max</th>
              <th class="text-right py-2.5 px-4 font-medium hidden lg:table-cell">Séries</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records" :key="r.exercise" class="border-b border-border last:border-0 hover:bg-surface-hover transition-colors">
              <td class="py-3 px-4">
                <div class="text-sm text-text">{{ r.exercise }}</div>
                <div class="flex gap-1 mt-0.5 flex-wrap">
                  <span v-for="mg in r.muscleGroups" :key="mg" class="badge text-[9px]">{{ mg }}</span>
                </div>
              </td>
              <td class="py-3 px-3 text-right">
                <div class="font-mono font-semibold text-accent-strong">
                  {{ Math.round(r.best1RM * 10) / 10 }} kg
                </div>
                <div v-if="r.best1RMSet" class="text-[10px] text-text-faint font-mono">
                  {{ r.best1RMSet.weightKg }}kg × {{ r.best1RMSet.reps }}
                </div>
                <div v-if="r.best1RMDate" class="text-[10px] text-text-faint">
                  {{ formatDateShort(r.best1RMDate) }}
                </div>
              </td>
              <td class="py-3 px-3 text-right hidden sm:table-cell">
                <div class="font-mono font-semibold text-secondary">{{ r.maxWeight }} kg</div>
                <div class="text-[10px] text-text-faint font-mono">× {{ r.maxWeightReps }} reps</div>
                <div v-if="r.maxWeightDate" class="text-[10px] text-text-faint">{{ formatDateShort(r.maxWeightDate) }}</div>
              </td>
              <td class="py-3 px-3 text-right hidden md:table-cell">
                <div class="font-mono">{{ Math.round(r.maxVolume).toLocaleString('fr-FR') }}</div>
                <div v-if="r.maxVolumeDate" class="text-[10px] text-text-faint">{{ formatDateShort(r.maxVolumeDate) }}</div>
              </td>
              <td class="py-3 px-4 text-right hidden lg:table-cell font-mono text-text-muted">
                {{ r.totalSets }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-12 text-text-muted">
        Aucun record pour ce filtre.
      </div>
    </section>
  </div>
</template>
