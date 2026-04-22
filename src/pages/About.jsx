import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Layers, Users, Heart, Globe, Music2, Zap } from 'lucide-react';
import Footer from '../components/Footer';
import PageNavBar from '../components/PageNavBar';

export default function About() {
    const navigate = useNavigate();
    const { t } = useTranslation();

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <PageNavBar Icon={Users} title={t('pages.about')} />

            {/* Hero */}
            <div style={{ background: 'radial-gradient(circle at 60% 40%, rgba(0,210,211,0.12), transparent), radial-gradient(circle at 20% 80%, rgba(155,89,182,0.1), transparent)', padding: '90px 40px 80px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(0,210,211,0.08)', border: '1px solid rgba(0,210,211,0.2)', borderRadius: '30px', padding: '8px 18px', marginBottom: '24px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#00d2d3', borderRadius: '50%' }} />
                    <span style={{ color: '#00d2d3', fontWeight: '700', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>{t('about.badge')}</span>
                </div>
                <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: '900', margin: '0 0 18px', lineHeight: '1.15', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
                    {t('about.heroTitle')}
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '640px', margin: '0 auto', lineHeight: '1.7' }}>
                    {t('about.heroSub')}
                </p>
            </div>

            {/* Story */}
            <div style={{ maxWidth: '880px', margin: '0 auto', padding: '70px 40px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>

                    {/* Card 1 */}
                    <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', paddingBottom: '50px', position: 'relative' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: '52px', height: '52px', background: 'rgba(0,210,211,0.1)', border: '2px solid #00d2d3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d2d3' }}>
                                <Heart size={22} />
                            </div>
                            <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: '12px', minHeight: '60px' }} />
                        </div>
                        <div style={{ paddingTop: '10px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#00d2d3', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('about.origins')}</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '14px' }}>{t('about.h1')}</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.8' }}>
                                {t('about.p1')} <em style={{ color: '#e2e8f0' }}>{t('about.p1Em')}</em>
                            </p>
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', paddingBottom: '50px', position: 'relative' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: '52px', height: '52px', background: 'rgba(155,89,182,0.1)', border: '2px solid #9b59b6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9b59b6' }}>
                                <Layers size={22} />
                            </div>
                            <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: '12px', minHeight: '60px' }} />
                        </div>
                        <div style={{ paddingTop: '10px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#9b59b6', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('about.birth')}</div>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '10px' }}>{t('about.h2')}</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>
                                {t('about.p2')} <em style={{ color: '#e2e8f0' }}>{t('about.p2Em')}</em>
                            </p>
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start', paddingBottom: '50px', position: 'relative' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: '52px', height: '52px', background: 'rgba(241,196,15,0.1)', border: '2px solid #f1c40f', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f1c40f' }}>
                                <Music2 size={22} />
                            </div>
                            <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: '12px', minHeight: '60px' }} />
                        </div>
                        <div style={{ paddingTop: '10px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#f1c40f', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('about.years')}</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '14px' }}>{t('about.h3')}</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>
                                {t('about.p3')}
                            </p>
                        </div>
                    </div>

                    {/* Card 4 */}
                    <div style={{ display: 'flex', gap: '32px', alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                            <div style={{ width: '52px', height: '52px', background: 'rgba(0,210,211,0.15)', border: '2px solid #00d2d3', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d2d3', boxShadow: '0 0 20px rgba(0,210,211,0.3)' }}>
                                <Zap size={22} />
                            </div>
                        </div>
                        <div style={{ paddingTop: '10px' }}>
                            <div style={{ fontSize: '0.8rem', color: '#00d2d3', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{t('about.launch')}</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '14px' }}>{t('about.h4')}</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>
                                {t('about.p4')}
                            </p>
                            <p style={{ color: '#64748b', lineHeight: '1.8', marginTop: '12px' }}>
                                {t('about.p5')}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Values */}
                <div style={{ marginTop: '80px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '900', textAlign: 'center', marginBottom: '36px' }}>{t('about.valuesTitle')}</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                        {[
                            { icon: <Heart size={28} color="#f1c40f" />, title: t('about.v1t'), text: t('about.v1d') },
                            { icon: <Zap size={28} color="#00d2d3" />, title: t('about.v2t'), text: t('about.v2d') },
                            { icon: <Users size={28} color="#9b59b6" />, title: t('about.v3t'), text: t('about.v3d') },
                            { icon: <Globe size={28} color="#10b981" />, title: t('about.v4t'), text: t('about.v4d') },
                        ].map((v, i) => (
                            <div key={i} style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', padding: '30px', transition: 'transform 0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                                <div style={{ marginBottom: '16px' }}>{v.icon}</div>
                                <div style={{ fontWeight: '800', fontSize: '0.95rem', marginBottom: '8px' }}>{v.title}</div>
                                <div style={{ color: '#64748b', fontSize: '0.82rem', lineHeight: '1.7' }}>{v.text}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* CTA */}
                <div style={{ marginTop: '80px', textAlign: 'center', padding: '60px 40px', background: 'radial-gradient(circle, rgba(0,210,211,0.08), transparent)', border: '1px solid rgba(0,210,211,0.15)', borderRadius: '20px' }}>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '900', marginBottom: '12px' }}>{t('about.ctaTitle')}</h2>
                    <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '0.9rem' }}>{t('about.ctaSub')}</p>
                    <button onClick={() => navigate('/')} style={{ background: '#00d2d3', border: 'none', color: '#0f172a', padding: '16px 48px', borderRadius: '12px', fontWeight: '800', fontSize: '1.05rem', cursor: 'pointer', fontFamily: '"Outfit", sans-serif', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.85} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                        {t('about.ctaBtn')}
                    </button>
                </div>
            </div>
            <Footer />
        </div>
    );
}
