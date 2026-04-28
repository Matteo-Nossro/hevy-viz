<script setup>
import { ref, computed, onMounted } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  useCompareData,
  USER_COLORS,
  filterSessionsByPeriod,
  computeCurrentStreak,
  computeRecordsCount,
  computeTopExercises,
} from '../composables/useCompareData'
import { getDayKey } from '../utils/dateUtils'
import CompareUserSelector from '../components/compare/CompareUserSelector.vue'
import CompareActivityHeatmap from '../components/compare/CompareActivityHeatmap.vue'
import CompareExerciseSection from '../components/compare/CompareExerciseSection.vue'
import CompareInbodySection from '../components/compare/CompareInbodySection.vue'

const props = defineProps({
  workout: { type: Object, required: true },
  currentUser: { type: Object, required: true },
})

const { allUsers, usersDataMap, loadAllUsers, loadUserData } = useCompareData()

const selectedUsers = ref([])
const period = ref('3m')

const PERIODS = [
  { value: '1w',  label: '1 sem'  },
  { value: '1m',  label: '1 mois' },
  { value: '3m',  label: '3 mois' },
  { value: '6m',  label: '6 mois' },
  { value: '1y',  label: '1 an'   },
  { value: 'all', label: 'Tout'   },
]

// ── Init ─────────────────────────────────────────────────────────────────────
onMounted(async () => {
  await loadAllUsers()
  const me = props.currentUser.username
  selectedUsers.value = [me]
  await loadUserData(me)
})

// ── User selection ────────────────────────────────────────────────────────────
function toggleUser(username) {
  if (username === props.currentUser.username) return
  const idx = selectedUsers.value.indexOf(username)
  if (idx >= 0) {
    selectedUsers.value = selectedUsers.value.filter(u => u !== username)
  } else if (selectedUsers.value.length < 4) {
    selectedUsers.value = [...selectedUsers.value, username]
    loadUserData(username)
  }
}

// Stable color per user (indexed into USER_COLORS)
const userColorMap = computed(() => {
  const map = {}
  allUsers.value.forEach((u, i) => {
    map[u.username] = USER_COLORS[i % USER_COLORS.length]
  })
  return map
})

function colorOf(username) {
  return userColorMap.value[username] ?? USER_COLORS[0]
}

// ── Period bounds ─────────────────────────────────────────────────────────────
const refDate = computed(() => props.workout.lastDataDate.value)

const periodBounds = computed(() => {
  const end = new Date(refDate.value)
  end.setHours(23, 59, 59, 999)
  let start
  if (period.value === '1w') {
    start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000)
  } else if (period.value === '1m') {
    start = new Date(end.getFullYear(), end.getMonth() - 1, end.getDate())
  } else if (period.value === '3m') {
    start = new Date(end.getFullYear(), end.getMonth() - 3, end.getDate())
  } else if (period.value === '6m') {
    start = new Date(end.getFullYear(), end.getMonth() - 6, end.getDate())
  } else if (period.value === '1y') {
    start = new Date(end.getFullYear() - 1, end.getMonth(), end.getDate())
  } else {
    let min = end
    for (const u of selectedUsers.value) {
      const s = usersDataMap.value[u]?.sessions
      if (s?.length && s[0].date < min) min = s[0].date
    }
    start = new Date(min)
  }
  start.setHours(0, 0, 0, 0)
  return { start, end }
})

// ── Per-user helpers ──────────────────────────────────────────────────────────
function getUserData(username) {
  return usersDataMap.value[username] ?? { sessions: [], scans: [], loading: false, loaded: false }
}

function getFilteredSessions(username) {
  const data = getUserData(username)
  if (!data.loaded) return []
  return filterSessionsByPeriod(data.sessions, period.value, refDate.value)
}

const selectedUsersData = computed(() =>
  selectedUsers.value.map(username => ({
    username,
    color: colorOf(username),
    ...getUserData(username),
    filtered: getFilteredSessions(username),
  }))
)

const anyLoading = computed(() => selectedUsersData.value.some(u => u.loading))

const loadedUsers = computed(() => selectedUsersData.value.filter(u => u.loaded))

// At least 2 users loaded → show comparison sections
const atLeastTwoLoaded = computed(() => loadedUsers.value.length >= 2)

// ── Shared chart style ────────────────────────────────────────────────────────
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

const barBaseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { ...tooltipStyle } },
  scales: {
    x: { grid: { display: false }, ticks: { color: '#6e7681', font: { size: 11 } } },
    y: {
      grid: { color: '#252e38' },
      ticks: { maxTicksLimit: 5, color: '#6e7681', font: { size: 10 } },
      border: { display: false },
      beginAtZero: true,
    },
  },
}

const regulariteOptions = {
  ...barBaseOptions,
  plugins: {
    ...barBaseOptions.plugins,
    tooltip: {
      ...tooltipStyle,
      callbacks: {
        label: ctx => `${ctx.raw} séance${ctx.raw !== 1 ? 's' : ''}`,
      },
    },
  },
}

// ── Régularité ────────────────────────────────────────────────────────────────
const regulariteChart = computed(() => ({
  labels: loadedUsers.value.map(u => u.username),
  datasets: [{
    data: loadedUsers.value.map(u => u.filtered.length),
    backgroundColor: loadedUsers.value.map(u => u.color + 'aa'),
    borderColor: loadedUsers.value.map(u => u.color),
    borderWidth: 1,
    borderRadius: 4,
  }],
}))

// Per-user: sessions/week and avg days between sessions
function regularityStats(sessions, { start, end }) {
  if (!sessions.length) return null
  const weeks = (end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)
  const perWeek = (sessions.length / Math.max(1, weeks)).toFixed(1)
  let avgGap = null
  if (sessions.length >= 2) {
    const sorted = [...sessions].sort((a, b) => a.date - b.date)
    let total = 0
    for (let i = 1; i < sorted.length; i++) {
      total += (sorted[i].date.getTime() - sorted[i-1].date.getTime()) / (24 * 60 * 60 * 1000)
    }
    avgGap = (total / (sorted.length - 1)).toFixed(1)
  }
  return { perWeek, avgGap }
}

const regulariteStats = computed(() =>
  loadedUsers.value.map(u => ({
    username: u.username,
    color: u.color,
    count: u.filtered.length,
    stats: regularityStats(u.filtered, periodBounds.value),
  }))
)

const bestRegularity = computed(() => {
  let best = 0
  let bestUser = null
  for (const u of regulariteStats.value) {
    if (u.count > best) { best = u.count; bestUser = u.username }
  }
  return bestUser
})

// ── Volume ────────────────────────────────────────────────────────────────────
const volumeChart = computed(() => ({
  labels: loadedUsers.value.map(u => u.username),
  datasets: [{
    data: loadedUsers.value.map(u => Math.round(u.filtered.reduce((a, s) => a + s.totalVolume, 0))),
    backgroundColor: loadedUsers.value.map(u => u.color + 'aa'),
    borderColor: loadedUsers.value.map(u => u.color),
    borderWidth: 1,
    borderRadius: 4,
  }],
}))

const volumeOptions = {
  ...barBaseOptions,
  plugins: {
    ...barBaseOptions.plugins,
    tooltip: {
      ...tooltipStyle,
      callbacks: { label: ctx => `${Math.round(ctx.raw).toLocaleString('fr-FR')} kg` },
    },
  },
}

const volumeSummary = computed(() =>
  loadedUsers.value.map(u => ({
    username: u.username,
    color: u.color,
    total: Math.round(u.filtered.reduce((a, s) => a + s.totalVolume, 0)),
  }))
)

// ── Streak ────────────────────────────────────────────────────────────────────
const streakData = computed(() =>
  selectedUsersData.value
    .filter(u => u.loaded)
    .map(u => ({ username: u.username, color: u.color, streak: computeCurrentStreak(u.sessions) }))
    .sort((a, b) => b.streak - a.streak)
)
const maxStreak = computed(() => Math.max(0, ...streakData.value.map(u => u.streak)))

// ── Records ───────────────────────────────────────────────────────────────────
const recordsData = computed(() => {
  const { start, end } = periodBounds.value
  return selectedUsersData.value
    .filter(u => u.loaded)
    .map(u => ({
      username: u.username,
      color: u.color,
      count: computeRecordsCount(u.sessions, start, end),
    }))
    .sort((a, b) => b.count - a.count)
})
const maxRecords = computed(() => Math.max(0, ...recordsData.value.map(u => u.count)))

// ── Top exercises (existing section, kept) ────────────────────────────────────
const topExData = computed(() =>
  loadedUsers.value.map(u => ({
    username: u.username,
    color: u.color,
    exercises: computeTopExercises(u.filtered, 5),
  }))
)
</script>

<template>
<div class="space-y-5 fade-in">

  <!-- Title -->
  <h2 class="text-lg font-semibold tracking-tight">Comparaison</h2>

  <!-- User selector -->
  <CompareUserSelector
    :all-users="allUsers"
    :selected-users="selectedUsers"
    :current-user-username="currentUser.username"
    :user-color-map="userColorMap"
    @toggle="toggleUser"
  />

  <!-- Period selector -->
  <div class="flex flex-wrap gap-1.5">
    <button
      v-for="p in PERIODS"
      :key="p.value"
      @click="period = p.value"
      class="px-3 py-1 rounded-full text-xs font-medium transition-colors border"
      :class="period === p.value
        ? 'bg-accent text-bg border-accent'
        : 'text-text-muted border-border hover:border-border-strong hover:text-text'"
    >{{ p.label }}</button>
  </div>

  <!-- Loading -->
  <div v-if="anyLoading" class="flex items-center gap-2 text-sm text-text-muted">
    <div class="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
    Chargement des données…
  </div>

  <!-- Solo user: invite to add others -->
  <div
    v-else-if="selectedUsers.length === 1 && loadedUsers.length === 1"
    class="soft-card p-8 text-center space-y-2"
  >
    <p class="text-sm text-text-muted">Sélectionne au moins un autre utilisateur pour comparer.</p>
    <p class="text-xs text-text-muted">Les sections de comparaison apparaîtront ici.</p>
  </div>

  <!-- Comparison sections (keyed transition on period + users) -->
  <template v-else-if="atLeastTwoLoaded">
  <Transition name="sections" mode="out-in">
  <div :key="`${period}-${selectedUsers.join(',')}`" class="space-y-5">

    <!-- ─── Régularité ───────────────────────────────────────────────────── -->
    <div class="soft-card p-4 space-y-3">
      <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
        Régularité — séances sur la période
      </p>
      <!-- Legend -->
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span
          v-for="u in regulariteStats"
          :key="u.username"
          class="inline-flex items-center gap-1.5 text-xs"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: u.color }"></span>
          <span :style="u.username === bestRegularity ? { color: u.color, fontWeight: 600 } : {}">
            {{ u.username }} : {{ u.count }} séance{{ u.count !== 1 ? 's' : '' }}
            <template v-if="u.stats">
              · {{ u.stats.perWeek }}/sem
              <template v-if="u.stats.avgGap"> · ~{{ u.stats.avgGap }}j entre séances</template>
            </template>
          </span>
        </span>
      </div>
      <div class="h-48">
        <Bar :data="regulariteChart" :options="regulariteOptions" />
      </div>
    </div>

    <!-- ─── Volume total ─────────────────────────────────────────────────── -->
    <div class="soft-card p-4 space-y-3">
      <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
        Volume total soulevé
      </p>
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span
          v-for="u in volumeSummary"
          :key="u.username"
          class="inline-flex items-center gap-1.5 text-xs"
        >
          <span class="w-2 h-2 rounded-full flex-shrink-0" :style="{ backgroundColor: u.color }"></span>
          <span :style="{ color: u.color }">{{ u.username }}</span>
          <span class="text-text-muted">{{ u.total.toLocaleString('fr-FR') }} kg</span>
        </span>
      </div>
      <div class="h-48">
        <Bar :data="volumeChart" :options="volumeOptions" />
      </div>
    </div>

    <!-- ─── Streak ───────────────────────────────────────────────────────── -->
    <div class="soft-card p-4 space-y-2">
      <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
        Streak actuel — semaines consécutives
      </p>
      <div class="space-y-1.5">
        <div
          v-for="u in streakData"
          :key="u.username"
          class="flex items-center gap-3 text-sm"
        >
          <span class="text-base leading-none">{{ u.streak === maxStreak && maxStreak > 0 ? '🔥' : '  ' }}</span>
          <span class="font-semibold text-base w-6 text-right flex-shrink-0" :style="{ color: u.color }">
            {{ u.streak }}
          </span>
          <span class="text-xs text-text-muted">sem.</span>
          <span class="text-xs font-medium" :style="u.streak === maxStreak && maxStreak > 0 ? { color: u.color } : {}">
            {{ u.username }}
          </span>
        </div>
      </div>
    </div>

    <!-- ─── Records battus ───────────────────────────────────────────────── -->
    <div class="soft-card p-4 space-y-2">
      <p class="text-xs font-medium text-text-muted uppercase tracking-wider mb-3">
        Records battus sur la période
      </p>
      <div class="space-y-1.5">
        <div
          v-for="(u, i) in recordsData"
          :key="u.username"
          class="flex items-center gap-3 text-sm"
        >
          <span class="text-base leading-none">{{ i === 0 && u.count > 0 ? '🏅' : '  ' }}</span>
          <span
            class="font-semibold text-base w-6 text-right flex-shrink-0"
            :style="{ color: u.color }"
          >{{ u.count }}</span>
          <span class="text-xs text-text-muted">PR</span>
          <span
            class="text-xs font-medium"
            :style="i === 0 && u.count > 0 ? { color: u.color } : {}"
          >{{ u.username }}</span>
        </div>
        <p v-if="recordsData.every(u => u.count === 0)" class="text-xs text-text-muted">
          Aucun record battu sur cette période.
        </p>
      </div>
    </div>

    <!-- ─── Heatmap ──────────────────────────────────────────────────────── -->
    <CompareActivityHeatmap
      :users-data="selectedUsersData"
      :end-date="periodBounds.end"
    />

    <!-- ─── Top exercices par user ───────────────────────────────────────── -->
    <div class="soft-card p-4 space-y-4">
      <p class="text-xs font-medium text-text-muted uppercase tracking-wider">
        Top exercices — séries sur la période
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div v-for="u in topExData" :key="u.username">
          <div class="flex items-center gap-1.5 mb-2">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: u.color }"></span>
            <span class="text-xs font-medium" :style="{ color: u.color }">{{ u.username }}</span>
          </div>
          <ol v-if="u.exercises.length" class="space-y-1.5">
            <li
              v-for="(ex, i) in u.exercises"
              :key="ex.name"
              class="flex items-baseline gap-2 text-xs"
            >
              <span class="text-text-muted w-4 text-right flex-shrink-0">{{ i + 1 }}.</span>
              <span class="text-text flex-1 min-w-0 truncate" :title="ex.name">{{ ex.name }}</span>
              <span class="text-text-muted flex-shrink-0">{{ ex.count }} séries</span>
            </li>
          </ol>
          <p v-else class="text-xs text-text-muted">Aucune séance sur la période.</p>
        </div>
      </div>
    </div>

    <!-- ─── Comparaison par exercice ─────────────────────────────────────── -->
    <CompareExerciseSection
      :users-data="selectedUsersData"
      :start-date="periodBounds.start"
      :end-date="periodBounds.end"
    />

    <!-- ─── Comparaison InBody ───────────────────────────────────────────── -->
    <CompareInbodySection
      :users-data="selectedUsersData"
      :start-date="periodBounds.start"
      :end-date="periodBounds.end"
    />

  </div>
  </Transition>
  </template>

  <!-- Loading without at least 2 users yet -->
  <div
    v-else-if="!anyLoading && loadedUsers.length < 2 && selectedUsers.length > 1"
    class="text-center py-12 text-sm text-text-muted"
  >
    Chargement des données en cours…
  </div>

</div>
</template>

<style scoped>
.sections-enter-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.sections-leave-active {
  transition: opacity 0.15s ease;
}
.sections-enter-from {
  opacity: 0;
  transform: translateY(5px);
}
.sections-leave-to {
  opacity: 0;
}
</style>
