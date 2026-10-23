import { useState } from 'react'
import { Check, Palette } from 'lucide-react'
import type { Theme } from '@shared/types/models'
import { useSettings } from '../context/SettingsProvider'

const OPTIONS: { value: Theme; label: string; swatch: string }[] = [
  { value: 'light', label: '白天模式', swatch: '#f2f5f5' },
  { value: 'dark', label: '夜间模式', swatch: '#181f23' },
  { value: 'reading', label: '阅读模式', swatch: '#efe8d8' }
]

export function ThemeMenu(): React.JSX.Element {
  const { settings, setTheme } = useSettings()
  const [open, setOpen] = useState(false)
  const current = OPTIONS.find((option) => option.value === settings.theme) ?? OPTIONS[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="theme-button"
        data-testid="theme-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Palette size={16} />
        {current.label}
      </button>
      {open ? (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 20 }} onClick={() => setOpen(false)} />
          <div className="menu" role="menu">
            <div className="menu-title">外观</div>
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={settings.theme === option.value}
                className={`menu-item ${settings.theme === option.value ? 'active' : ''}`.trim()}
                data-testid={`theme-${option.value}`}
                onClick={() => {
                  void setTheme(option.value)
                  setOpen(false)
                }}
              >
                <span className="swatch" style={{ background: option.swatch }} />
                <span>{option.label}</span>
                {settings.theme === option.value ? <Check size={14} style={{ marginLeft: 'auto' }} /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
