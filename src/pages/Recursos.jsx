import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    BookOpen,
    Music,
    FileText,
    Search,
    PlayCircle,
    Users,
    Heart,
    Zap,
    Globe,
    Mic2,
    Layout,
    ShieldCheck,
    MessageSquare,
    Download,
    Video
} from 'lucide-react';
import Footer from '../components/Footer';

export default function Recursos() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('all');

    const resourceCategories = [
        { id: 'all', label: 'Todo', icon: <Globe size={18} /> },
        { id: 'leads', label: 'Líderes', icon: <Users size={18} /> },
        { id: 'tech', label: 'Técnico', icon: <Zap size={18} /> },
        { id: 'music', label: 'Música', icon: <Music size={18} /> },
    ];

    const resources = [
        {
            category: 'music',
            title: 'Base de Letras y Acordes',
            desc: 'Accede a miles de cifrados precisos preparados para Zion Stage.',
            icon: <FileText size={40} color="#00d2d3" />,
            status: 'Disponible'
        },
        {
            category: 'leads',
            title: 'Guía para Directores',
            desc: 'Consejos prácticos para dirigir con secuencias y multitracks.',
            icon: <Users size={40} color="#9b59b6" />,
            status: 'NUEVO'
        },
        {
            category: 'tech',
            title: 'Configuración de Audio',
            desc: 'Cómo configurar tu interfaz para mandar monitoreo y click separado.',
            icon: <Zap size={40} color="#f1c40f" />,
            status: 'Popular'
        },
        {
            category: 'music',
            title: 'Video Tutoriales',
            desc: 'Aprende a usar todas las funciones del mixer nativo de Zion Stage.',
            icon: <Video size={40} color="#ff4757" />,
            status: 'Video'
        }
    ];

    const filteredResources = activeTab === 'all'
        ? resources
        : resources.filter(r => r.category === activeTab);

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            {/* Header / Nav */}
            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px', position: 'sticky', top: 0, zIndex: 100 }}>
                <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver al inicio
                </button>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                    <BookOpen size={16} /> Recursos para Iglesias
                </div>
            </nav>

            {/* Hero Section */}
            <div style={{
                background: 'radial-gradient(circle at 70% 30%, rgba(0,210,211,0.1), transparent), radial-gradient(circle at 20% 70%, rgba(155,89,182,0.1), transparent), #020617',
                padding: '100px 40px',
                textAlign: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.05)'
            }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(0,210,211,0.08)', border: '1px solid rgba(0,210,211,0.2)', borderRadius: '30px', padding: '8px 18px', marginBottom: '24px' }}>
                    <Zap size={16} color="#00d2d3" />
                    <span style={{ color: '#00d2d3', fontWeight: '700', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Centro de Capacitación</span>
                </div>
                <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: '900', marginBottom: '24px', lineHeight: '1', maxWidth: '1000px', margin: '0 auto 24px' }}>
                    Equipando a tu <span style={{ color: '#00d2d3' }}>Equipo de Alabanza</span>.
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto', lineHeight: '1.6' }}>
                    Descarga guías, accede a tutoriales y encuentra todo lo necesario para que tu ministerio suene con excelencia cada domingo.
                </p>
            </div>

            {/* Filter Tabs */}
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '60px', flexWrap: 'wrap' }}>
                    {resourceCategories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setActiveTab(cat.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 24px',
                                borderRadius: '100px',
                                border: '1px solid',
                                borderColor: activeTab === cat.id ? '#00d2d3' : 'rgba(255,255,255,0.1)',
                                backgroundColor: activeTab === cat.id ? 'rgba(0,210,211,0.1)' : 'transparent',
                                color: activeTab === cat.id ? '#00d2d3' : '#64748b',
                                cursor: 'pointer',
                                fontWeight: '700',
                                transition: 'all 0.2s',
                                fontFamily: '"Outfit", sans-serif'
                            }}
                        >
                            {cat.icon} {cat.label}
                        </button>
                    ))}
                </div>

                {/* Grid de Recursos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '30px', marginBottom: '100px' }}>
                    {filteredResources.map((res, i) => (
                        <div key={i} style={{
                            background: '#1e293b',
                            border: '1px solid rgba(255,255,255,0.05)',
                            borderRadius: '24px',
                            padding: '40px',
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            cursor: 'pointer',
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                            onClick={() => {
                                if (res.category === 'music' && res.title.includes('Letras')) navigate('/library');
                                if (res.category === 'tech' && res.title.includes('Audio')) navigate('/recursos/audio');
                            }}
                            onMouseEnter={e => {
                                e.currentTarget.style.transform = 'translateY(-8px)';
                                e.currentTarget.style.borderColor = 'rgba(0,210,211,0.3)';
                            }}
                            onMouseLeave={e => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                            }}
                        >
                            <div style={{ position: 'absolute', top: '24px', right: '24px', fontSize: '0.7rem', fontWeight: '800', background: 'rgba(0,0,0,0.3)', padding: '4px 10px', borderRadius: '100px', letterSpacing: '1px', color: '#64748b' }}>
                                {res.status}
                            </div>
                            <div style={{ marginBottom: '24px' }}>{res.icon}</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: '900', marginBottom: '16px', color: 'white' }}>{res.title}</h3>
                            <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '0.95rem', marginBottom: '24px' }}>{res.desc}</p>
                            <div style={{ color: '#00d2d3', fontWeight: '800', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                Explorar recurso <ArrowRight size={16} />
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA Section */}
                <div style={{
                    background: 'linear-gradient(135deg, #00d2d3 0%, #0097a7 100%)',
                    borderRadius: '32px',
                    padding: '80px 40px',
                    textAlign: 'center',
                    marginBottom: '100px',
                    boxShadow: '0 20px 40px rgba(0, 210, 211, 0.2)'
                }}>
                    <h2 style={{ color: '#020617', fontSize: '2.5rem', fontWeight: '900', marginBottom: '20px' }}>¿Necesitas ayuda personalizada?</h2>
                    <p style={{ color: '#020617', opacity: 0.8, fontSize: '1.1rem', maxWidth: '600px', margin: '0 auto 40px' }}>
                        Nuestro equipo está listo para ayudarte a configurar Zion Stage en tu iglesia local. Ofrecemos demos gratuitas.
                    </p>
                    <button onClick={() => navigate('/contact')} style={{
                        background: '#020617',
                        color: 'white',
                        border: 'none',
                        padding: '18px 48px',
                        borderRadius: '16px',
                        fontSize: '1.1rem',
                        fontWeight: '800',
                        cursor: 'pointer',
                        boxShadow: '0 10px 20px rgba(0,0,0,0.2)'
                    }}>
                        Hablar con un experto
                    </button>
                </div>
            </div>

            <Footer />
        </div>
    );
}

function ArrowRight({ size }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
            <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
    );
}
