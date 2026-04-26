/**
 * Mapping exercice → groupes musculaires.
 * Couvre les noms par défaut Hevy (anglais) + ajouts FR.
 * Si un exercice n'est pas dans ce mapping, on utilise un fallback par mots-clés
 * (cherche "bench", "curl", "squat" etc. dans le nom). Voir getMuscleGroups().
 */
export const MUSCLE_MAPPING = {
  // ===== PECTORAUX =====
  "Bench Press (Smith Machine)":                  ["Pectoraux", "Triceps", "Épaules"],
  "Bench Press (Barbell)":                        ["Pectoraux", "Triceps", "Épaules"],
  "Bench Press (Dumbbell)":                       ["Pectoraux", "Triceps", "Épaules"],
  "Incline Bench Press (Barbell)":                ["Pectoraux", "Épaules", "Triceps"],
  "Incline Bench Press (Dumbbell)":               ["Pectoraux", "Épaules", "Triceps"],
  "Incline Bench Press (Smith Machine)":          ["Pectoraux", "Épaules", "Triceps"],
  "Decline Bench Press (Barbell)":                ["Pectoraux", "Triceps"],
  "Chest Press (Machine)":                        ["Pectoraux", "Triceps"],
  "Chest Press Convergent (Machine)":             ["Pectoraux", "Triceps"],
  "Iso-Lateral Chest Press (Machine)":            ["Pectoraux", "Triceps"],
  "Chest Fly (Machine)":                          ["Pectoraux"],
  "Butterfly (Pec Deck)":                         ["Pectoraux"],
  "Pec Deck (Machine)":                           ["Pectoraux"],
  "Cable Crossover":                              ["Pectoraux"],
  "Push Up":                                      ["Pectoraux", "Triceps", "Épaules"],
  "Dip":                                          ["Pectoraux", "Triceps"],
  "Développé Couché (Machine Smith)":             ["Pectoraux", "Triceps"],

  // ===== DOS =====
  "Lat Pulldown (Cable)":                         ["Dos", "Biceps"],
  "Lat Pulldown (Machine)":                       ["Dos", "Biceps"],
  "Pull Up":                                      ["Dos", "Biceps"],
  "Chin Up":                                      ["Dos", "Biceps"],
  "Seated Cable Row":                             ["Dos", "Biceps"],
  "Seated Cable Row - V Grip (Cable)":            ["Dos", "Biceps"],
  "Iso-Lateral Row (Machine)":                    ["Dos", "Biceps"],
  "Bent Over Row (Barbell)":                      ["Dos", "Biceps"],
  "Bent Over Row (Dumbbell)":                     ["Dos", "Biceps"],
  "T Bar Row":                                    ["Dos", "Biceps"],
  "Back Extension (Machine)":                     ["Dos"],
  "Hyperextension":                               ["Dos", "Fessiers"],
  "Deadlift (Barbell)":                           ["Dos", "Fessiers", "Ischio-jambiers"],
  "Romanian Deadlift (Barbell)":                  ["Ischio-jambiers", "Fessiers", "Dos"],
  "Shrug (Barbell)":                              ["Dos"],
  "Shrug (Dumbbell)":                             ["Dos"],
  "Tirage Poitrine (Poulie)":                     ["Dos", "Biceps"],
  "Tirage assis à la poulie - prise en V (poulie)": ["Dos", "Biceps"],
  "Extension Dos (Machine)":                      ["Dos"],

  // ===== ÉPAULES =====
  "Seated Shoulder Press (Machine)":              ["Épaules", "Triceps"],
  "Shoulder Press (Dumbbell)":                    ["Épaules", "Triceps"],
  "Shoulder Press (Barbell)":                     ["Épaules", "Triceps"],
  "Overhead Press (Barbell)":                     ["Épaules", "Triceps"],
  "Arnold Press (Dumbbell)":                      ["Épaules", "Triceps"],
  "Lateral Raise (Dumbbell)":                     ["Épaules"],
  "Lateral Raise (Cable)":                        ["Épaules"],
  "Lateral Raise (Machine)":                      ["Épaules"],
  "Front Raise (Dumbbell)":                       ["Épaules"],
  "Front Raise (Cable)":                          ["Épaules"],
  "Rear Delt Reverse Fly (Machine)":              ["Épaules", "Dos"],
  "Reverse Fly (Dumbbell)":                       ["Épaules", "Dos"],
  "Face Pull":                                    ["Épaules", "Dos"],
  "Face Pull (Cable)":                            ["Épaules", "Dos"],
  "Upright Row (Barbell)":                        ["Épaules", "Dos"],
  "Upright Row (Cable)":                          ["Épaules", "Dos"],
  "Tirage Menton Poulie":                         ["Épaules", "Dos"],
  "Presse Épaules Assis (Machine)":               ["Épaules", "Triceps"],
  "Élévation Latérale (Haltère)":                 ["Épaules"],
  "Oiseau (Machine)":                             ["Épaules"],

  // ===== BICEPS =====
  "EZ Bar Biceps Curl":                           ["Biceps"],
  "Biceps Curl (Barbell)":                        ["Biceps"],
  "Biceps Curl (Dumbbell)":                       ["Biceps"],
  "Biceps Curl (Cable)":                          ["Biceps"],
  "Biceps Curl (Machine)":                        ["Biceps"],
  "Hammer Curl (Dumbbell)":                       ["Biceps", "Avant-bras"],
  "Hammer Curl (Cable)":                          ["Biceps", "Avant-bras"],
  "Preacher Curl (Barbell)":                      ["Biceps"],
  "Preacher Curl (Dumbbell)":                     ["Biceps"],
  "Preacher Curl (Machine)":                      ["Biceps"],
  "Concentration Curl":                           ["Biceps"],
  "Incline Curl (Dumbbell)":                      ["Biceps"],
  "Spider Curl":                                  ["Biceps"],
  "Curl Biceps (Barre EZ)":                       ["Biceps"],
  "Curl Marteau (Haltère)":                       ["Biceps", "Avant-bras"],

  // ===== TRICEPS =====
  "Triceps Pushdown":                             ["Triceps"],
  "Triceps Pushdown (Cable)":                     ["Triceps"],
  "Triceps Extension (Cable)":                    ["Triceps"],
  "Triceps Extension (Dumbbell)":                 ["Triceps"],
  "Triceps Extension (Machine)":                  ["Triceps"],
  "Seated Triceps Press":                         ["Triceps"],
  "Skullcrusher (Barbell)":                       ["Triceps"],
  "Skullcrusher (Dumbbell)":                      ["Triceps"],
  "Overhead Triceps Extension":                   ["Triceps"],
  "Close Grip Bench Press (Barbell)":             ["Triceps", "Pectoraux"],
  "Extension Triceps Assis":                      ["Triceps"],
  "Extension Triceps Poulie Haute":               ["Triceps"],

  // ===== AVANT-BRAS =====
  "Reverse Curl (Cable)":                         ["Avant-bras", "Biceps"],
  "Reverse Curl (Barbell)":                       ["Avant-bras", "Biceps"],
  "Wrist Curl":                                   ["Avant-bras"],
  "Wrist Extension":                              ["Avant-bras"],
  "Uwu Avant Bras":                               ["Avant-bras"],
  "Curl inversé (câble)":                         ["Biceps", "Avant-bras"],

  // ===== JAMBES =====
  "Squat (Barbell)":                              ["Quadriceps", "Fessiers"],
  "Front Squat (Barbell)":                        ["Quadriceps", "Fessiers"],
  "Hack Squat (Machine)":                         ["Quadriceps", "Fessiers"],
  "hack squat elastique":                         ["Quadriceps", "Fessiers"],
  "Leg Press (Machine)":                          ["Quadriceps", "Fessiers"],
  "Leg Extension (Machine)":                      ["Quadriceps"],
  "Single Leg Extensions":                        ["Quadriceps"],
  "Bulgarian Split Squat":                        ["Quadriceps", "Fessiers"],
  "Lunges":                                       ["Quadriceps", "Fessiers"],
  "Step Up":                                      ["Quadriceps", "Fessiers"],
  "Goblet Squat":                                 ["Quadriceps", "Fessiers"],
  "Extension Jambes":                             ["Quadriceps"],

  // Ischio-jambiers
  "Lying Leg Curl":                               ["Ischio-jambiers"],
  "Seated Leg Curl (Machine)":                    ["Ischio-jambiers"],
  "Standing Leg Curl":                            ["Ischio-jambiers"],
  "Good Morning (Barbell)":                       ["Ischio-jambiers", "Dos"],

  // Fessiers
  "Hip Thrust (Barbell)":                         ["Fessiers", "Ischio-jambiers"],
  "Hip Thrust (Machine)":                         ["Fessiers", "Ischio-jambiers"],
  "Glute Bridge":                                 ["Fessiers"],
  "Soulève De Hanche Machine":                    ["Fessiers", "Ischio-jambiers"],
  "Cable Kickback":                               ["Fessiers"],

  // Adducteurs / Abducteurs
  "Hip Adduction (Machine)":                      ["Adducteurs"],
  "Hip Abduction (Machine)":                      ["Abducteurs"],
  "Adduction Hanche":                             ["Adducteurs"],
  "Abduction Hanche":                             ["Abducteurs"],

  // Mollets
  "Standing Calf Raise":                          ["Mollets"],
  "Seated Calf Raise":                            ["Mollets"],
  "Calf Press (Machine)":                         ["Mollets"],
  "Extension Mollets Assis":                      ["Mollets"],

  // ===== ABDOS =====
  "Crunch":                                       ["Abdominaux"],
  "Crunch (Machine)":                             ["Abdominaux"],
  "Cable Crunch":                                 ["Abdominaux"],
  "Crunch Poulie":                                ["Abdominaux"],
  "Sit Up":                                       ["Abdominaux"],
  "Hanging Leg Raise":                            ["Abdominaux"],
  "Plank":                                        ["Abdominaux"],
  "Russian Twist":                                ["Abdominaux"],
  "Ab Wheel":                                     ["Abdominaux"],
  "Decline Crunch":                               ["Abdominaux"],

  // ===== CARDIO =====
  "Running":                                      ["Cardio"],
  "Course à pieds":                               ["Cardio"],
  "Walking":                                      ["Cardio"],
  "Cycling":                                      ["Cardio"],
  "Spinning":                                     ["Cardio"],
  "Rowing Machine":                               ["Cardio", "Dos"],
  "Elliptical":                                   ["Cardio"],
  "Stair Climber":                                ["Cardio"],
  "Jump Rope":                                    ["Cardio"],
  "Warm Up":                                      ["Cardio"],
}

export const MUSCLE_GROUPS = [
  "Dos", "Biceps", "Avant-bras", "Pectoraux", "Triceps", "Épaules",
  "Quadriceps", "Fessiers", "Ischio-jambiers", "Adducteurs", "Abducteurs",
  "Mollets", "Abdominaux", "Cardio", "Autre"
]

export const MUSCLE_COLORS = {
  "Dos":              "#8b5cf6",
  "Biceps":           "#a78bfa",
  "Avant-bras":       "#c4b5fd",
  "Pectoraux":        "#ec4899",
  "Triceps":          "#f472b6",
  "Épaules":          "#fb7185",
  "Quadriceps":       "#06b6d4",
  "Fessiers":         "#22d3ee",
  "Ischio-jambiers":  "#67e8f9",
  "Adducteurs":       "#2dd4bf",
  "Abducteurs":       "#5eead4",
  "Mollets":          "#34d399",
  "Abdominaux":       "#fbbf24",
  "Cardio":           "#f97316",
  "Autre":            "#6e7681",
}

/**
 * Fallback intelligent : si l'exercice n'est pas dans le mapping explicite,
 * on cherche des mots-clés dans le nom (casse-insensible) pour deviner les groupes.
 * Ordonné : on s'arrête au PREMIER match pour éviter les chevauchements bizarres.
 */
const KEYWORD_RULES = [
  // Cardio en premier (priorité)
  { kw: ['running', 'course', 'jogging', 'sprint'],          groups: ['Cardio'] },
  { kw: ['walking', 'walk', 'marche'],                       groups: ['Cardio'] },
  { kw: ['cycling', 'spinning', 'velo', 'vélo', 'cycle'],    groups: ['Cardio'] },
  { kw: ['rowing'],                                          groups: ['Cardio', 'Dos'] },
  { kw: ['elliptical', 'elliptique'],                        groups: ['Cardio'] },
  { kw: ['stair', 'climber'],                                groups: ['Cardio'] },
  { kw: ['warm up', 'warmup', 'échauffement', 'echauffement'], groups: ['Cardio'] },

  // Abdos
  { kw: ['crunch', 'sit up', 'sit-up', 'situp', 'plank', 'planche', 'ab wheel', 'leg raise', 'russian twist', 'abdo'], groups: ['Abdominaux'] },

  // Mollets
  { kw: ['calf', 'mollet'],                                  groups: ['Mollets'] },

  // Adducteurs / Abducteurs (avant le matching plus large "leg")
  { kw: ['adduction', 'adducteur'],                          groups: ['Adducteurs'] },
  { kw: ['abduction', 'abducteur'],                          groups: ['Abducteurs'] },

  // Fessiers / hip thrust
  { kw: ['hip thrust', 'glute bridge', 'glute', 'fessier', 'soulève de hanche', 'souleve de hanche', 'kickback'], groups: ['Fessiers', 'Ischio-jambiers'] },

  // Ischio
  { kw: ['leg curl', 'good morning', 'romanian'],            groups: ['Ischio-jambiers'] },

  // Quadriceps
  { kw: ['leg extension', 'extension jambe', 'quad'],        groups: ['Quadriceps'] },
  { kw: ['squat', 'lunge', 'fente', 'leg press', 'presse jambe', 'step up'], groups: ['Quadriceps', 'Fessiers'] },

  // Deadlift global
  { kw: ['deadlift', 'soulevé de terre', 'souleve de terre'], groups: ['Dos', 'Fessiers', 'Ischio-jambiers'] },

  // Triceps (avant pec, avant chest)
  { kw: ['triceps', 'pushdown', 'skullcrusher', 'tricep'],   groups: ['Triceps'] },

  // Biceps (avant tirage et autres)
  { kw: ['biceps curl', 'curl biceps', 'preacher', 'concentration', 'spider curl'], groups: ['Biceps'] },
  { kw: ['hammer curl', 'curl marteau'],                     groups: ['Biceps', 'Avant-bras'] },
  { kw: ['reverse curl', 'curl inverse', 'curl inversé'],    groups: ['Avant-bras', 'Biceps'] },
  { kw: ['wrist'],                                           groups: ['Avant-bras'] },
  { kw: ['avant-bras', 'avant bras', 'forearm'],             groups: ['Avant-bras'] },
  { kw: ['curl'],                                            groups: ['Biceps'] }, // catch-all curl en dernier

  // Épaules (avant chest sinon "shoulder press" rate)
  { kw: ['shoulder press', 'overhead press', 'press épaule', 'press epaule', 'arnold'], groups: ['Épaules', 'Triceps'] },
  { kw: ['lateral raise', 'élévation latérale', 'elevation laterale'], groups: ['Épaules'] },
  { kw: ['front raise', 'élévation frontale', 'elevation frontale'],   groups: ['Épaules'] },
  { kw: ['rear delt', 'reverse fly', 'oiseau'],              groups: ['Épaules', 'Dos'] },
  { kw: ['face pull'],                                       groups: ['Épaules', 'Dos'] },
  { kw: ['upright row', 'tirage menton'],                    groups: ['Épaules', 'Dos'] },
  { kw: ['shrug', 'haussement'],                             groups: ['Dos'] },

  // Pec
  { kw: ['bench press', 'développé couché', 'developpe couche'], groups: ['Pectoraux', 'Triceps', 'Épaules'] },
  { kw: ['chest press', 'press pec', 'press pectoral'],      groups: ['Pectoraux', 'Triceps'] },
  { kw: ['chest fly', 'butterfly', 'pec deck', 'écarté', 'ecarte', 'crossover'], groups: ['Pectoraux'] },
  { kw: ['push up', 'pushup', 'pompe', 'dip'],               groups: ['Pectoraux', 'Triceps'] },
  { kw: ['chest', 'pec', 'pectoral'],                        groups: ['Pectoraux'] },

  // Dos
  { kw: ['lat pulldown', 'pull down', 'pulldown', 'tirage poitrine'], groups: ['Dos', 'Biceps'] },
  { kw: ['cable row', 'seated row', 'rowing', 'tirage assis', 'iso-lateral row', 'bent over row'], groups: ['Dos', 'Biceps'] },
  { kw: ['pull up', 'pullup', 'chin up', 'chinup', 'traction'], groups: ['Dos', 'Biceps'] },
  { kw: ['back extension', 'hyperextension', 'extension dos'], groups: ['Dos'] },
  { kw: ['t bar', 'tbar', 't-bar'],                          groups: ['Dos', 'Biceps'] },
  { kw: ['back', 'dos', 'lat'],                              groups: ['Dos'] },

  // Catch-all génériques
  { kw: ['shoulder', 'épaule', 'epaule', 'delt'],            groups: ['Épaules'] },
  { kw: ['leg'],                                             groups: ['Quadriceps'] },
]

/**
 * Retourne les groupes musculaires d'un exercice.
 * 0. Override custom (priorité absolue).
 * 1. Mapping explicite (exact match).
 * 2. Fallback : recherche de mots-clés dans le nom.
 * 3. "Autre" en dernier recours.
 */
export function getMuscleGroups(exerciseTitle, customMap = {}) {
  if (!exerciseTitle) return ["Autre"]

  // 0. Custom override
  if (customMap[exerciseTitle]) return customMap[exerciseTitle]

  // 1. Match exact
  if (MUSCLE_MAPPING[exerciseTitle]) return MUSCLE_MAPPING[exerciseTitle]

  // 2. Fallback par mots-clés
  const lower = exerciseTitle.toLowerCase()
  for (const rule of KEYWORD_RULES) {
    for (const kw of rule.kw) {
      if (lower.includes(kw)) return rule.groups
    }
  }

  // 3. Inconnu
  return ["Autre"]
}

/**
 * Pour debug : liste les exercices d'un dataset qui retombent dans "Autre".
 */
export function unmappedExercises(exerciseTitles, customMap = {}) {
  return exerciseTitles.filter(t => {
    const groups = getMuscleGroups(t, customMap)
    return groups.length === 1 && groups[0] === "Autre"
  })
}
