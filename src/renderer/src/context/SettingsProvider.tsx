import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import type { Settings, Theme, ViewMode } from '@shared/types/models'

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  lastDoctor: '',
  viewModes: { prescriptions: 'card', pharmacy: 'card' },
  lastExportDir: '',
  signatureImage: '',
  signatureX: 0.675,
  signatureY: 0.744,
  signatureWidth: 0.28,
  backupIntervalDays: 7,
  lastBackupAt: ''
}

interface SettingsContextValue {
  settings: Settings
  loading: boolean
  setTheme: (theme: Theme) => Promise<void>
  setLastDoctor: (doctor: string) => Promise<void>
  setSignatureImage: (signatureImage: string) => Promise<void>
  setSignatureLayout: (layout: { x: number; y: number; width: number }) => Promise<void>
  setViewMode: (module: 'prescriptions' | 'pharmacy', mode: ViewMode) => Promise<void>
  refresh: () => Promise<void>
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function SettingsProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const loaded = await window.api.settings.get()
      setSettings(loaded)
      applyTheme(loaded.theme)
    } catch {
      applyTheme(DEFAULT_SETTINGS.theme)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setTheme = useCallback(
    async (theme: Theme) => {
      setSettings((current) => ({ ...current, theme }))
      applyTheme(theme)
      try {
        await window.api.settings.set({ theme })
      } catch {
        // 保留本地视觉状态，下一轮启动再校正
      }
    },
    []
  )

  const setLastDoctor = useCallback(
    async (lastDoctor: string) => {
      setSettings((current) => ({ ...current, lastDoctor }))
      try {
        await window.api.settings.set({ lastDoctor })
      } catch {
        // ignore
      }
    },
    []
  )

  const setSignatureImage = useCallback(async (signatureImage: string) => {
    setSettings((current) => ({ ...current, signatureImage }))
    await window.api.settings.set({ signatureImage })
  }, [])

  const setSignatureLayout = useCallback(
    async (layout: { x: number; y: number; width: number }) => {
      setSettings((current) => ({
        ...current,
        signatureX: layout.x,
        signatureY: layout.y,
        signatureWidth: layout.width
      }))
      await window.api.settings.set({
        signatureX: layout.x,
        signatureY: layout.y,
        signatureWidth: layout.width
      })
    },
    []
  )

  const setViewMode = useCallback(
    async (module: 'prescriptions' | 'pharmacy', mode: ViewMode) => {
      setSettings((current) => ({
        ...current,
        viewModes: { ...current.viewModes, [module]: mode }
      }))
      try {
        await window.api.settings.set({
          viewModes: {
            ...settings.viewModes,
            [module]: mode
          }
        })
      } catch {
        // ignore
      }
    },
    [settings.viewModes]
  )

  const value = useMemo(
    () => ({
      settings,
      loading,
      setTheme,
      setLastDoctor,
      setSignatureImage,
      setSignatureLayout,
      setViewMode,
      refresh
    }),
    [settings, loading, setTheme, setLastDoctor, setSignatureImage, setSignatureLayout, setViewMode, refresh]
  )

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext)
  if (!value) throw new Error('useSettings 必须在 SettingsProvider 内使用')
  return value
}
