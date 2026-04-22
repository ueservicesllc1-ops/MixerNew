import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import LanguageSwitch from './LanguageSwitch'

const defaultNavStyle = {
  padding: '20px 40px',
  background: '#020617',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '16px',
  flexWrap: 'wrap',
}

export default function PageNavBar({
  Icon,
  title,
  navStyle = defaultNavStyle,
  sticky = false,
  zIndex = 100,
  backPath = '/',
  backLabel,
  rightSlot = null,
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const style = {
    ...navStyle,
    ...(sticky ? { position: 'sticky', top: 0, zIndex } : {}),
  }

  return (
    <nav style={style}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => navigate(backPath)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 700,
            fontFamily: '"Outfit", sans-serif',
          }}
        >
          <ArrowLeft size={20} /> {backLabel ?? t('nav.backHome')}
        </button>
        <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
        {Icon && title != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
            <Icon size={16} /> {title}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {rightSlot}
        <LanguageSwitch />
      </div>
    </nav>
  )
}
