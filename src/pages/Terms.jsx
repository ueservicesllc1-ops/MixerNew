import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import Footer from '../components/Footer';

const Section = ({ title, children }) => (
    <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#9b59b6', marginBottom: '10px', borderLeft: '3px solid #9b59b6', paddingLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h2>
        <div style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>{children}</div>
    </div>
);

export default function Terms() {
    const navigate = useNavigate();
    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <nav style={{ padding: '20px 40px', background: '#020617', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '20px' }}>
                <button onClick={() => navigate('/')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700', fontFamily: '"Outfit", sans-serif' }}>
                    <ArrowLeft size={20} /> Volver al inicio
                </button>
                <div style={{ height: '20px', width: '1px', background: 'rgba(255,255,255,0.1)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '0.9rem' }}>
                    <FileText size={16} /> Términos y Condiciones
                </div>
            </nav>

            <div style={{ maxWidth: '820px', margin: '0 auto', padding: '60px 40px 100px' }}>
                <div style={{ marginBottom: '50px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: '#9b59b6', borderRadius: '50%' }} />
                        <span style={{ color: '#9b59b6', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Freedom Labs · Zion Stage</span>
                    </div>
                    <h1 style={{ fontSize: '1.9rem', fontWeight: '900', margin: '0 0 10px', lineHeight: '1.2' }}>Términos y Condiciones</h1>
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Última actualización: 7 de marzo de 2026</p>
                </div>

                <div style={{ background: 'rgba(241,196,15,0.08)', border: '1px solid rgba(241,196,15,0.2)', borderRadius: '10px', padding: '18px 20px', marginBottom: '40px', fontSize: '0.9rem', color: '#f1c40f' }}>
                    <strong>Importante:</strong> Al registrarse y utilizar Zion Stage, usted confirma haber leído, comprendido y aceptado estos Términos y Condiciones en su totalidad. Si no está de acuerdo con alguna parte, por favor no utilice la plataforma.
                </div>

                <Section title="1. Definiciones">
                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li><strong style={{ color: '#e2e8f0' }}>"Plataforma"</strong>: Zion Stage, incluyendo el sitio web, la aplicación móvil y todos sus servicios asociados.</li>
                        <li><strong style={{ color: '#e2e8f0' }}>"Freedom Labs"</strong>: Freedom Labs LLC, empresa propietaria y operadora de Zion Stage.</li>
                        <li><strong style={{ color: '#e2e8f0' }}>"Usuario"</strong>: Cualquier persona que se registre y utilice la Plataforma.</li>
                        <li><strong style={{ color: '#e2e8f0' }}>"Contenido"</strong>: Archivos de audio, pistas multitrack, setlists, letras, cifrados y cualquier otro material subido por el Usuario.</li>
                        <li><strong style={{ color: '#e2e8f0' }}>"Suscripción"</strong>: El plan de pago mensual o anual que permite al Usuario acceder a las funciones premium.</li>
                    </ul>
                </Section>

                <Section title="2. Uso de la Plataforma">
                    <p>Para utilizar Zion Stage debe:</p>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Tener al menos 18 años de edad, o contar con el consentimiento de un adulto responsable.</li>
                        <li>Proporcionar información verdadera y actualizada durante el registro.</li>
                        <li>Mantener la confidencialidad de su contraseña.</li>
                        <li>No compartir su cuenta con terceros.</li>
                        <li>No utilizarla para actividades ilegales o que violen derechos de terceros.</li>
                    </ul>
                </Section>

                <Section title="3. Derechos de Propiedad Intelectual del Contenido">
                    <p><strong style={{ color: '#e2e8f0' }}>Contenido de uso personal:</strong> El Usuario reconoce que es responsable de asegurarse de que tiene los derechos necesarios para utilizar cualquier pista o archivo subido a la plataforma con fines personales.</p>
                    <p style={{ marginTop: '12px' }}><strong style={{ color: '#e2e8f0' }}>Contenido para venta en el Marketplace:</strong> Al subir contenido marcado para venta, el Usuario declara y garantiza bajo su exclusiva responsabilidad que:</p>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Es el titular original de los derechos de autor de las pistas multitrack subidas.</li>
                        <li>Tiene autorización expresa de los compositores y/o editoras para comercializar dicho contenido.</li>
                        <li>El contenido no infringe derechos de propiedad intelectual de ningún tercero.</li>
                    </ul>
                    <p style={{ marginTop: '12px' }}>Freedom Labs se reserva el derecho de rechazar o retirar cualquier contenido que, a su criterio razonable, pueda infringir derechos de terceros. El Usuario asume toda responsabilidad civil y penal derivada de infracciones de derechos de autor.</p>
                </Section>

                <Section title="4. Suscripciones y Pagos">
                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Los cobros se realizan de forma automática a través de PayPal, de forma mensual o anual según el plan elegido.</li>
                        <li>El precio del plan podrá ajustarse con previo aviso de 30 días al Usuario.</li>
                        <li>Puede cancelar su suscripción en cualquier momento desde su cuenta de PayPal. El acceso al plan continuará hasta el final del período ya pagado.</li>
                        <li>No se realizan reembolsos por períodos parciales, salvo en casos donde la ley aplicable así lo requiera.</li>
                        <li>El incumplimiento de pago resultará en la degradación automática al plan Gratuito.</li>
                    </ul>
                </Section>

                <Section title="5. Plan Gratuito y Limitaciones">
                    <p>El plan Gratuito ofrece 300 MB de almacenamiento y acceso a las funciones básicas de la plataforma. Freedom Labs se reserva el derecho de modificar los límites del plan Gratuito con previo aviso.</p>
                </Section>

                <Section title="6. Marketplace — Ventas de Contenido">
                    <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Todo contenido publicado para venta requiere aprobación previa por parte del equipo de Freedom Labs.</li>
                        <li>Freedom Labs se reserva el derecho de rechazar cualquier contenido sin necesidad de explicación.</li>
                        <li>Los precios de venta serán definidos inicialmente por Freedom Labs y podrán ser acordados con el creador en la etapa de aprobación.</li>
                        <li>La distribución de ingresos por ventas será comunicada al creador al momento de la aprobación de su contenido.</li>
                        <li><strong style={{ color: '#00bcd4' }}>6.5 Contribución a la Comunidad:</strong> Por cada 10 canciones publicadas para la venta, el vendedor debe publicar 1 canción de forma gratuita para la comunidad. La primera canción subida por cualquier vendedor debe ser obligatoriamente gratuita. El sistema aplicará esta regla automáticamente durante el proceso de subida.</li>
                    </ul>
                </Section>

                <Section title="7. Prohibiciones">
                    <p>El Usuario se compromete a NO:</p>
                    <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <li>Subir contenido con copyright protegido sin los permisos correspondientes.</li>
                        <li>Intentar acceder a cuentas de otros usuarios o a los servidores de la plataforma de forma no autorizada.</li>
                        <li>Usar la plataforma para distribuir malware o contenido ofensivo.</li>
                        <li>Revender o sublicenciar el acceso a la plataforma.</li>
                        <li>Realizar ingeniería inversa sobre el software de Zion Stage.</li>
                    </ul>
                </Section>

                <Section title="8. Limitación de Responsabilidad">
                    <p>Zion Stage se provee "tal como es". Freedom Labs no garantiza disponibilidad ininterrumpida del servicio. En ningún caso Freedom Labs será responsable de daños indirectos, incidentales o consecuentes derivados del uso de la plataforma. La responsabilidad máxima de Freedom Labs ante el Usuario será equivalente al monto pagado en los últimos 3 meses de suscripción.</p>
                </Section>

                <Section title="9. Terminación">
                    <p>Freedom Labs puede suspender o terminar su cuenta en caso de violación de estos términos, con o sin previo aviso según la gravedad de la infracción. Usted puede eliminar su cuenta en cualquier momento desde la sección de Ajustes.</p>
                </Section>

                <Section title="10. Ley Aplicable">
                    <p>Estos términos se rigen por las leyes del Estado de New Jersey, Estados Unidos. Cualquier disputase resolverá mediante arbitraje vinculante, renunciando las partes a juicio por jurado.</p>
                </Section>

                <Section title="11. Cambios a los Términos">
                    <p>Nos reservamos el derecho de actualizar estos términos. Los cambios sustanciales serán comunicados con al menos 30 días de anticipación por correo electrónico. El uso continuado de la plataforma tras la entrada en vigor de los nuevos términos implica su aceptación.</p>
                </Section>
            </div>
            <Footer />
        </div>
    );
}
