import { useEffect, useRef, useState } from 'react'

export function PWAInstallButton() {
  const [isInstallable, setIsInstallable] = useState(false)
  const deferredPromptRef = useRef<any>(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      deferredPromptRef.current = e
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPromptRef.current) return

    deferredPromptRef.current.prompt()
    const { outcome } = await deferredPromptRef.current.userChoice

    if (outcome === 'accepted') {
      console.log('PWA installed')
    }
    deferredPromptRef.current = null
    setIsInstallable(false)
  }

  if (!isInstallable) return null

  return (
    <button
      className="action-button"
      onClick={handleInstall}
      style={{ width: '100%', marginTop: '0.5rem' }}
    >
      📱 Tải ứng dụng
    </button>
  )
}
