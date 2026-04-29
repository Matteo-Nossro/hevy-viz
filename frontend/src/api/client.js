const BASE = '/api'
const TOKEN_KEY = 'hevy_session_token'
const USER_KEY  = 'hevy_session_user'

// Cache username → user_id chargé au premier appel cross-user
const userIdCache = new Map()

// ── Session storage ────────────────────────────────────────────────────────

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

function storeSession({ token, user_id, username, display_name }) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, JSON.stringify({ id: user_id, username, display_name }))
  userIdCache.clear()
  userIdCache.set(username, user_id)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  userIdCache.clear()
}

// Compatibilité avec App.vue existant (lecture seule, ne stocke plus rien)
export function getStoredUsername() {
  return getStoredUser()?.username ?? null
}
export function clearStoredUsername() {
  clearSession()
}

// ── Erreurs ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.message || body?.details || `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

// ── Requête générique ──────────────────────────────────────────────────────

async function request(path, options = {}) {
  const token = getStoredToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Session-Token': token } : {}),
    ...options.headers,
  }

  // Permet d'effacer un header en passant undefined
  for (const k of Object.keys(headers)) {
    if (headers[k] === undefined) delete headers[k]
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let body = null
    try { body = await res.json() } catch {}
    if (res.status === 401 || res.status === 403) {
      clearSession()
    }
    throw new ApiError(res.status, body)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') return null
  return res.json()
}

// ── Auth ───────────────────────────────────────────────────────────────────

// Liste publique des utilisateurs (vue users_public, sans password_hash).
// Inclut un flag has_password pour différencier login vs bootstrap.
export async function listUsers() {
  return request('/users_public?order=created_at', {
    headers: { 'Authorization': undefined },
  })
}

export async function login(username, password) {
  const rows = await request('/rpc/login', {
    method: 'POST',
    body: JSON.stringify({ uname: username, pwd: password }),
    headers: { 'Authorization': undefined },
  })
  const session = Array.isArray(rows) ? rows[0] : rows
  if (!session?.token) throw new Error('Invalid login response')
  storeSession(session)
  return session
}

export async function register(username, displayName, password) {
  const rows = await request('/rpc/register', {
    method: 'POST',
    body: JSON.stringify({ uname: username, dname: displayName ?? '', pwd: password }),
    headers: { 'Authorization': undefined },
  })
  const session = Array.isArray(rows) ? rows[0] : rows
  if (!session?.token) throw new Error('Invalid register response')
  storeSession(session)
  return session
}

// One-shot pour les users existants sans mot de passe (migration).
export async function bootstrapPassword(username, password) {
  const rows = await request('/rpc/bootstrap_password', {
    method: 'POST',
    body: JSON.stringify({ uname: username, pwd: password }),
    headers: { 'Authorization': undefined },
  })
  const session = Array.isArray(rows) ? rows[0] : rows
  if (!session?.token) throw new Error('Invalid bootstrap response')
  storeSession(session)
  return session
}

export async function logout() {
  try {
    await request('/rpc/logout', { method: 'POST' })
  } catch {
    // best-effort, on nettoie quoi qu'il arrive
  }
  clearSession()
}

export async function changePassword(oldPwd, newPwd) {
  return request('/rpc/change_password', {
    method: 'POST',
    body: JSON.stringify({ old_pwd: oldPwd, new_pwd: newPwd }),
  })
}

// Validation de session au démarrage : appelle whoami() qui retourne le user
// courant si le token est valide, ou un tableau vide sinon.
export async function checkSession() {
  const token = getStoredToken()
  if (!token) return null
  try {
    const rows = await request('/rpc/whoami', { method: 'POST', body: '{}' })
    const me = Array.isArray(rows) ? rows[0] : rows
    if (!me?.user_id) {
      clearSession()
      return null
    }
    const user = { id: me.user_id, username: me.username, display_name: me.display_name }
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    return user
  } catch (e) {
    if (e.status === 401 || e.status === 403) {
      clearSession()
      return null
    }
    // Réseau down → on garde le state, App.vue gère le mode offline
    return getStoredUser()
  }
}

// ── Workout sets ───────────────────────────────────────────────────────────

export async function getWorkoutSets() {
  const id = getStoredUser()?.id
  if (!id) throw new Error('Not authenticated')
  return request(`/workout_sets?user_id=eq.${id}&order=start_time`)
}

export async function importWorkoutSets(rows) {
  const result = await request('/rpc/import_workout_sets', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
  return Array.isArray(result) ? result[0] : result
}

export async function clearWorkoutSets() {
  return request('/workout_sets?id=gt.0', { method: 'DELETE' })
}

// ── Measurements ───────────────────────────────────────────────────────────

export async function getMeasurements() {
  const id = getStoredUser()?.id
  if (!id) throw new Error('Not authenticated')
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

// ── InBody scans ───────────────────────────────────────────────────────────

export async function getInbodyScans() {
  const id = getStoredUser()?.id
  if (!id) throw new Error('Not authenticated')
  return request(`/inbody_scans?user_id=eq.${id}&order=scan_date.asc`)
}

export async function addInbodyScan(data) {
  const id = getStoredUser()?.id
  if (!id) throw new Error('Not authenticated')
  const rows = await request('/inbody_scans', {
    method: 'POST',
    body: JSON.stringify({ ...data, user_id: id }),
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

  const id = getStoredUser()?.id
  if (!id) throw new Error('Not authenticated')
  return request('/exercise_mapping_overrides', {
    method: 'POST',
    body: JSON.stringify({ user_id: id, exercise_title: exerciseTitle, muscle_groups: muscleGroups }),
    headers: { 'Prefer': 'return=representation' },
  })
}

export async function deleteMappingOverride(exerciseTitle) {
  return request(
    `/exercise_mapping_overrides?exercise_title=eq.${encodeURIComponent(exerciseTitle)}`,
    { method: 'DELETE' },
  )
}

// ── Requêtes cross-user (lecture libre entre users authentifiés) ──────────

async function resolveUserId(username) {
  if (userIdCache.has(username)) return userIdCache.get(username)
  const rows = await request(`/users_public?username=eq.${encodeURIComponent(username)}`)
  const user = rows?.[0]
  if (!user) throw new Error(`User not found: ${username}`)
  userIdCache.set(username, user.id)
  return user.id
}

// getUser conservé pour rétrocompatibilité (App.vue) — résout via users_public
export async function getUser(username) {
  const rows = await request(`/users_public?username=eq.${encodeURIComponent(username)}`, {
    headers: { 'Authorization': undefined },
  })
  return rows?.[0] ?? null
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
