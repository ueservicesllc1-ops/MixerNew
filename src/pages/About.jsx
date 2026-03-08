import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Layers, Users, Heart, Globe, Music2, Zap } from 'lucide-react';
import Footer from '../components/Footer';

export default function About() {
    const navigate = useNavigate();

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver al inicio
                </button>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                    <Users size={16} /> Nosotros
                </div>
            </nav>

            {/* Hero */}
            <div style={{ background: 'radial-gradient(circle at 60% 40%, rgba(0,210,211,0.12), transparent), radial-gradient(circle at 20% 80%, rgba(155,89,182,0.1), transparent)', padding: '90px 40px 80px', textAlign: 'center' }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(0,210,211,0.08)', border: '1px solid rgba(0,210,211,0.2)', borderRadius: '30px', padding: '8px 18px', marginBottom: '24px' }}>
                    <div style={{ width: '10px', height: '10px', background: '#00d2d3', borderRadius: '50%' }} />
                    <span style={{ color: '#00d2d3', fontWeight: '700', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Nuestra historia</span>
                </div>
                <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)', fontWeight: '900', margin: '0 0 18px', lineHeight: '1.15', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
                    Freedom Labs — Tecnología al servicio de la adoración
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', maxWidth: '640px', margin: '0 auto', lineHeight: '1.7' }}>
                    Somos un equipo apasionado que ama tanto la tecnología como la adoración. Llevamos años construyendo herramientas para los que sirven cada domingo detrás del escenario.
                </p>
            </div>

            {/* Story */}
            <div style={{ maxWidth: '880px', margin: '0 auto', padding: '70px 40px' }}>
                {/* Timeline */}
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
                            <div style={{ fontSize: '0.8rem', color: '#00d2d3', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Los orígenes</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '14px' }}>Empezó con una frustración del domingo</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.8' }}>
                                Todo comenzó en una iglesia pequeña en New Jersey. El director de alabanza, cansado de llevar laptops llenas de pistas en desorden, discos duros que fallaban en el peor momento y apps que no funcionaban sin internet, tuvo una idea simple: <em style={{ color: '#e2e8f0' }}>"¿Por qué no existe una solución profesional específicamente para líderes de adoración?"</em>
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
                            <div style={{ fontSize: '0.8rem', color: '#9b59b6', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>El nacimiento de Freedom Labs</div>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '10px' }}>De músicos a developers</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>
                                Freedom Labs nació de la unión entre músicos y desarrolladores de software con más de una década de experiencia combinada. Comenzamos como una consultoría de tecnología para organizaciones sin fines de lucro y ministerios. Con el tiempo, nuestros clientes —iglesias, grupos de alabanza, bandas de adoración— tenían siempre el mismo pedido: <em style={{ color: '#e2e8f0' }}>una app para manejar sus pistas en vivo, desde cualquier lugar, con calidad profesional.</em>
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
                            <div style={{ fontSize: '0.8rem', color: '#f1c40f', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Los años de desarrollo</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '14px' }}>Años de trabajo silencioso</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>
                                Durante años investigamos, prototipamos y probamos junto a líderes de alabanza reales lo que sería el corazón de nuestra plataforma: un motor de audio nativo capaz de mezclar múltiples pistas en tiempo real, sincronizado con iOS y Android, con gestión en la nube integrada. Cada línea de código fue escrita pensando en ese momento del domingo por la mañana donde todo debe funcionar perfectamente.
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
                            <div style={{ fontSize: '0.8rem', color: '#00d2d3', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>2026 — El lanzamiento</div>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '14px' }}>Nace Zion Stage</h2>
                            <p style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>
                                En 2026, Freedom Labs lanza oficialmente <strong style={{ color: '#00d2d3' }}>Zion Stage</strong>: la plataforma todo-en-uno para líderes de alabanza. Con gestión de pistas multitrack en la nube, un potente reproductor de audio nativo para iOS y Android, mixer en tiempo real, setlists inteligentes, letras y cifrados integrados, y ahora un Marketplace para que los propios músicos vendan sus creaciones originales directamente a la comunidad.
                            </p>
                            <p style={{ color: '#64748b', lineHeight: '1.8', marginTop: '12px' }}>
                                Este no es el final. Es el principio de algo que creemos puede cambiar para siempre la forma en que los equipos de adoración se preparan para servir.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Values */}
                <div style={{ marginTop: '80px' }}>
                    <h2 style={{ fontSize: '1.2rem', fontWeight: '900', textAlign: 'center', marginBottom: '36px' }}>Lo que nos mueve</h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                        {[
                            { icon: <Heart size={28} color="#f1c40f" />, title: 'Fe y Propósito', text: 'Creemos que la tecnología puede ser un acto de servicio. Construimos con propósito, no solo con datos.' },
                            { icon: <Zap size={28} color="#00d2d3" />, title: 'Excelencia Técnica', text: 'No hacemos las cosas a medias. Cada detalle del motor de audio, cada milisegundo de latencia, importa.' },
                            { icon: <Users size={28} color="#9b59b6" />, title: 'Comunidad', text: 'Construimos para la comunidad. El Marketplace y las funciones VIP nacieron directamente del feedback de músicos reales.' },
                            { icon: <Globe size={28} color="#10b981" />, title: 'Impacto Global', text: 'Iglesias desde New Jersey hasta México, Colombia, España. El sonido de la adoración no tiene fronteras.' },
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
                    <h2 style={{ fontSize: '1.3rem', fontWeight: '900', marginBottom: '12px' }}>Únete a la comunidad</h2>
                    <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '0.9rem' }}>Empieza gratis hoy mismo. Sin tarjeta de crédito, sin trucos.</p>
                    <button onClick={() => navigate('/')} style={{ background: '#00d2d3', border: 'none', color: '#0f172a', padding: '16px 48px', borderRadius: '12px', fontWeight: '800', fontSize: '1.05rem', cursor: 'pointer', fontFamily: '"Outfit", sans-serif', transition: 'opacity 0.2s' }} onMouseEnter={e => e.currentTarget.style.opacity = 0.85} onMouseLeave={e => e.currentTarget.style.opacity = 1}>
                        Comienza gratis →
                    </button>
                </div>
            </div>
            <Footer />
        </div>
    );
}
