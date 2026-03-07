import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cpu, Smartphone, Activity, Cloud, MonitorPlay, Settings2 } from 'lucide-react';

export default function Software() {
    const navigate = useNavigate();

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver al inicio
                </button>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                    <Cpu size={16} /> Software & Tecnología
                </div>
            </nav>

            {/* Hero */}
            <div style={{ background: 'radial-gradient(circle at 50% -20%, rgba(0,210,211,0.15), transparent 70%)', padding: '100px 40px 60px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(0,210,211,0.1)', border: '1px solid rgba(0,210,211,0.3)', borderRadius: '20px', padding: '6px 16px', marginBottom: '24px' }}>
                    <Activity size={16} color="#00d2d3" />
                    <span style={{ color: '#00d2d3', fontWeight: '800', fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Zion Stage Engine v2.0</span>
                </div>
                <h1 style={{ fontSize: 'clamp(2.2rem, 4vw, 3.5rem)', fontWeight: '900', margin: '0 0 24px', lineHeight: '1.1' }}>
                    El motor de audio más avanzado<br />creado para adoración.
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '1.1rem', maxWidth: '650px', margin: '0 auto', lineHeight: '1.7' }}>
                    No solo reproducimos mp3s. Hemos diseñado desde cero una arquitectura de audio en tiempo real capaz de cargar, procesar y mezclar múltiples pistas sin fallos ni latencia.
                </p>
            </div>

            {/* Features Grid */}
            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 40px 100px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                    {[
                        { icon: <MonitorPlay size={32} color="#f1c40f" />, bg: 'rgba(241,196,15,0.05)', color: '#f1c40f', title: 'Desempeño Nativo', text: 'Zion Stage está optimizado para funcionar directamente en tu dispositivo con máxima eficiencia. Nuestra arquitectura garantiza que cada click y pista fluyan en perfecta sincronía, sin importar qué equipo utilices.' },
                        { icon: <Cloud size={32} color="#00d2d3" />, bg: 'rgba(0,210,211,0.05)', color: '#00d2d3', title: 'Funcionamiento Offline', text: 'Tus archivos se mantienen de forma segura y eficiente en la memoria de tu dispositivo. Si la conexión a internet de la iglesia falla repentinamente en medio del servicio, Zion Stage seguirá reproduciendo como si nada hubiera pasado.' },
                        { icon: <Settings2 size={32} color="#9b59b6" />, bg: 'rgba(155,89,182,0.05)', color: '#9b59b6', title: 'Mezcla en Tiempo Real', text: 'Controla el volumen de cada instrumento de manera individual. Aplicamos algoritmos avanzados de procesamiento ultra-ligero para asegurar que tus mezclas en vivo no generen ruidos ni cortes.' },
                        { icon: <Smartphone size={32} color="#10b981" />, bg: 'rgba(16,185,129,0.05)', color: '#10b981', title: 'Consumo Inteligente de Batería', text: 'Pocas cosas asustan más que ver un 10% de batería en el escenario. Nuestra tecnología central minimiza drásticamente los recursos del procesador, alargando la batería de tu iPad o Tablet por horas.' }
                    ].map((feat, i) => (
                        <div key={i} style={{ background: '#1e293b', padding: '40px 30px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ width: '64px', height: '64px', background: feat.bg, borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
                                {feat.icon}
                            </div>
                            <h3 style={{ fontSize: '1.3rem', fontWeight: '800', marginBottom: '14px' }}>{feat.title}</h3>
                            <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '0.95rem' }}>{feat.text}</p>
                        </div>
                    ))}
                </div>

                <div style={{ marginTop: '80px', padding: '50px', background: '#020617', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.05)', display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '40px', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '0.8rem', color: '#00d2d3', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Tu biblioteca segura</div>
                        <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '16px', lineHeight: '1.1' }}>Almacenamiento Seguro en la Nube</h2>
                        <p style={{ color: '#94a3b8', lineHeight: '1.7', fontSize: '1rem', marginBottom: '24px' }}>
                            Manejar gigabytes de audio de alta fidelidad no es un juego. Cada vez que subes un archivo a tu nube privada en Zion Stage, este se cifra y se replica automáticamente en centros de datos de nivel empresarial, dándote absoluta tranquilidad para el domingo y disponibilidad del 99.9%.
                        </p>
                        <button onClick={() => navigate('/')} style={{ background: 'transparent', border: '1px solid #00d2d3', color: '#00d2d3', padding: '12px 24px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', transition: 'all 0.2s', fontFamily: '"Outfit"' }} onMouseEnter={e => { e.currentTarget.style.background = '#00d2d3'; e.currentTarget.style.color = '#020617'; }} onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#00d2d3'; }}>Únete gratis</button>
                    </div>
                    <div style={{ background: '#0f172a', padding: '30px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', color: '#64748b', fontSize: '0.8rem', fontWeight: '700' }}>
                            <span>STATUS</span>
                            <span style={{ color: '#10b981' }}>OPERACIONAL</span>
                        </div>
                        <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', marginBottom: '24px' }}>
                            <div style={{ width: '100%', height: '100%', background: '#10b981' }} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Latencia Core</div>
                                <div style={{ fontWeight: '800', fontSize: '1.5rem', color: '#f1c40f' }}>{'< 12ms'}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '4px' }}>Uptime</div>
                                <div style={{ fontWeight: '800', fontSize: '1.5rem', color: '#10b981' }}>99.99%</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
