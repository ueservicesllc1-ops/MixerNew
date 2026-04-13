import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen } from 'lucide-react';
import Footer from '../components/Footer';

export default function Manual() {
    const navigate = useNavigate();

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const sections = [
        {
            title: "🧭 ¿QUÉ ES ZION STAGE?",
            content: (
                <>
                    <p><strong>Zion Stage</strong> es la plataforma todo-en-uno para <strong>líderes de alabanza y equipos de adoración</strong>. Permite reproducir, mezclar y gestionar pistas multitrack (secuencias) de forma profesional desde cualquier dispositivo — Android, Windows o navegador web — con tecnología de audio nativa de alto rendimiento.</p>
                    <p>Fue creada por <strong>Freedom Labs LLC</strong>, una empresa fundada por músicos y desarrolladores con más de una década de experiencia sirviendo a iglesias y ministerios.</p>
                    <blockquote style={{ borderLeft: '4px solid #00d2d3', paddingLeft: '15px', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '0 8px 8px 0' }}>
                        🎯 <strong>Misión:</strong> Simplificar el domingo. Que la tecnología nunca sea el obstáculo entre tu equipo y la adoración.
                    </blockquote>
                </>
            )
        },
        {
            title: "🛠️ CARACTERÍSTICAS PRINCIPALES",
            content: (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                        <thead>
                            <tr style={{ background: 'rgba(255,255,255,0.05)', textAlign: 'left' }}>
                                <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Función</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Qué hace</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>Cómo explicarlo en redes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['Motor de Audio Nativo', 'Procesa audio directamente en el hardware del dispositivo', '"Suena profesional, sin lag, como consola de mezcla en tu mano"'],
                                ['Pistas Multitrack (MT)', 'Reproduce múltiples pistas separadas', '"Separa cada instrumento y controla el volumen de cada uno"'],
                                ['Modo Offline', 'Funciona sin internet una vez descargadas', '"Si se cae el wifi de la iglesia, Zion Stage sigue sonando"'],
                                ['Nube Personal', 'Cada usuario sube sus propios archivos', '"Tu biblioteca en la nube, siempre contigo en cualquier dispositivo"'],
                                ['Setlists', 'Crea y gestiona listas de canciones', '"Organiza tu domingo desde el lunes, y ensaya desde el teléfono"'],
                                ['Letras y Cifrados', 'Visualiza letras y acordes mientras mezclas', '"Todo en una pantalla: pistas + letra + acordes"'],
                                ['Catálogo Global VIP', 'Biblioteca listos para usar', '"Más de 60 canciones listas para usar, hechas por músicos reales"'],
                                ['Marketplace', 'Músicos venden sus pistas originales', '"Si produces pistas, vende tus creaciones directamente a iglesias"'],
                                ['Cambio de Tempo', 'Ajusta la velocidad sin cambiar el tono', '"¿La canción va muy rápida? Bájale el tempo y mantén el tono"'],
                                ['Cambio de Tono', 'Sube o baja la tonalidad (Pitch)', '"Transpón cualquier canción en segundos"']
                            ].map((row, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#00d2d3', fontWeight: 'bold' }}>{row[0]}</td>
                                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#e2e8f0' }}>{row[1]}</td>
                                    <td style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#94a3b8', fontStyle: 'italic' }}>{row[2]}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )
        },
        {
            title: "📲 RESPUESTAS PREDEFINIDAS: QUÉ ES",
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Qué es Zion Stage?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            Zion Stage es la app todo-en-uno para equipos de adoración 🎛️ Reproduce pistas multitrack en vivo, mezcla cada instrumento por separado, maneja tus setlists en la nube y accede a una biblioteca de canciones de la comunidad. Disponible en Android y Windows. ¡Regístrate gratis! 👉 zionstage.app
                        </p>
                    </div>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Es para profesionales o cualquier iglesia?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            ¡Cualquier iglesia! 🙌 Zion Stage está diseñado tanto para el músico experto como para el líder de alabanza que está empezando. Si tu equipo usa pistas, Zion Stage es para ustedes.
                        </p>
                    </div>
                </div>
            )
        },
        {
            title: "📌 RESPUESTAS PREDEFINIDAS: PISTAS",
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Qué son las pistas multitrack?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            Las pistas multitrack (o MT) son grabaciones donde cada instrumento viene separado: batería, bajo, voz guía, click... 🎹🥁🎸 Con Zion Stage puedes controlar el volumen de cada uno por separado. Es como tener una consola de mezcla en tu tablet.
                        </p>
                    </div>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Cómo subo mis propias pistas?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            ¡Es súper sencillo! Comprime tus archivos de audio en un archivo ZIP y súbelo desde tu panel en zionstage.app 🗜️ Quedan disponibles en todos tus dispositivos en segundos.
                        </p>
                    </div>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Las pistas tienen click y guía separados?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            ¡Sí! 🎯 Zion Stage enruta el Click y la Guía vocal a un canal separado automáticamente (puedes enviarlo a un in-ear), mientras el resto del mix va a la sala.
                        </p>
                    </div>
                </div>
            )
        },
        {
            title: "💰 RESPUESTAS PREDEFINIDAS: PRECIOS",
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Es gratis?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            El registro es 100% gratis y viene con 1 GB de almacenamiento para subir tus pistas 🎉 Los planes de pago empiezan desde $4.99/mes, y el VIP da acceso a toda la biblioteca global. ¡Empieza en zionstage.app!
                        </p>
                    </div>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Cuánto cuesta el plan VIP?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            El plan Premium VIP comienza en $7.99/mes (Básico VIP). El más popular es el Estándar VIP ($9.99/mes) que incluye 5 GB + acceso total al catálogo de la comunidad. (Hay 30% descto si pagas anual) 💛
                        </p>
                    </div>
                </div>
            )
        },
        {
            title: "⚡ RESPUESTAS PREDEFINIDAS: SOPORTE / OTROS",
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Dónde descargo la app?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            Descarga el APK para Android en 👉 zionstage.app (botón verde "Descargar Android"). También puedes instalarla en Windows buscando "Instalar Windows (PWA)". ¡Sin pasar por tiendas de apps!
                        </p>
                    </div>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Tienen iOS?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            ¡Estamos trabajando en ello! 📲 Por ahora puedes usar Zion Stage en Android (APK), Windows (PWA) o navegador web.
                        </p>
                    </div>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"¿Funciona sin internet?"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            ¡Sí! 🌐❌ Una vez que tus pistas están descargadas en el dispositivo, Zion Stage funciona completamente offline.
                        </p>
                    </div>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#00d2d3' }}>"El sonido se entrecorta"</h4>
                        <p style={{ margin: 0, background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px' }}>
                            Asegúrate de: 1. Cerrar apps en segundo plano 2. Actualizar a la última versión de la app que incluye mejoras de audio. Si persiste, ¡escríbenos en zionstage.app/contact!
                        </p>
                    </div>
                </div>
            )
        },
        {
            title: "⚠️ SITUACIONES DIFÍCILES",
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#e74c3c' }}>"La app no funciona, es una estafa"</h4>
                        <p style={{ margin: 0, background: 'rgba(231,76,60,0.1)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #e74c3c' }}>
                            Entendemos tu frustración 😔 Zion Stage está respaldada por Freedom Labs LLC, una empresa real. Si tienes un problema técnico, cuéntanos exactamente qué pasa y te ayudamos personalmente. Escríbenos en DM o a zionstage.app/contact 💙
                        </p>
                    </div>
                    <div className="faq-item">
                        <h4 style={{ margin: '0 0 8px', color: '#f39c12' }}>"Esto mismo lo hace [app competidora] gratis"</h4>
                        <p style={{ margin: 0, background: 'rgba(243,156,18,0.1)', padding: '15px', borderRadius: '8px', borderLeft: '3px solid #f39c12' }}>
                            ¡Nos alegra que conozcas otras opciones! 😊 Zion Stage también tiene un plan 100% gratuito. Lo que nos diferencia es nuestro motor de audio nativo sin lag, cambio de tempo/tono en tiempo real, y soporte en español. ¡Pruébalo gratis y decides!
                        </p>
                    </div>
                </div>
            )
        }
    ];

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            {/* Nav */}
            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px', position: 'sticky', top: 0, zIndex: 50 }}>
                <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver al inicio
                </button>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                    <BookOpen size={16} /> Manual del Community Manager
                </div>
            </nav>

            <div style={{ maxWidth: '900px', margin: '0 auto', padding: '60px 40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', color: 'white', marginBottom: '16px' }}>Manual de Redes Sociales</h1>
                    <p style={{ color: '#00d2d3', fontSize: '1.1rem', fontWeight: 'bold' }}>Zion Stage • Freedom Labs LLC</p>
                    <p style={{ color: '#94a3b8', marginTop: '10px' }}>Aquí encontrarás toda la información, precios y respuestas predefinidas para atender los canales digitales oficiales de Zion Stage.</p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '50px' }}>
                    {sections.map((section, idx) => (
                        <div key={idx} style={{ background: '#1e293b', borderRadius: '16px', padding: '40px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '24px', color: 'white', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {section.title}
                            </h2>
                            <div style={{ color: '#cbd5e1', lineHeight: '1.7', fontSize: '1rem' }}>
                                {section.content}
                            </div>
                        </div>
                    ))}
                </div>
                
                <div style={{ textAlign: 'center', marginTop: '60px', padding: '30px', background: 'rgba(0,210,211,0.05)', borderRadius: '12px', border: '1px solid rgba(0,210,211,0.1)' }}>
                    <h3 style={{ color: '#00d2d3', margin: '0 0 10px', fontSize: '1.2rem' }}>🎨 Tono de Voz Sugerido</h3>
                    <p style={{ color: '#94a3b8', margin: 0 }}>Cálido, cercano, de comunidad. Siempre invita a probar gratis. Evita lenguaje técnico innecesario o corporativo. Usa emojis relacionados (🎛️ 🎹 🚀 ✨).</p>
                </div>
            </div>

            <Footer />
        </div>
    );
}
