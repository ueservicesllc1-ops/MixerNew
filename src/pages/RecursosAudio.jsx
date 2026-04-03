import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Headphones, Music, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import Footer from '../components/Footer';

export default function RecursosAudio() {
    const navigate = useNavigate();

    const sections = [
        {
            title: "Concepto de Salida Separada",
            desc: "Para que tu equipo de alabanza escuche el click y la guía sin que el público los oiga, necesitas usar el paneo (Panning) hard-coded.",
            icon: <Zap size={24} color="#00d2d3" />,
            steps: [
                "Zion Stage rutea el Click y la Guía naturalmente agrupados.",
                "Usamos el Paneo Estéreo para separar las señales.",
                "Canal IZQUIERDO (L): Para el monitoreo (Click + Guía + Secuencias si se desea).",
                "Canal DERECHO (R): Para el Sistema de Sonido (P.A. / Público)."
            ]
        },
        {
            title: "Configuración en el Mixer",
            desc: "Sigue estos pasos dentro de la pantalla Multitrack para activar la separación:",
            icon: <Music size={24} color="#9b59b6" />,
            steps: [
                "Ve a la pantalla de Multitrack.",
                "En cada pista de 'Click' y 'Guía', mueve el control de Paneo totalmente hacia la IZQUIERDA.",
                "En las pistas de instrumentos (Drums, Bass, Gtr, etc), mueve el control de Paneo totalmente hacia la DERECHA.",
                "Si tu interfaz es Mono, simplemente deja todo al centro, pero no tendrás separación."
            ]
        },
        {
            title: "Hardware Necesario",
            desc: "Para implementar esto físicamente en tu iglesia necesitas:",
            icon: <Headphones size={24} color="#f1c40f" />,
            steps: [
                "Un cable 'Y' (1 Plug 3.5mm a 2 Plugs 6.3mm) o una Interfaz de Audio USB.",
                "El cable L (Izquierdo) va hacia los In-Ears o monitores del equipo.",
                "El cable R (Derecho) va hacia una Caja Directa (D.I.) conectada a la consola principal."
            ]
        }
    ];

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            {/* Header */}
            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px', position: 'sticky', top: 0, zIndex: 100 }}>
                <button onClick={() => navigate('/recursos')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver a Recursos
                </button>
            </nav>

            <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 20px' }}>
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', background: 'rgba(241,196,15,0.1)', border: '1px solid rgba(241,196,15,0.2)', borderRadius: '30px', padding: '8px 18px', marginBottom: '24px' }}>
                        <Info size={16} color="#f1c40f" />
                        <span style={{ color: '#f1c40f', fontWeight: '700', fontSize: '0.85rem', textTransform: 'uppercase' }}>Guía de Configuración</span>
                    </div>
                    <h1 style={{ fontSize: '3rem', fontWeight: '900', marginBottom: '20px' }}>Configuración de <span style={{ color: '#00d2d3' }}>Audio Separado</span></h1>
                    <p style={{ color: '#94a3b8', fontSize: '1.2rem', lineHeight: '1.6' }}>
                        Aprende a separar el Click/Guía del audio principal para una ejecución profesional.
                    </p>
                </div>

                <div style={{ display: 'grid', gap: '30px', marginBottom: '80px' }}>
                    {sections.map((sec, i) => (
                        <div key={i} style={{ background: '#1e293b', borderRadius: '24px', padding: '40px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '12px' }}>{sec.icon}</div>
                                <h2 style={{ fontSize: '1.5rem', fontWeight: '800' }}>{sec.title}</h2>
                            </div>
                            <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '1.1rem' }}>{sec.desc}</p>
                            <div style={{ display: 'grid', gap: '12px' }}>
                                {sec.steps.map((step, si) => (
                                    <div key={si} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', color: '#cbd5e1', fontSize: '1rem', background: 'rgba(0,0,0,0.2)', padding: '12px 20px', borderRadius: '12px' }}>
                                        <CheckCircle2 size={18} color="#00d2d3" style={{ marginTop: '2px', flexShrink: 0 }} />
                                        <span>{step}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Important Alert */}
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '24px', padding: '30px', display: 'flex', gap: '20px', alignItems: 'center', marginBottom: '100px' }}>
                    <AlertCircle size={32} color="#ef4444" />
                    <div>
                        <h4 style={{ color: '#ef4444', fontWeight: '800', marginBottom: '4px' }}>¡Atención con el Paneo!</h4>
                        <p style={{ color: '#94a3b8', fontSize: '0.95rem' }}>Si no paneas correctamente, el público escuchará el click. Asegúrate de probar siempre antes de empezar el servicio.</p>
                    </div>
                </div>
            </div>

            <Footer />
        </div>
    );
}
