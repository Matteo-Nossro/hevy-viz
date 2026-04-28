const BASE = '/api'
const USERNAME_KEY = 'hevy_username'

// Cache username → user_id chargé au premier appel cross-user
const userIdCache = new Map()

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
  const id = await resolveUserId(getStoredUsername())
  return request(`/workout_sets?user_id=eq.${id}&order=start_time`)
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
  const id = await resolveUserId(getStoredUsername())
  return request(`/measurements?user_id=eq.${id}&order=date`)
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

// ── InBody scans ────────────────────────────────────────────────────────────

export async function getInbodyScans() {
  const id = await resolveUserId(getStoredUsername())
  return request(`/inbody_scans?user_id=eq.${id}&order=scan_date.asc`)
}

export async function addInbodyScan(data) {
  const username = getStoredUsername()
  const user = await getUser(username)
  const rows = await request('/inbody_scans', {
    method: 'POST',
    body: JSON.stringify({ ...data, user_id: user.id }),
    headers: { 'Prefer': 'return=representation' },
  })
  return rows?.[0] ?? null
}

export async function updateInbodyScan(id, data) {
  const rows = await request(`/inbody_scans?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    headers: { 'Prefer': 'return=representation' },
  })
  return rows?.[0] ?? null
}

export async function deleteInbodyScan(id) {
  return request(`/inbody_scans?id=eq.${id}`, { method: 'DELETE' })
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

// ── Requêtes cross-user (lecture libre après migration 002) ─────────────────

async function resolveUserId(username) {
  if (userIdCache.has(username)) return userIdCache.get(username)
  const user = await getUser(username)
  if (!user) throw new Error(`User not found: ${username}`)
  userIdCache.set(username, user.id)
  return user.id
}

export async function getWorkoutSetsForUser(username) {
  const id = await resolveUserId(username)
  return request(`/workout_sets?user_id=eq.${id}&order=start_time`)
}

export async function getInbodyScansForUser(username) {
  const id = await resolveUserId(username)
  return request(`/inbody_scans?user_id=eq.${id}&order=scan_date.asc`)
}

export async function getMeasurementsForUser(username) {
  const id = await resolveUserId(username)
  return request(`/measurements?user_id=eq.${id}&order=date`)
}
