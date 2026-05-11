/**
 * Maps French Hevy exercise names (and inconsistent casings) to canonical English names.
 * Keys are lowercase for case-insensitive lookup.
 * Add entries here when new French↔English mismatches are found.
 */
const LOOKUP = new Map([
  // ── DOS ───────────────────────────────────────────────────────────────────
  ["tirage poitrine (poulie)",                         "Lat Pulldown (Cable)"],
  ["tirage poitrine (machine)",                        "Lat Pulldown (Machine)"],
  ["tirage assis à la poulie - prise en v (poulie)",  "Seated Cable Row - V Grip (Cable)"],
  ["tirage machine convergente",                       "Iso-Lateral Row (Machine)"],
  ["extension dos (machine)",                          "Back Extension (Machine)"],

  // ── ÉPAULES ───────────────────────────────────────────────────────────────
  ["presse épaules assis (machine)",                   "Seated Shoulder Press (Machine)"],
  ["élévation latérale (haltère)",                     "Lateral Raise (Dumbbell)"],
  ["oiseau (machine)",                                 "Rear Delt Reverse Fly (Machine)"],
  ["tirage vers visage",                               "Face Pull"],

  // ── BICEPS ────────────────────────────────────────────────────────────────
  ["curl marteau (haltère)",                           "Hammer Curl (Dumbbell)"],
  ["curl biceps (barre ez)",                           "EZ Bar Biceps Curl"],
  ["curl inversé (câble)",                             "Reverse Curl (Cable)"],

  // ── TRICEPS ───────────────────────────────────────────────────────────────
  ["extension triceps assis",                          "Seated Triceps Press"],
  ["extension triceps poulie haute",                   "Triceps Pushdown"],

  // ── PECTORAUX ─────────────────────────────────────────────────────────────
  ["écarté (machine)",                                 "Chest Fly (Machine)"],
  ["développé couché (machine smith)",                 "Bench Press (Smith Machine)"],
  ["chest press convergent (machine)",                 "Iso-Lateral Chest Press (Machine)"],

  // ── ABDOS ─────────────────────────────────────────────────────────────────
  ["crunch poulie",                                    "Cable Crunch"],

  // ── JAMBES ────────────────────────────────────────────────────────────────
  ["extension jambes",                                 "Leg Extension (Machine)"],
  ["extensions une jambe",                             "Single Leg Extensions"],
  ["leg curl assis",                                   "Seated Leg Curl (Machine)"],
  ["presse à cuisses",                                 "Leg Press (Machine)"],
  ["adduction hanche",                                 "Hip Adduction (Machine)"],
  ["abduction hanche",                                 "Hip Abduction (Machine)"],
  ["extension mollets assis",                          "Seated Calf Raise"],

  // ── CARDIO ────────────────────────────────────────────────────────────────
  ["course à pieds",                                   "Running"],
  ["vélo machine",                                     "Spinning"],

  // ── CASING / ACCENT NORMALIZATION ─────────────────────────────────────────
  // "hack squat elastique" and "Hack Squat Élastique" are the same exercise
  ["hack squat élastique",                             "Hack Squat Élastique"],
  ["hack squat elastique",                             "Hack Squat Élastique"],
  // "SoulèVe De Hanche Machine" has erratic capitalization in some exports
  ["soulève de hanche machine",                        "Soulève De Hanche Machine"],
  // "UWU Avant bras" is the same custom exercise as "Uwu Avant Bras"
  ["uwu avant bras",                                   "Uwu Avant Bras"],
])

/**
 * Returns the canonical exercise name for a given input.
 * Matching is case-insensitive; if no mapping is found, the original name is returned.
 */
export function normalizeExerciseName(name) {
  if (!name) return name
  return LOOKUP.get(name.toLowerCase().trim()) ?? name
}
