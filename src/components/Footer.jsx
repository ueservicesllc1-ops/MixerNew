import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Facebook, Instagram, Youtube, Twitter, Globe, Info, Mail, ShieldCheck, FileText, Zap, ExternalLink, Users, Music } from 'lucide-react';

export default function Footer() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <footer style={{ backgroundColor: '#020617', padding: '80px 40px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', color: '#94a3b8', fontFamily: '"Outfit", sans-serif' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '48px', marginBottom: '60px' }}>

                    {/* Brand Column */}
                    <div style={{ gridColumn: 'span 2' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '36px' }} />
                        </div>
                        <p style={{ fontSize: '0.9rem', lineHeight: '1.6', maxWidth: '300px', marginBottom: '24px' }}>
                            {t('footer.tagline')}
                        </p>
                        <div style={{ display: 'flex', gap: '16px' }}>
                            {[
                                { icon: <Instagram size={20} />, url: '#' },
                                { icon: <Facebook size={20} />, url: '#' },
                                { icon: <Youtube size={20} />, url: '#' }
                            ].map((soc, i) => (
                                <a key={i} href={soc.url} style={{ color: '#64748b', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#00d2d3'} onMouseLeave={e => e.currentTarget.style.color = '#64748b'}>
                                    {soc.icon}
                                </a>
                            ))}
                        </div>
                    </div>

                    {/* Resources */}
                    <div>
                        <h4 style={{ color: 'white', fontWeight: '800', fontSize: '1rem', marginBottom: '24px', letterSpacing: '0.5px' }}>{t('footer.resources')}</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                            <li onClick={() => navigate('/recursos')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>{t('footer.videoTutorials')}</li>
                            <li onClick={() => navigate('/recursos')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>{t('footer.documentation')}</li>
                            <li onClick={() => navigate('/recursos')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>{t('footer.systemStatus')}</li>
                            <li onClick={() => navigate('/store')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>{t('footer.marketplace')}</li>
                        </ul>
                    </div>

                    {/* Company */}
                    <div>
                        <h4 style={{ color: 'white', fontWeight: '800', fontSize: '1rem', marginBottom: '24px', letterSpacing: '0.5px' }}>{t('footer.company')}</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                            <li onClick={() => navigate('/about')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>{t('footer.aboutUs')}</li>
                            <li onClick={() => navigate('/contact')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>{t('footer.contact')}</li>
                            <li onClick={() => navigate('/privacy')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>{t('footer.privacy')}</li>
                            <li onClick={() => navigate('/terms')} style={{ cursor: 'pointer', transition: 'color 0.2s' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>{t('footer.terms')}</li>
                        </ul>
                    </div>

                    {/* Support / Training instead of Partners */}
                    <div>
                        <h4 style={{ color: 'white', fontWeight: '800', fontSize: '1rem', marginBottom: '24px', letterSpacing: '0.5px' }}>{t('footer.training')}</h4>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
                            <li onClick={() => navigate('/recursos')} style={{ cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                                <Users size={14} /> {t('footer.guidesLeaders')}
                            </li>
                            <li onClick={() => navigate('/recursos')} style={{ cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                                <Zap size={14} /> {t('footer.setupTech')}
                            </li>
                            <li onClick={() => navigate('/recursos')} style={{ cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                                <Music size={14} /> {t('footer.theoryMusic')}
                            </li>
                            <li onClick={() => navigate('/contact')} style={{ cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '8px' }} onMouseEnter={e => e.target.style.color = 'white'} onMouseLeave={e => e.target.style.color = '#94a3b8'}>
                                <ExternalLink size={14} /> {t('footer.support1on1')}
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                    <div style={{ fontSize: '0.85rem' }}>
                        © {new Date().getFullYear()} <a href="https://freedomlabs.dev" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', fontWeight: '700', transition: 'color 0.2s' }} onMouseEnter={e => e.currentTarget.style.color = '#00d2d3'} onMouseLeave={e => e.currentTarget.style.color = 'inherit'}>Freedom Labs LLC</a> · Zion Stage. {t('footer.rights')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', backgroundColor: 'rgba(0,210,211,0.05)', padding: '6px 12px', borderRadius: '100px', border: '1px solid rgba(0,210,211,0.1)' }}>
                        <Zap size={14} color="#00d2d3" />
                        <span style={{ color: '#00d2d3', fontWeight: '700' }}>{t('footer.platformVersion')}</span>
                    </div>
                </div>
            </div>
        </footer>
    );
}
