<script setup>
const props = defineProps({
  allUsers: { type: Array, required: true },
  selectedUsers: { type: Array, required: true },
  currentUserUsername: { type: String, required: true },
  userColorMap: { type: Object, required: true },
})
const emit = defineEmits(['toggle'])

function colorOf(username) {
  return props.userColorMap[username] ?? '#5eb8c4'
}

function isSelected(username) {
  return props.selectedUsers.includes(username)
}

function atMax() {
  return props.selectedUsers.length >= 4
}
</script>

<template>
<div class="soft-card p-4 space-y-3">
  <div class="flex flex-wrap items-baseline justify-between gap-2">
    <p class="text-xs font-medium text-text-muted uppercase tracking-wider">Utilisateurs</p>
    <p class="text-xs text-text-muted">Sélectionne jusqu'à 4 utilisateurs à comparer</p>
  </div>

  <div class="flex flex-wrap gap-2">
    <button
      v-for="user in allUsers"
      :key="user.username"
      @click="emit('toggle', user.username)"
      :disabled="user.username === currentUserUsername"
      :class="[
        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border',
        isSelected(user.username)
          ? 'text-bg border-transparent'
          : 'text-text-muted bg-transparent border-border hover:border-border-strong hover:text-text',
        user.username === currentUserUsername ? 'cursor-default' : 'cursor-pointer',
        atMax() && !isSelected(user.username) ? 'opacity-40 pointer-events-none' : '',
      ]"
      :style="isSelected(user.username)
        ? { backgroundColor: colorOf(user.username), borderColor: colorOf(user.username) }
        : { borderColor: colorOf(user.username) + '55' }"
    >
      <span
        class="w-2 h-2 rounded-full flex-shrink-0"
        :style="{ backgroundColor: colorOf(user.username) }"
      ></span>
      {{ user.display_name || user.username }}
      <span v-if="user.username === currentUserUsername" class="opacity-60 text-xs">(moi)</span>
    </button>
  </div>

  <p v-if="atMax()" class="text-xs text-text-muted">Maximum 4 utilisateurs atteint.</p>
</div>
</template>
