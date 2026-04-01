import { useEffect, useRef, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export function PWAInstallButton() {
  const [isInstallable, setIsInstallable] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      deferredPromptRef.current = event as BeforeInstallPromptEvent
      setIsInstallable(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const handleInstall = async () => {
    const promptEvent = deferredPromptRef.current
    if (!promptEvent) return

    await promptEvent.prompt()
    await promptEvent.userChoice
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
      Tai ung dung
    </button>
  )
}
