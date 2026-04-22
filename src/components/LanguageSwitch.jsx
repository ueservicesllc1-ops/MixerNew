import { useTranslation } from 'react-i18next'

export default function LanguageSwitch({ compact = false, light = false }) {
  const { i18n } = useTranslation()
  const lng = i18n.language?.startsWith('en') ? 'en' : 'es'

  const set = (code) => {
    if (code !== lng) i18n.changeLanguage(code)
  }

  const pill = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: '999px',
    border: light ? '1px solid #e2e8f0' : '1px solid rgba(148, 163, 184, 0.35)',
    background: light ? '#f8fafc' : 'rgba(15, 23, 42, 0.65)',
    padding: compact ? '3px' : '4px',
    gap: '2px',
  }
  const btn = (active) => ({
    border: 'none',
    borderRadius: '999px',
    padding: compact ? '5px 10px' : '6px 14px',
    fontSize: compact ? '0.7rem' : '0.78rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'background 0.2s, color 0.2s',
    background: active ? '#00d2d3' : 'transparent',
    color: active ? '#0f172a' : (light ? '#64748b' : '#94a3b8'),
  })

  return (
    <div style={pill} role="group" aria-label="Language">
      <button type="button" style={btn(lng === 'es')} onClick={() => set('es')}>
        ES
      </button>
      <button type="button" style={btn(lng === 'en')} onClick={() => set('en')}>
        EN
      </button>
    </div>
  )
}
