<script setup>
import { ref, onMounted } from 'vue'
import { listUsers, createUser, storeUsername } from '../api/client'

const emit = defineEmits(['user-selected'])

const users = ref([])
const loading = ref(true)
const error = ref(null)
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref(null)
const newUsername = ref('')
const newDisplayName = ref('')

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,50}$/

onMounted(loadUsers)

async function loadUsers() {
  loading.value = true
  error.value = null
  try {
    users.value = await listUsers()
  } catch (e) {
    error.value = 'Impossible de contacter le serveur. Vérifiez que le backend est démarré.'
  } finally {
    loading.value = false
  }
}

function selectUser(user) {
  storeUsername(user.username)
  emit('user-selected', user)
}

function openCreateModal() {
  newUsername.value = ''
  newDisplayName.value = ''
  createError.value = null
  showCreateModal.value = true
}

async function submitCreate() {
  createError.value = null
  if (!USERNAME_RE.test(newUsername.value)) {
    createError.value = 'Nom d\'utilisateur invalide (3-50 caractères, lettres/chiffres/_/-).'
    return
  }
  creating.value = true
  try {
    const user = await createUser({
      username: newUsername.value.trim(),
      display_name: newDisplayName.value.trim() || null,
    })
    showCreateModal.value = false
    selectUser(user)
  } catch (e) {
    if (e.status === 409) {
      createError.value = 'Ce nom d\'utilisateur est déjà pris.'
    } else {
      createError.value = 'Erreur lors de la création : ' + e.message
    }
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
    <div class="w-full max-w-md">
      <!-- Logo + titre -->
      <div class="text-center mb-8">
        <div class="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
          style="background: var(--gradient-soft)">
          <svg viewBox="0 0 24 24" class="w-7 h-7 text-bg" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M6 4v16M18 4v16M3 12h18" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="text-2xl font-semibold tracking-tight mb-1">Hevy Viz</h1>
        <p class="text-text-muted text-sm">Sélectionnez ou créez votre profil</p>
      </div>

      <!-- Erreur API -->
      <div v-if="error" class="soft-card p-4 mb-4 border-danger/30 bg-danger/5 text-danger text-sm">
        <div class="flex items-center gap-2">
          <svg viewBox="0 0 24 24" class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
          <span>{{ error }}</span>
        </div>
        <button @click="loadUsers" class="btn btn-ghost text-xs mt-2 px-2 py-1">Réessayer</button>
      </div>

      <!-- Skeleton chargement -->
      <div v-if="loading && !error" class="space-y-2">
        <div v-for="i in 3" :key="i" class="soft-card p-4 animate-pulse">
          <div class="h-4 bg-surface-hover rounded w-32"></div>
          <div class="h-3 bg-surface-hover rounded w-20 mt-2"></div>
        </div>
      </div>

      <!-- Liste des utilisateurs -->
      <div v-if="!loading && !error" class="space-y-2 mb-4">
        <div v-if="users.length === 0" class="text-center text-text-muted text-sm py-6">
          Aucun utilisateur — créez le premier profil ci-dessous.
        </div>
        <button
          v-for="user in users"
          :key="user.username"
          @click="selectUser(user)"
          class="w-full soft-card p-4 text-left hover:bg-surface-hover transition-colors group"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-sm">{{ user.display_name || user.username }}</p>
              <p v-if="user.display_name" class="text-text-faint text-xs mt-0.5">@{{ user.username }}</p>
            </div>
            <svg viewBox="0 0 24 24" class="w-4 h-4 text-text-faint group-hover:text-accent transition-colors" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </button>
      </div>

      <!-- Bouton créer -->
      <button v-if="!loading" @click="openCreateModal" class="btn btn-primary w-full">
        + Nouveau profil
      </button>
    </div>

    <!-- Modal création -->
    <div v-if="showCreateModal"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50"
      @click.self="showCreateModal = false"
    >
      <div class="soft-card w-full max-w-sm p-6">
        <h2 class="font-semibold text-base mb-4">Créer un profil</h2>

        <div class="space-y-3 mb-4">
          <div>
            <label class="text-xs text-text-muted mb-1 block">Nom d'utilisateur <span class="text-danger">*</span></label>
            <input
              v-model="newUsername"
              type="text"
              placeholder="ex: guillaume"
              pattern="[a-zA-Z0-9_\-]{3,50}"
              class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
              @keyup.enter="submitCreate"
              autofocus
            />
            <p class="text-xs text-text-faint mt-1">3-50 caractères, lettres, chiffres, _ ou -</p>
          </div>
          <div>
            <label class="text-xs text-text-muted mb-1 block">Nom affiché <span class="text-text-faint">(optionnel)</span></label>
            <input
              v-model="newDisplayName"
              type="text"
              placeholder="ex: Guillaume"
              class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
              @keyup.enter="submitCreate"
            />
          </div>
        </div>

        <div v-if="createError" class="text-danger text-xs mb-3">{{ createError }}</div>

        <div class="flex gap-2">
          <button @click="showCreateModal = false" class="btn btn-ghost flex-1" :disabled="creating">
            Annuler
          </button>
          <button @click="submitCreate" class="btn btn-primary flex-1" :disabled="creating">
            <span v-if="creating" class="inline-block w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin mr-1"></span>
            Créer
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
