import { ref } from 'vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'

export function useUpdateAvailable() {
  const updateAvailable = ref(false)
  let swRegistration = null

  const { updateServiceWorker } = useRegisterSW({
    onNeedRefresh() {
      updateAvailable.value = true
    },
    onRegistered(registration) {
      swRegistration = registration
    },
  })

  function applyUpdate() {
    updateServiceWorker(true)
  }

  return { updateAvailable, applyUpdate }
}
