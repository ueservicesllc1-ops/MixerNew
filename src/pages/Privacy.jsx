import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import Footer from '../components/Footer';
import PageNavBar from '../components/PageNavBar';
import { useTranslation } from 'react-i18next';

const Section = ({ title, children }) => (
    <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#00d2d3', marginBottom: '10px', borderLeft: '3px solid #00d2d3', paddingLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h2>
        <div style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>{children}</div>
    </div>
);

export default function Privacy() {
    const navigate = useNavigate();
    const { t, i18n } = useTranslation();
    const isEn = i18n.language?.startsWith('en');
    const copy = isEn
        ? {
            title: 'Privacy Policy',
            updated: 'Last updated: March 7, 2026',
            sections: [
                {
                    title: '1. Who We Are',
                    body: (
                        <>
                            <p>Zion Stage is a product of <strong style={{ color: '#e2e8f0' }}>Freedom Labs LLC</strong>, a company dedicated to developing technology for worship teams and worship ministries. Our platform enables cloud management of multitrack files, setlists, and professional audio tools for worship leaders.</p>
                            <p style={{ marginTop: '12px' }}>By using Zion Stage (hereinafter, "the Platform"), you agree to the collection and use of information in accordance with this policy.</p>
                        </>
                    )
                },
                {
                    title: '2. Information We Collect',
                    body: (
                        <>
                            <p><strong style={{ color: '#e2e8f0' }}>Information you provide:</strong></p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>First and last name at signup.</li>
                                <li>Email address.</li>
                                <li>Profile photo (optional).</li>
                                <li>Audio files and multitrack files you upload to your personal library.</li>
                                <li>Payment information processed securely through PayPal (we do not store credit card data).</li>
                            </ul>
                            <p style={{ marginTop: '16px' }}><strong style={{ color: '#e2e8f0' }}>Automatically collected information:</strong></p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>IP address and browser type.</li>
                                <li>Pages visited within the platform and session duration.</li>
                                <li>Usage data from the audio player and mixer tools.</li>
                            </ul>
                        </>
                    )
                },
                {
                    title: '3. How We Use Your Information',
                    body: (
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <li>To provide, operate, and maintain the Zion Stage platform.</li>
                            <li>To manage your account, subscription plan, and assigned storage.</li>
                            <li>To process payment transactions through PayPal.</li>
                            <li>To send account-related notifications (plan changes, pending payments, new features).</li>
                            <li>To detect, prevent, and resolve technical or security issues.</li>
                            <li>To improve our platform through aggregated usage analysis.</li>
                        </ul>
                    )
                },
                {
                    title: '4. Data Storage and Security',
                    body: (
                        <>
                            <p>Your audio files are stored on secure <strong style={{ color: '#e2e8f0' }}>Backblaze B2 Cloud Storage</strong> servers with in-transit encryption (HTTPS/TLS). Your account information is stored in <strong style={{ color: '#e2e8f0' }}>Google Firebase Firestore</strong>, protected by security rules that prevent unauthorized access.</p>
                            <p style={{ marginTop: '12px' }}>We take reasonable security measures to protect your information; however, no internet transmission system is 100% secure.</p>
                        </>
                    )
                },
                {
                    title: '5. Data Sharing',
                    body: (
                        <>
                            <p>We do not sell, trade, or transfer your personal information to third parties, except in the following cases:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li><strong style={{ color: '#e2e8f0' }}>Service providers:</strong> PayPal (payments), Google Firebase (database and authentication), Backblaze (file storage). These providers only access the information necessary to perform their functions.</li>
                                <li><strong style={{ color: '#e2e8f0' }}>Legal obligation:</strong> If required by law or a competent authority.</li>
                            </ul>
                        </>
                    )
                },
                {
                    title: '6. Cookies and Tracking Technologies',
                    body: (
                        <p>We use session cookies to keep your login active and improve your user experience. We do not use third-party advertising tracking cookies. You may configure your browser to reject cookies, although some platform features may be affected.</p>
                    )
                },
                {
                    title: '7. Your Rights',
                    body: (
                        <>
                            <p>You have the right to:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Access the personal information we hold about you.</li>
                                <li>Request correction of inaccurate data.</li>
                                <li>Request deletion of your account and all your data.</li>
                                <li>Export your audio files before deleting your account.</li>
                            </ul>
                            <p style={{ marginTop: '12px' }}>To exercise any of these rights, contact us at <strong style={{ color: '#00d2d3' }}>privacidad@freedomlabs.io</strong></p>
                        </>
                    )
                },
                {
                    title: '8. Data Retention',
                    body: (
                        <p>We retain your information while your account is active. If you delete your account, your personal data will be deleted within a maximum of 30 days. Your audio files will be deleted from servers within 60 days.</p>
                    )
                },
                {
                    title: '9. Changes to This Policy',
                    body: (
                        <p>We may update this policy occasionally. We will notify you by email or through a notice on the platform at least 15 days before changes take effect.</p>
                    )
                },
                {
                    title: '10. Contact',
                    body: (
                        <>
                            <p>If you have questions about this policy, you can contact us through:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Email: <strong style={{ color: '#00d2d3' }}>privacidad@freedomlabs.io</strong></li>
                                <li>Contact form on our platform: <span onClick={() => navigate('/contact')} style={{ color: '#00d2d3', cursor: 'pointer', textDecoration: 'underline' }}>zionstage.app/contact</span></li>
                            </ul>
                        </>
                    )
                }
            ]
        }
        : {
            title: 'Políticas de Privacidad',
            updated: 'Última actualización: 7 de marzo de 2026',
            sections: [
                {
                    title: '1. Quiénes Somos',
                    body: (
                        <>
                            <p>Zion Stage es un producto de <strong style={{ color: '#e2e8f0' }}>Freedom Labs LLC</strong>, empresa dedicada al desarrollo de tecnología para equipos de alabanza y ministerios de adoración. Nuestra plataforma permite la gestión en la nube de pistas multitrack, setlists y herramientas de audio profesional para líderes de adoración.</p>
                            <p style={{ marginTop: '12px' }}>Al utilizar Zion Stage (en adelante "la Plataforma"), usted acepta la recopilación y uso de información de conformidad con estas políticas.</p>
                        </>
                    )
                },
                {
                    title: '2. Información que Recopilamos',
                    body: (
                        <>
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
                        </>
                    )
                },
                {
                    title: '3. Cómo Usamos su Información',
                    body: (
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <li>Para proveer, operar y mantener la plataforma Zion Stage.</li>
                            <li>Para gestionar su cuenta, plan de suscripción y almacenamiento asignado.</li>
                            <li>Para procesar transacciones de pago a través de PayPal.</li>
                            <li>Para enviar notificaciones relacionadas con su cuenta (cambios de plan, pagos pendientes, nuevas funciones).</li>
                            <li>Para detectar, prevenir y resolver problemas técnicos o de seguridad.</li>
                            <li>Para mejorar nuestra plataforma mediante el análisis de uso agregado.</li>
                        </ul>
                    )
                },
                {
                    title: '4. Almacenamiento y Seguridad de Datos',
                    body: (
                        <>
                            <p>Sus archivos de audio se almacenan en servidores seguros de <strong style={{ color: '#e2e8f0' }}>Backblaze B2 Cloud Storage</strong> con cifrado en tránsito (HTTPS/TLS). La información de su cuenta se guarda en <strong style={{ color: '#e2e8f0' }}>Google Firebase Firestore</strong>, protegido por reglas de seguridad que impiden el acceso no autorizado.</p>
                            <p style={{ marginTop: '12px' }}>Tomamos medidas razonables de seguridad para proteger su información; sin embargo, ningún sistema de transmisión por Internet es 100% seguro.</p>
                        </>
                    )
                },
                {
                    title: '5. Compartición de Datos',
                    body: (
                        <>
                            <p>No vendemos, intercambiamos ni transferimos su información personal a terceros, excepto en los siguientes casos:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li><strong style={{ color: '#e2e8f0' }}>Proveedores de servicio:</strong> PayPal (pagos), Google Firebase (base de datos y autenticación), Backblaze (almacenamiento de archivos). Estos proveedores solo tienen acceso a la información necesaria para realizar sus funciones.</li>
                                <li><strong style={{ color: '#e2e8f0' }}>Obligación legal:</strong> Si así lo requiere la ley o una autoridad competente.</li>
                            </ul>
                        </>
                    )
                },
                {
                    title: '6. Cookies y Tecnologías de Seguimiento',
                    body: (
                        <p>Utilizamos cookies de sesión para mantener su inicio de sesión activo y mejorar la experiencia de uso. No utilizamos cookies de rastreo publicitario de terceros. Puede configurar su navegador para rechazar cookies, aunque algunas funciones de la plataforma pueden verse afectadas.</p>
                    )
                },
                {
                    title: '7. Sus Derechos',
                    body: (
                        <>
                            <p>Usted tiene derecho a:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Acceder a la información personal que tenemos sobre usted.</li>
                                <li>Solicitar la corrección de datos incorrectos.</li>
                                <li>Solicitar la eliminación de su cuenta y todos sus datos.</li>
                                <li>Exportar sus archivos de audio antes de eliminar su cuenta.</li>
                            </ul>
                            <p style={{ marginTop: '12px' }}>Para ejercer cualquiera de estos derechos, contáctenos a <strong style={{ color: '#00d2d3' }}>privacidad@freedomlabs.io</strong></p>
                        </>
                    )
                },
                {
                    title: '8. Retención de Datos',
                    body: (
                        <p>Conservamos su información mientras su cuenta esté activa. Si elimina su cuenta, sus datos personales serán eliminados en un plazo máximo de 30 días. Sus archivos de audio serán eliminados de los servidores en un plazo de 60 días.</p>
                    )
                },
                {
                    title: '9. Cambios a estas Políticas',
                    body: (
                        <p>Podemos actualizar estas políticas ocasionalmente. Le notificaremos por correo electrónico o mediante un aviso en la plataforma con al menos 15 días de anticipación antes de que los cambios entren en vigor.</p>
                    )
                },
                {
                    title: '10. Contacto',
                    body: (
                        <>
                            <p>Si tiene preguntas sobre estas políticas, puede contactarnos a través de:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Correo: <strong style={{ color: '#00d2d3' }}>privacidad@freedomlabs.io</strong></li>
                                <li>Formulario de contacto en nuestra plataforma: <span onClick={() => navigate('/contact')} style={{ color: '#00d2d3', cursor: 'pointer', textDecoration: 'underline' }}>zionstage.app/contacto</span></li>
                            </ul>
                        </>
                    )
                }
            ]
        };
    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <PageNavBar Icon={Shield} title={t('pages.privacyPolicy')} />

            <div style={{ maxWidth: '820px', margin: '0 auto', padding: '60px 40px 100px' }}>
                <div style={{ marginBottom: '50px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: '#00d2d3', borderRadius: '50%' }} />
                        <span style={{ color: '#00d2d3', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Freedom Labs · Zion Stage</span>
                    </div>
                    <h1 style={{ fontSize: '1.9rem', fontWeight: '900', margin: '0 0 10px', lineHeight: '1.2' }}>{copy.title}</h1>
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>{copy.updated}</p>
                </div>
                {copy.sections.map((section) => (
                    <Section key={section.title} title={section.title}>
                        {section.body}
                    </Section>
                ))}
            </div>
            <Footer />
        </div>
    );
}
