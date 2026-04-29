<script setup>
import { ref, onMounted, computed } from 'vue'
import { listUsers, login, register, bootstrapPassword } from '../api/client'

const emit = defineEmits(['user-selected'])

// État principal
const users = ref([])
const loading = ref(true)
const error = ref(null)

// Modal d'auth (3 modes : login / register / bootstrap)
const modalMode = ref(null)            // 'login' | 'register' | 'bootstrap' | null
const modalUser = ref(null)            // user sélectionné (login/bootstrap)
const submitting = ref(false)
const modalError = ref(null)
const formUsername = ref('')
const formDisplayName = ref('')
const formPassword = ref('')
const formPasswordConfirm = ref('')
const showPassword = ref(false)

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

function openLogin(user) {
  modalUser.value = user
  modalMode.value = user.has_password ? 'login' : 'bootstrap'
  formUsername.value = user.username
  formPassword.value = ''
  formPasswordConfirm.value = ''
  modalError.value = null
}

function openRegister() {
  modalUser.value = null
  modalMode.value = 'register'
  formUsername.value = ''
  formDisplayName.value = ''
  formPassword.value = ''
  formPasswordConfirm.value = ''
  modalError.value = null
}

function closeModal() {
  modalMode.value = null
  modalUser.value = null
  formPassword.value = ''
  formPasswordConfirm.value = ''
}

const modalTitle = computed(() => {
  if (modalMode.value === 'login') return `Connexion — ${modalUser.value?.display_name || modalUser.value?.username}`
  if (modalMode.value === 'register') return 'Créer un profil'
  if (modalMode.value === 'bootstrap') return `Définir un mot de passe — ${modalUser.value?.display_name || modalUser.value?.username}`
  return ''
})

const needsConfirm = computed(() => modalMode.value !== 'login')

async function submit() {
  modalError.value = null

  if (modalMode.value === 'register') {
    if (!USERNAME_RE.test(formUsername.value.trim())) {
      modalError.value = 'Nom d\'utilisateur invalide (3-50 caractères, lettres/chiffres/_/-).'
      return
    }
  }
  if (formPassword.value.length < 8) {
    modalError.value = 'Le mot de passe doit faire au moins 8 caractères.'
    return
  }
  if (needsConfirm.value && formPassword.value !== formPasswordConfirm.value) {
    modalError.value = 'Les mots de passe ne correspondent pas.'
    return
  }

  submitting.value = true
  try {
    let session
    if (modalMode.value === 'login') {
      session = await login(formUsername.value.trim(), formPassword.value)
    } else if (modalMode.value === 'register') {
      session = await register(
        formUsername.value.trim(),
        formDisplayName.value.trim() || null,
        formPassword.value,
      )
    } else if (modalMode.value === 'bootstrap') {
      session = await bootstrapPassword(formUsername.value.trim(), formPassword.value)
    }
    closeModal()
    emit('user-selected', {
      id: session.user_id,
      username: session.username,
      display_name: session.display_name,
    })
  } catch (e) {
    if (e.status === 401 || /Invalid credentials/i.test(e.message)) {
      modalError.value = 'Mot de passe incorrect.'
    } else if (e.status === 409 || /duplicate|unique/i.test(e.message)) {
      modalError.value = 'Ce nom d\'utilisateur est déjà pris.'
    } else if (e.status === 429) {
      modalError.value = 'Trop de tentatives, réessayez dans un instant.'
    } else {
      modalError.value = e.message || 'Erreur inattendue.'
    }
  } finally {
    submitting.value = false
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
          @click="openLogin(user)"
          class="w-full soft-card p-4 text-left hover:bg-surface-hover transition-colors group"
        >
          <div class="flex items-center justify-between">
            <div>
              <p class="font-medium text-sm">{{ user.display_name || user.username }}</p>
              <p v-if="user.display_name" class="text-text-faint text-xs mt-0.5">@{{ user.username }}</p>
              <p v-if="!user.has_password" class="text-amber-400 text-xs mt-0.5">
                Mot de passe à définir
              </p>
            </div>
            <svg viewBox="0 0 24 24" class="w-4 h-4 text-text-faint group-hover:text-accent transition-colors" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>
        </button>
      </div>

      <!-- Bouton créer -->
      <button v-if="!loading" @click="openRegister" class="btn btn-primary w-full">
        + Nouveau profil
      </button>
    </div>

    <!-- Modal auth -->
    <div v-if="modalMode"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 z-50"
      @click.self="closeModal"
    >
      <div class="soft-card w-full max-w-sm p-6">
        <h2 class="font-semibold text-base mb-4">{{ modalTitle }}</h2>

        <p v-if="modalMode === 'bootstrap'" class="text-text-muted text-xs mb-3">
          Ce profil n'a pas encore de mot de passe. Définissez-en un pour sécuriser vos données.
        </p>

        <div class="space-y-3 mb-4">
          <!-- Register only : username + display name -->
          <template v-if="modalMode === 'register'">
            <div>
              <label class="text-xs text-text-muted mb-1 block">Nom d'utilisateur <span class="text-danger">*</span></label>
              <input
                v-model="formUsername"
                type="text"
                placeholder="ex: guillaume"
                pattern="[a-zA-Z0-9_\-]{3,50}"
                class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                autocomplete="username"
                autofocus
              />
              <p class="text-xs text-text-faint mt-1">3-50 caractères, lettres, chiffres, _ ou -</p>
            </div>
            <div>
              <label class="text-xs text-text-muted mb-1 block">Nom affiché <span class="text-text-faint">(optionnel)</span></label>
              <input
                v-model="formDisplayName"
                type="text"
                placeholder="ex: Guillaume"
                class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                autocomplete="name"
              />
            </div>
          </template>

          <!-- Password (tous les modes) -->
          <div>
            <label class="text-xs text-text-muted mb-1 block">
              {{ modalMode === 'login' ? 'Mot de passe' : 'Nouveau mot de passe' }}
              <span class="text-danger">*</span>
            </label>
            <div class="relative">
              <input
                v-model="formPassword"
                :type="showPassword ? 'text' : 'password'"
                :placeholder="modalMode === 'login' ? '••••••••' : 'Min. 8 caractères'"
                class="w-full bg-bg border border-border rounded-lg px-3 py-2 pr-10 text-sm focus:border-accent focus:outline-none"
                :autocomplete="modalMode === 'login' ? 'current-password' : 'new-password'"
                :autofocus="modalMode !== 'register'"
                @keyup.enter="submit"
              />
              <button
                type="button"
                @click="showPassword = !showPassword"
                class="absolute inset-y-0 right-0 px-3 text-text-faint hover:text-text"
                :aria-label="showPassword ? 'Masquer' : 'Afficher'"
              >
                <svg v-if="!showPassword" viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Confirm (sauf login) -->
          <div v-if="needsConfirm">
            <label class="text-xs text-text-muted mb-1 block">Confirmer le mot de passe <span class="text-danger">*</span></label>
            <input
              v-model="formPasswordConfirm"
              :type="showPassword ? 'text' : 'password'"
              placeholder="Retapez le mot de passe"
              class="w-full bg-bg border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
              autocomplete="new-password"
              @keyup.enter="submit"
            />
          </div>
        </div>

        <div v-if="modalError" class="text-danger text-xs mb-3">{{ modalError }}</div>

        <div class="flex gap-2">
          <button @click="closeModal" class="btn btn-ghost flex-1" :disabled="submitting">
            Annuler
          </button>
          <button @click="submit" class="btn btn-primary flex-1" :disabled="submitting">
            <span v-if="submitting" class="inline-block w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin mr-1"></span>
            <span v-if="modalMode === 'login'">Se connecter</span>
            <span v-else-if="modalMode === 'register'">Créer</span>
            <span v-else>Définir</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
