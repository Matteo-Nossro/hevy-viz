const BASE = '/api'
const USERNAME_KEY = 'hevy_username'

export function getStoredUsername() {
  return localStorage.getItem(USERNAME_KEY)
}

export function storeUsername(username) {
  localStorage.setItem(USERNAME_KEY, username)
}

export function clearStoredUsername() {
  localStorage.removeItem(USERNAME_KEY)
}

class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || body?.details || `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

async function request(path, options = {}) {
  const username = getStoredUsername()
  const headers = {
    'Content-Type': 'application/json',
    ...(username ? { 'X-Username': username } : {}),
    ...options.headers,
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let body = null
    try { body = await res.json() } catch {}
    throw new ApiError(res.status, body)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return null
  return res.json()
}

// ── Utilisateurs (appels anon — pas de X-Username) ─────────────────────────

export async function listUsers() {
  return request('/users?order=created_at', {
    headers: { 'X-Username': undefined },
  })
}

export async function getUser(username) {
  const rows = await request(`/users?username=eq.${encodeURIComponent(username)}`, {
    headers: { 'X-Username': undefined },
  })
  return rows?.[0] ?? null
}

export async function createUser(data) {
  const rows = await request('/users', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: {
      'X-Username': undefined,
      'Prefer': 'return=representation',
    },
  })
  return rows?.[0] ?? null
}

// ── Workout sets ────────────────────────────────────────────────────────────

export async function getWorkoutSets() {
  return request('/workout_sets?order=start_time')
}

export async function importWorkoutSets(rows) {
  const result = await request('/rpc/import_workout_sets', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
  // PostgREST renvoie un tableau à un élément pour les fonctions RETURNS TABLE
  return Array.isArray(result) ? result[0] : result
}

export async function clearWorkoutSets() {
  // ?id=gt.0 correspond à toutes les lignes (BIGSERIAL commence à 1)
  // RLS garantit que seules les lignes du user courant sont supprimées
  return request('/workout_sets?id=gt.0', { method: 'DELETE' })
}

// ── Measurements ────────────────────────────────────────────────────────────

export async function getMeasurements() {
  return request('/measurements?order=date')
}

export async function importMeasurements(rows) {
  const result = await request('/rpc/import_measurements', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
  return Array.isArray(result) ? result[0] : result
}

export async function clearMeasurements() {
  return request('/measurements?id=gt.0', { method: 'DELETE' })
}

// ── Overrides de mapping musculaire ────────────────────────────────────────

export async function getMappingOverrides() {
  return request('/exercise_mapping_overrides')
}

export async function setMappingOverride(exerciseTitle, muscleGroups) {
  const existing = await request(
    `/exercise_mapping_overrides?exercise_title=eq.${encodeURIComponent(exerciseTitle)}`,
  )

  if (existing && existing.length > 0) {
    return request(
      `/exercise_mapping_overrides?exercise_title=eq.${encodeURIComponent(exerciseTitle)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ muscle_groups: muscleGroups }),
        headers: { 'Prefer': 'return=representation' },
      },
    )
  }

  const username = getStoredUsername()
  const user = await getUser(username)
  return request('/exercise_mapping_overrides', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, exercise_title: exerciseTitle, muscle_groups: muscleGroups }),
    headers: { 'Prefer': 'return=representation' },
  })
}

export async function deleteMappingOverride(exerciseTitle) {
  return request(
    `/exercise_mapping_overrides?exercise_title=eq.${encodeURIComponent(exerciseTitle)}`,
    { method: 'DELETE' },
  )
}
