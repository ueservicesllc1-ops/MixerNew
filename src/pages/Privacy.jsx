import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';
import Footer from '../components/Footer';

const Section = ({ title, children }) => (
    <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#00d2d3', marginBottom: '10px', borderLeft: '3px solid #00d2d3', paddingLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h2>
        <div style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>{children}</div>
    </div>
);

export default function Privacy() {
    const navigate = useNavigate();
    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            {/* Header */}
            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver al inicio
                </button>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                    <Shield size={16} /> Políticas de Privacidad
                </div>
            </nav>

            <div style={{ maxWidth: '820px', margin: '0 auto', padding: '60px 40px 100px' }}>
                <div style={{ marginBottom: '50px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: '#00d2d3', borderRadius: '50%' }} />
                        <span style={{ color: '#00d2d3', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Freedom Labs · Zion Stage</span>
                    </div>
                    <h1 style={{ fontSize: '1.9rem', fontWeight: '900', margin: '0 0 10px', lineHeight: '1.2' }}>Políticas de Privacidad</h1>
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Última actualización: 7 de marzo de 2026</p>
                </div>

                <Section title="1. Quiénes Somos">
                    <p>Zion Stage es un producto de <strong style={{ color: '#e2e8f0' }}>Freedom Labs LLC</strong>, empresa dedicada al desarrollo de tecnología para equipos de alabanza y ministerios de adoración. Nuestra plataforma permite la gestión en la nube de pistas multitrack, setlists y herramientas de audio profesional para líderes de adoración.</p>
                    <p style={{ marginTop: '12px' }}>Al utilizar Zion Stage (en adelante "la Plataforma"), usted acepta la recopilación y uso de información de conformidad con estas políticas.</p>
                </Section>

                <Section title="2. Información que Recopilamos">
                    <p><strong style={{ color: '#e2e8f0' }}>Información que usted nos proporciona:</strong></p>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Nombre y apellido al registrarse.</li>
                        <li>Dirección de correo electrónico.</li>
                        <li>Foto de perfil (opcional).</li>
                        <li>Archivos de audio y pistas multitrack que usted carga a su biblioteca personal.</li>
                        <li>Información de pago procesada de forma segura a través de PayPal (no almacenamos datos de tarjetas de crédito).</li>
                    </ul>
                    <p style={{ marginTop: '16px' }}><strong style={{ color: '#e2e8f0' }}>Información recopilada automáticamente:</strong></p>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Dirección IP y tipo de navegador.</li>
                        <li>Páginas visitadas dentro de la plataforma y duración de la sesión.</li>
                        <li>Datos de uso del reproductor de audio y las herramientas del mixer.</li>
                    </ul>
                </Section>

                <Section title="3. Cómo Usamos su Información">
                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <li>Para proveer, operar y mantener la plataforma Zion Stage.</li>
                        <li>Para gestionar su cuenta, plan de suscripción y almacenamiento asignado.</li>
                        <li>Para procesar transacciones de pago a través de PayPal.</li>
                        <li>Para enviar notificaciones relacionadas con su cuenta (cambios de plan, pagos pendientes, nuevas funciones).</li>
                        <li>Para detectar, prevenir y resolver problemas técnicos o de seguridad.</li>
                        <li>Para mejorar nuestra plataforma mediante el análisis de uso agregado.</li>
                    </ul>
                </Section>

                <Section title="4. Almacenamiento y Seguridad de Datos">
                    <p>Sus archivos de audio se almacenan en servidores seguros de <strong style={{ color: '#e2e8f0' }}>Backblaze B2 Cloud Storage</strong> con cifrado en tránsito (HTTPS/TLS). La información de su cuenta se guarda en <strong style={{ color: '#e2e8f0' }}>Google Firebase Firestore</strong>, protegido por reglas de seguridad que impiden el acceso no autorizado.</p>
                    <p style={{ marginTop: '12px' }}>Tomamos medidas razonables de seguridad para proteger su información; sin embargo, ningún sistema de transmisión por Internet es 100% seguro.</p>
                </Section>

                <Section title="5. Compartición de Datos">
                    <p>No vendemos, intercambiamos ni transferimos su información personal a terceros, excepto en los siguientes casos:</p>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li><strong style={{ color: '#e2e8f0' }}>Proveedores de servicio:</strong> PayPal (pagos), Google Firebase (base de datos y autenticación), Backblaze (almacenamiento de archivos). Estos proveedores solo tienen acceso a la información necesaria para realizar sus funciones.</li>
                        <li><strong style={{ color: '#e2e8f0' }}>Obligación legal:</strong> Si así lo requiere la ley o una autoridad competente.</li>
                    </ul>
                </Section>

                <Section title="6. Cookies y Tecnologías de Seguimiento">
                    <p>Utilizamos cookies de sesión para mantener su inicio de sesión activo y mejorar la experiencia de uso. No utilizamos cookies de rastreo publicitario de terceros. Puede configurar su navegador para rechazar cookies, aunque algunas funciones de la plataforma pueden verse afectadas.</p>
                </Section>

                <Section title="7. Sus Derechos">
                    <p>Usted tiene derecho a:</p>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Acceder a la información personal que tenemos sobre usted.</li>
                        <li>Solicitar la corrección de datos incorrectos.</li>
                        <li>Solicitar la eliminación de su cuenta y todos sus datos.</li>
                        <li>Exportar sus archivos de audio antes de eliminar su cuenta.</li>
                    </ul>
                    <p style={{ marginTop: '12px' }}>Para ejercer cualquiera de estos derechos, contáctenos a <strong style={{ color: '#00d2d3' }}>privacidad@freedomlabs.io</strong></p>
                </Section>

                <Section title="8. Retención de Datos">
                    <p>Conservamos su información mientras su cuenta esté activa. Si elimina su cuenta, sus datos personales serán eliminados en un plazo máximo de 30 días. Sus archivos de audio serán eliminados de los servidores en un plazo de 60 días.</p>
                </Section>

                <Section title="9. Cambios a estas Políticas">
                    <p>Podemos actualizar estas políticas ocasionalmente. Le notificaremos por correo electrónico o mediante un aviso en la plataforma con al menos 15 días de anticipación antes de que los cambios entren en vigor.</p>
                </Section>

                <Section title="10. Contacto">
                    <p>Si tiene preguntas sobre estas políticas, puede contactarnos a través de:</p>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Correo: <strong style={{ color: '#00d2d3' }}>privacidad@freedomlabs.io</strong></li>
                        <li>Formulario de contacto en nuestra plataforma: <span onClick={() => navigate('/contact')} style={{ color: '#00d2d3', cursor: 'pointer', textDecoration: 'underline' }}>zionstage.app/contacto</span></li>
                    </ul>
                </Section>
            </div>
            <Footer />
        </div>
    );
}
