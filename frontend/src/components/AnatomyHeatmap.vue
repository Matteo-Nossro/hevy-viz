<script setup>
import { computed } from 'vue'

const props = defineProps({
  // map { groupName: nbSeries }
  data: { type: Object, default: () => ({}) },
})

// Échelle : couleur en fonction du nombre de séries
const maxValue = computed(() => {
  return Math.max(1, ...Object.values(props.data))
})

// Génère la couleur d'un muscle en fonction du nb de séries
// Dégradé : surface (gris clair) → accent (teal) → secondary (violet) pour les hautes valeurs
function muscleColor(group) {
  const v = props.data[group] || 0
  if (v === 0) return '#2a3441'
  const ratio = v / maxValue.value
  // De #5eb8c4 (teal) à #b794f6 (violet)
  if (ratio < 0.5) {
    // gris -> teal
    const t = ratio / 0.5
    return interpolate('#3a4654', '#5eb8c4', t)
  } else {
    // teal -> violet
    const t = (ratio - 0.5) / 0.5
    return interpolate('#5eb8c4', '#b794f6', t)
  }
}

function interpolate(c1, c2, t) {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16)
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16)
  const r = Math.round(r1 + (r2 - r1) * t)
  const g = Math.round(g1 + (g2 - g1) * t)
  const b = Math.round(b1 + (b2 - b1) * t)
  return `rgb(${r},${g},${b})`
}

function tooltipText(group) {
  const v = props.data[group] || 0
  return `${group} — ${v} série${v > 1 ? 's' : ''}`
}
</script>

<template>
  <div class="flex justify-center gap-6 lg:gap-12 py-4">
    <!-- VUE AVANT -->
    <div class="flex flex-col items-center">
      <div class="text-xs text-text-muted mb-2 font-medium">Avant</div>
      <svg viewBox="0 0 200 460" class="w-32 sm:w-40" xmlns="http://www.w3.org/2000/svg">
        <!-- Tête -->
        <ellipse cx="100" cy="35" rx="22" ry="26" fill="#3a4654" stroke="#475260" stroke-width="0.5"/>
        <!-- Cou -->
        <rect x="92" y="58" width="16" height="14" fill="#3a4654" stroke="#475260" stroke-width="0.5"/>

        <!-- Épaules (Épaules - antérieur) -->
        <path class="anatomy-muscle"
          d="M 60 78 Q 55 72 62 70 Q 78 68 82 78 Q 84 88 78 92 Q 68 92 60 78 Z"
          :fill="muscleColor('Épaules')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Épaules') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 140 78 Q 145 72 138 70 Q 122 68 118 78 Q 116 88 122 92 Q 132 92 140 78 Z"
          :fill="muscleColor('Épaules')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Épaules') }}</title>
        </path>

        <!-- Pectoraux -->
        <path class="anatomy-muscle"
          d="M 82 78 Q 95 76 99 80 L 99 122 Q 92 130 80 124 Q 72 110 75 92 Q 78 82 82 78 Z"
          :fill="muscleColor('Pectoraux')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Pectoraux') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 118 78 Q 105 76 101 80 L 101 122 Q 108 130 120 124 Q 128 110 125 92 Q 122 82 118 78 Z"
          :fill="muscleColor('Pectoraux')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Pectoraux') }}</title>
        </path>

        <!-- Biceps gauche -->
        <path class="anatomy-muscle"
          d="M 56 92 Q 50 95 50 110 Q 51 130 56 145 Q 62 148 65 142 Q 65 120 64 100 Q 60 92 56 92 Z"
          :fill="muscleColor('Biceps')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Biceps') }}</title>
        </path>
        <!-- Biceps droit -->
        <path class="anatomy-muscle"
          d="M 144 92 Q 150 95 150 110 Q 149 130 144 145 Q 138 148 135 142 Q 135 120 136 100 Q 140 92 144 92 Z"
          :fill="muscleColor('Biceps')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Biceps') }}</title>
        </path>

        <!-- Avant-bras gauche -->
        <path class="anatomy-muscle"
          d="M 53 148 Q 48 152 47 170 Q 47 195 52 215 Q 60 218 64 213 Q 65 188 64 165 Q 62 150 56 148 Z"
          :fill="muscleColor('Avant-bras')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Avant-bras') }}</title>
        </path>
        <!-- Avant-bras droit -->
        <path class="anatomy-muscle"
          d="M 147 148 Q 152 152 153 170 Q 153 195 148 215 Q 140 218 136 213 Q 135 188 136 165 Q 138 150 144 148 Z"
          :fill="muscleColor('Avant-bras')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Avant-bras') }}</title>
        </path>

        <!-- Abdominaux -->
        <path class="anatomy-muscle"
          d="M 82 124 Q 100 128 118 124 L 118 175 Q 100 180 82 175 Z"
          :fill="muscleColor('Abdominaux')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Abdominaux') }}</title>
        </path>
        <!-- Lignes abdominaux pour le détail -->
        <line x1="100" y1="128" x2="100" y2="175" stroke="#475260" stroke-width="0.5" pointer-events="none"/>
        <line x1="84" y1="142" x2="116" y2="142" stroke="#475260" stroke-width="0.4" pointer-events="none"/>
        <line x1="84" y1="158" x2="116" y2="158" stroke="#475260" stroke-width="0.4" pointer-events="none"/>

        <!-- Quadriceps gauche -->
        <path class="anatomy-muscle"
          d="M 80 180 Q 76 195 76 230 Q 78 268 84 295 Q 92 298 95 290 Q 96 250 95 215 Q 93 185 88 180 Z"
          :fill="muscleColor('Quadriceps')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Quadriceps') }}</title>
        </path>
        <!-- Quadriceps droit -->
        <path class="anatomy-muscle"
          d="M 120 180 Q 124 195 124 230 Q 122 268 116 295 Q 108 298 105 290 Q 104 250 105 215 Q 107 185 112 180 Z"
          :fill="muscleColor('Quadriceps')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Quadriceps') }}</title>
        </path>

        <!-- Adducteurs (intérieur de cuisse) -->
        <path class="anatomy-muscle"
          d="M 95 180 Q 96 200 97 240 Q 98 260 99 280 L 101 280 Q 102 260 103 240 Q 104 200 105 180 Z"
          :fill="muscleColor('Adducteurs')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Adducteurs') }}</title>
        </path>

        <!-- Genou (séparateur) -->
        <ellipse cx="89" cy="305" rx="6" ry="4" fill="#3a4654" pointer-events="none"/>
        <ellipse cx="111" cy="305" rx="6" ry="4" fill="#3a4654" pointer-events="none"/>

        <!-- Mollets (vue avant : tibial antérieur visible) -->
        <path class="anatomy-muscle"
          d="M 82 312 Q 79 330 80 365 Q 84 395 90 415 Q 96 415 96 405 Q 96 365 94 332 Q 90 312 86 312 Z"
          :fill="muscleColor('Mollets')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Mollets') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 118 312 Q 121 330 120 365 Q 116 395 110 415 Q 104 415 104 405 Q 104 365 106 332 Q 110 312 114 312 Z"
          :fill="muscleColor('Mollets')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Mollets') }}</title>
        </path>

        <!-- Pieds -->
        <ellipse cx="88" cy="430" rx="9" ry="6" fill="#3a4654" pointer-events="none"/>
        <ellipse cx="112" cy="430" rx="9" ry="6" fill="#3a4654" pointer-events="none"/>
      </svg>
    </div>

    <!-- VUE ARRIÈRE -->
    <div class="flex flex-col items-center">
      <div class="text-xs text-text-muted mb-2 font-medium">Arrière</div>
      <svg viewBox="0 0 200 460" class="w-32 sm:w-40" xmlns="http://www.w3.org/2000/svg">
        <!-- Tête -->
        <ellipse cx="100" cy="35" rx="22" ry="26" fill="#3a4654" stroke="#475260" stroke-width="0.5"/>
        <!-- Cou -->
        <rect x="92" y="58" width="16" height="14" fill="#3a4654" stroke="#475260" stroke-width="0.5"/>

        <!-- Trapèze (haut du dos, partagé avec Dos) -->
        <path class="anatomy-muscle"
          d="M 78 72 Q 92 70 100 75 Q 108 70 122 72 L 130 92 Q 115 96 100 96 Q 85 96 70 92 Z"
          :fill="muscleColor('Dos')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Dos') }}</title>
        </path>

        <!-- Épaules arrière (deltoïdes postérieurs) -->
        <path class="anatomy-muscle"
          d="M 60 78 Q 55 75 60 72 Q 70 70 78 78 Q 80 90 75 95 Q 65 92 60 78 Z"
          :fill="muscleColor('Épaules')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Épaules') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 140 78 Q 145 75 140 72 Q 130 70 122 78 Q 120 90 125 95 Q 135 92 140 78 Z"
          :fill="muscleColor('Épaules')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Épaules') }}</title>
        </path>

        <!-- Grand dorsal (Dos) -->
        <path class="anatomy-muscle"
          d="M 70 92 Q 65 105 68 130 Q 75 160 90 170 L 100 170 L 100 96 Q 85 96 70 92 Z"
          :fill="muscleColor('Dos')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Dos') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 130 92 Q 135 105 132 130 Q 125 160 110 170 L 100 170 L 100 96 Q 115 96 130 92 Z"
          :fill="muscleColor('Dos')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Dos') }}</title>
        </path>

        <!-- Triceps gauche -->
        <path class="anatomy-muscle"
          d="M 56 92 Q 50 95 50 110 Q 51 130 56 145 Q 62 148 65 142 Q 65 120 64 100 Q 60 92 56 92 Z"
          :fill="muscleColor('Triceps')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Triceps') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 144 92 Q 150 95 150 110 Q 149 130 144 145 Q 138 148 135 142 Q 135 120 136 100 Q 140 92 144 92 Z"
          :fill="muscleColor('Triceps')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Triceps') }}</title>
        </path>

        <!-- Avant-bras (vue arrière) -->
        <path class="anatomy-muscle"
          d="M 53 148 Q 48 152 47 170 Q 47 195 52 215 Q 60 218 64 213 Q 65 188 64 165 Q 62 150 56 148 Z"
          :fill="muscleColor('Avant-bras')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Avant-bras') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 147 148 Q 152 152 153 170 Q 153 195 148 215 Q 140 218 136 213 Q 135 188 136 165 Q 138 150 144 148 Z"
          :fill="muscleColor('Avant-bras')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Avant-bras') }}</title>
        </path>

        <!-- Lombaires (zone basse du dos, on l'inclut dans Abdominaux faute de mieux) -->
        <path class="anatomy-muscle"
          d="M 82 168 Q 100 172 118 168 L 118 200 Q 100 204 82 200 Z"
          :fill="muscleColor('Abdominaux')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Abdominaux') }}</title>
        </path>

        <!-- Fessiers -->
        <path class="anatomy-muscle"
          d="M 75 200 Q 70 215 75 235 Q 88 245 99 240 L 99 200 Q 85 198 75 200 Z"
          :fill="muscleColor('Fessiers')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Fessiers') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 125 200 Q 130 215 125 235 Q 112 245 101 240 L 101 200 Q 115 198 125 200 Z"
          :fill="muscleColor('Fessiers')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Fessiers') }}</title>
        </path>

        <!-- Ischio-jambiers (arrière de cuisse) -->
        <path class="anatomy-muscle"
          d="M 78 245 Q 75 265 76 290 Q 80 298 92 296 Q 96 270 96 248 Q 88 244 78 245 Z"
          :fill="muscleColor('Ischio-jambiers')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Ischio-jambiers') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 122 245 Q 125 265 124 290 Q 120 298 108 296 Q 104 270 104 248 Q 112 244 122 245 Z"
          :fill="muscleColor('Ischio-jambiers')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Ischio-jambiers') }}</title>
        </path>

        <!-- Abducteurs (extérieur de cuisse) - bandes sur les côtés -->
        <path class="anatomy-muscle"
          d="M 76 215 Q 73 235 73 270 L 78 272 Q 78 235 78 215 Z"
          :fill="muscleColor('Abducteurs')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Abducteurs') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 124 215 Q 127 235 127 270 L 122 272 Q 122 235 122 215 Z"
          :fill="muscleColor('Abducteurs')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Abducteurs') }}</title>
        </path>

        <!-- Mollets (vue arrière : gastrocnémien, plus visible) -->
        <path class="anatomy-muscle"
          d="M 80 312 Q 76 332 78 360 Q 82 388 88 408 Q 95 410 96 402 Q 96 365 93 335 Q 88 314 84 312 Z"
          :fill="muscleColor('Mollets')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Mollets') }}</title>
        </path>
        <path class="anatomy-muscle"
          d="M 120 312 Q 124 332 122 360 Q 118 388 112 408 Q 105 410 104 402 Q 104 365 107 335 Q 112 314 116 312 Z"
          :fill="muscleColor('Mollets')" stroke="#475260" stroke-width="0.5">
          <title>{{ tooltipText('Mollets') }}</title>
        </path>

        <!-- Pieds -->
        <ellipse cx="88" cy="430" rx="9" ry="6" fill="#3a4654" pointer-events="none"/>
        <ellipse cx="112" cy="430" rx="9" ry="6" fill="#3a4654" pointer-events="none"/>
      </svg>
    </div>
  </div>

  <!-- Légende -->
  <div class="flex items-center justify-center gap-3 text-xs text-text-muted mt-2">
    <span>Aucun</span>
    <div class="flex h-2 w-32 rounded-full overflow-hidden">
      <div class="flex-1" style="background:#3a4654"></div>
      <div class="flex-1" style="background:#5eb8c4"></div>
      <div class="flex-1" style="background:#b794f6"></div>
    </div>
    <span>Maximum</span>
  </div>
</template>
