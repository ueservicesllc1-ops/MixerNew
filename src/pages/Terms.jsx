import React from 'react';
import { FileText } from 'lucide-react';
import Footer from '../components/Footer';
import PageNavBar from '../components/PageNavBar';
import { useTranslation } from 'react-i18next';

const Section = ({ title, children }) => (
    <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#9b59b6', marginBottom: '10px', borderLeft: '3px solid #9b59b6', paddingLeft: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</h2>
        <div style={{ color: '#94a3b8', lineHeight: '1.75', fontSize: '0.88rem' }}>{children}</div>
    </div>
);

export default function Terms() {
    const { t, i18n } = useTranslation();
    const isEn = i18n.language?.startsWith('en');
    const copy = isEn
        ? {
            title: 'Terms and Conditions',
            updated: 'Last updated: March 7, 2026',
            important:
                'Important: By registering and using Zion Stage, you confirm that you have read, understood, and accepted these Terms and Conditions in full. If you do not agree with any part, please do not use the platform.',
            sections: [
                {
                    title: '1. Definitions',
                    body: (
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li><strong style={{ color: '#e2e8f0' }}>"Platform"</strong>: Zion Stage, including the website, mobile application, and all associated services.</li>
                            <li><strong style={{ color: '#e2e8f0' }}>"Freedom Labs"</strong>: Freedom Labs LLC, owner and operator of Zion Stage.</li>
                            <li><strong style={{ color: '#e2e8f0' }}>"User"</strong>: Any person who registers and uses the Platform.</li>
                            <li><strong style={{ color: '#e2e8f0' }}>"Content"</strong>: Audio files, multitrack files, setlists, lyrics, chord charts, and any other material uploaded by the User.</li>
                            <li><strong style={{ color: '#e2e8f0' }}>"Subscription"</strong>: The monthly or annual paid plan that allows the User to access premium features.</li>
                        </ul>
                    )
                },
                {
                    title: '2. Use of the Platform',
                    body: (
                        <>
                            <p>To use Zion Stage you must:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Be at least 18 years old, or have consent from a responsible adult.</li>
                                <li>Provide truthful and updated information during registration.</li>
                                <li>Keep your password confidential.</li>
                                <li>Not share your account with third parties.</li>
                                <li>Not use the platform for illegal activities or activities that violate third-party rights.</li>
                            </ul>
                        </>
                    )
                },
                {
                    title: '3. Intellectual Property Rights in Content',
                    body: (
                        <>
                            <p><strong style={{ color: '#e2e8f0' }}>Personal-use content:</strong> The User acknowledges they are responsible for ensuring they have the necessary rights to use any track or file uploaded to the platform for personal purposes.</p>
                            <p style={{ marginTop: '12px' }}><strong style={{ color: '#e2e8f0' }}>Marketplace sales content:</strong> By uploading content marked for sale, the User declares and guarantees, under their sole responsibility, that:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>They are the original copyright holder of the uploaded multitrack files.</li>
                                <li>They have explicit authorization from composers and/or publishers to commercialize such content.</li>
                                <li>The content does not infringe any third party intellectual property rights.</li>
                            </ul>
                            <p style={{ marginTop: '12px' }}>Freedom Labs reserves the right to reject or remove any content that, in its reasonable judgment, may infringe third-party rights. The User assumes all civil and criminal liability arising from copyright infringement.</p>
                        </>
                    )
                },
                {
                    title: '4. Subscriptions and Payments',
                    body: (
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>Charges are processed automatically through PayPal, either monthly or annually according to the chosen plan.</li>
                            <li>Plan pricing may be adjusted with 30 days prior notice to the User.</li>
                            <li>You may cancel your subscription at any time from your PayPal account. Access continues until the end of the already-paid period.</li>
                            <li>No refunds are provided for partial periods, except where required by applicable law.</li>
                            <li>Payment failure will result in automatic downgrade to the Free plan.</li>
                        </ul>
                    )
                },
                {
                    title: '5. Free Plan and Limitations',
                    body: (
                        <p>The Free plan offers 1 GB of storage and access to the platform basic features. Freedom Labs reserves the right to modify Free plan limits with prior notice.</p>
                    )
                },
                {
                    title: '6. Marketplace — Content Sales',
                    body: (
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>All content published for sale requires prior approval by the Freedom Labs team.</li>
                            <li>Freedom Labs reserves the right to reject any content without explanation.</li>
                            <li>Sale prices will be initially defined by Freedom Labs and may be agreed with the creator during the approval stage.</li>
                            <li>Revenue distribution from sales will be communicated to the creator when their content is approved.</li>
                            <li><strong style={{ color: '#00bcd4' }}>6.5 Community Contribution:</strong> For every 10 songs published for sale, the seller must publish 1 song for free for the community. The first song uploaded by any seller must be free. The system applies this rule automatically during upload.</li>
                        </ul>
                    )
                },
                {
                    title: '7. Prohibited Conduct',
                    body: (
                        <>
                            <p>The User agrees NOT to:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Upload copyrighted content without the corresponding permissions.</li>
                                <li>Attempt unauthorized access to other user accounts or platform servers.</li>
                                <li>Use the platform to distribute malware or offensive content.</li>
                                <li>Resell or sublicense access to the platform.</li>
                                <li>Reverse engineer Zion Stage software.</li>
                            </ul>
                        </>
                    )
                },
                {
                    title: '8. Limitation of Liability',
                    body: (
                        <p>Zion Stage is provided "as is". Freedom Labs does not guarantee uninterrupted service availability. In no case will Freedom Labs be liable for indirect, incidental, or consequential damages arising from use of the platform. Freedom Labs maximum liability to the User will be equal to the amount paid in the last 3 months of subscription.</p>
                    )
                },
                {
                    title: '9. Termination',
                    body: (
                        <p>Freedom Labs may suspend or terminate your account in case of violation of these terms, with or without prior notice depending on the severity of the infringement. You may delete your account at any time from the Settings section.</p>
                    )
                },
                {
                    title: '10. Governing Law',
                    body: (
                        <p>These terms are governed by the laws of the State of New Jersey, United States. Any disputes shall be resolved through binding arbitration, with both parties waiving the right to trial by jury.</p>
                    )
                },
                {
                    title: '11. Changes to the Terms',
                    body: (
                        <p>We reserve the right to update these terms. Material changes will be communicated at least 30 days in advance by email. Continued use of the platform after new terms take effect implies acceptance.</p>
                    )
                }
            ]
        }
        : {
            title: 'Términos y Condiciones',
            updated: 'Última actualización: 7 de marzo de 2026',
            important:
                'Importante: Al registrarse y utilizar Zion Stage, usted confirma haber leído, comprendido y aceptado estos Términos y Condiciones en su totalidad. Si no está de acuerdo con alguna parte, por favor no utilice la plataforma.',
            sections: [
                {
                    title: '1. Definiciones',
                    body: (
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li><strong style={{ color: '#e2e8f0' }}>"Plataforma"</strong>: Zion Stage, incluyendo el sitio web, la aplicación móvil y todos sus servicios asociados.</li>
                            <li><strong style={{ color: '#e2e8f0' }}>"Freedom Labs"</strong>: Freedom Labs LLC, empresa propietaria y operadora de Zion Stage.</li>
                            <li><strong style={{ color: '#e2e8f0' }}>"Usuario"</strong>: Cualquier persona que se registre y utilice la Plataforma.</li>
                            <li><strong style={{ color: '#e2e8f0' }}>"Contenido"</strong>: Archivos de audio, pistas multitrack, setlists, letras, cifrados y cualquier otro material subido por el Usuario.</li>
                            <li><strong style={{ color: '#e2e8f0' }}>"Suscripción"</strong>: El plan de pago mensual o anual que permite al Usuario acceder a las funciones premium.</li>
                        </ul>
                    )
                },
                {
                    title: '2. Uso de la Plataforma',
                    body: (
                        <>
                            <p>Para utilizar Zion Stage debe:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Tener al menos 18 años de edad, o contar con el consentimiento de un adulto responsable.</li>
                                <li>Proporcionar información verdadera y actualizada durante el registro.</li>
                                <li>Mantener la confidencialidad de su contraseña.</li>
                                <li>No compartir su cuenta con terceros.</li>
                                <li>No utilizarla para actividades ilegales o que violen derechos de terceros.</li>
                            </ul>
                        </>
                    )
                },
                {
                    title: '3. Derechos de Propiedad Intelectual del Contenido',
                    body: (
                        <>
                            <p><strong style={{ color: '#e2e8f0' }}>Contenido de uso personal:</strong> El Usuario reconoce que es responsable de asegurarse de que tiene los derechos necesarios para utilizar cualquier pista o archivo subido a la plataforma con fines personales.</p>
                            <p style={{ marginTop: '12px' }}><strong style={{ color: '#e2e8f0' }}>Contenido para venta en el Marketplace:</strong> Al subir contenido marcado para venta, el Usuario declara y garantiza bajo su exclusiva responsabilidad que:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Es el titular original de los derechos de autor de las pistas multitrack subidas.</li>
                                <li>Tiene autorización expresa de los compositores y/o editoras para comercializar dicho contenido.</li>
                                <li>El contenido no infringe derechos de propiedad intelectual de ningún tercero.</li>
                            </ul>
                            <p style={{ marginTop: '12px' }}>Freedom Labs se reserva el derecho de rechazar o retirar cualquier contenido que, a su criterio razonable, pueda infringir derechos de terceros. El Usuario asume toda responsabilidad civil y penal derivada de infracciones de derechos de autor.</p>
                        </>
                    )
                },
                {
                    title: '4. Suscripciones y Pagos',
                    body: (
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>Los cobros se realizan de forma automática a través de PayPal, de forma mensual o anual según el plan elegido.</li>
                            <li>El precio del plan podrá ajustarse con previo aviso de 30 días al Usuario.</li>
                            <li>Puede cancelar su suscripción en cualquier momento desde su cuenta de PayPal. El acceso al plan continuará hasta el final del período ya pagado.</li>
                            <li>No se realizan reembolsos por períodos parciales, salvo en casos donde la ley aplicable así lo requiera.</li>
                            <li>El incumplimiento de pago resultará en la degradación automática al plan Gratuito.</li>
                        </ul>
                    )
                },
                {
                    title: '5. Plan Gratuito y Limitaciones',
                    body: (
                        <p>El plan Gratuito ofrece 1 GB de almacenamiento y acceso a las funciones básicas de la plataforma. Freedom Labs se reserva el derecho de modificar los límites del plan Gratuito con previo aviso.</p>
                    )
                },
                {
                    title: '6. Marketplace — Ventas de Contenido',
                    body: (
                        <ul style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <li>Todo contenido publicado para venta requiere aprobación previa por parte del equipo de Freedom Labs.</li>
                            <li>Freedom Labs se reserva el derecho de rechazar cualquier contenido sin necesidad de explicación.</li>
                            <li>Los precios de venta serán definidos inicialmente por Freedom Labs y podrán ser acordados con el creador en la etapa de aprobación.</li>
                            <li>La distribución de ingresos por ventas será comunicada al creador al momento de la aprobación de su contenido.</li>
                            <li><strong style={{ color: '#00bcd4' }}>6.5 Contribución a la Comunidad:</strong> Por cada 10 canciones publicadas para la venta, el vendedor debe publicar 1 canción de forma gratuita para la comunidad. La primera canción subida por cualquier vendedor debe ser obligatoriamente gratuita. El sistema aplicará esta regla automáticamente durante el proceso de subida.</li>
                        </ul>
                    )
                },
                {
                    title: '7. Prohibiciones',
                    body: (
                        <>
                            <p>El Usuario se compromete a NO:</p>
                            <ul style={{ marginTop: '10px', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <li>Subir contenido con copyright protegido sin los permisos correspondientes.</li>
                                <li>Intentar acceder a cuentas de otros usuarios o a los servidores de la plataforma de forma no autorizada.</li>
                                <li>Usar la plataforma para distribuir malware o contenido ofensivo.</li>
                                <li>Revender o sublicenciar el acceso a la plataforma.</li>
                                <li>Realizar ingeniería inversa sobre el software de Zion Stage.</li>
                            </ul>
                        </>
                    )
                },
                {
                    title: '8. Limitación de Responsabilidad',
                    body: (
                        <p>Zion Stage se provee "tal como es". Freedom Labs no garantiza disponibilidad ininterrumpida del servicio. En ningún caso Freedom Labs será responsable de daños indirectos, incidentales o consecuentes derivados del uso de la plataforma. La responsabilidad máxima de Freedom Labs ante el Usuario será equivalente al monto pagado en los últimos 3 meses de suscripción.</p>
                    )
                },
                {
                    title: '9. Terminación',
                    body: (
                        <p>Freedom Labs puede suspender o terminar su cuenta en caso de violación de estos términos, con o sin previo aviso según la gravedad de la infracción. Usted puede eliminar su cuenta en cualquier momento desde la sección de Ajustes.</p>
                    )
                },
                {
                    title: '10. Ley Aplicable',
                    body: (
                        <p>Estos términos se rigen por las leyes del Estado de New Jersey, Estados Unidos. Cualquier disputa se resolverá mediante arbitraje vinculante, renunciando las partes a juicio por jurado.</p>
                    )
                },
                {
                    title: '11. Cambios a los Términos',
                    body: (
                        <p>Nos reservamos el derecho de actualizar estos términos. Los cambios sustanciales serán comunicados con al menos 30 días de anticipación por correo electrónico. El uso continuado de la plataforma tras la entrada en vigor de los nuevos términos implica su aceptación.</p>
                    )
                }
            ]
        };
    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <PageNavBar Icon={FileText} title={t('pages.termsConditions')} />

            <div style={{ maxWidth: '820px', margin: '0 auto', padding: '60px 40px 100px' }}>
                <div style={{ marginBottom: '50px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ width: '28px', height: '28px', background: '#9b59b6', borderRadius: '50%' }} />
                        <span style={{ color: '#9b59b6', fontWeight: '700', fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Freedom Labs · Zion Stage</span>
                    </div>
                    <h1 style={{ fontSize: '1.9rem', fontWeight: '900', margin: '0 0 10px', lineHeight: '1.2' }}>{copy.title}</h1>
                    <p style={{ color: '#64748b', fontSize: '0.8rem' }}>{copy.updated}</p>
                </div>

                <div style={{ background: 'rgba(241,196,15,0.08)', border: '1px solid rgba(241,196,15,0.2)', borderRadius: '10px', padding: '18px 20px', marginBottom: '40px', fontSize: '0.9rem', color: '#f1c40f' }}>
                    <strong>{isEn ? 'Important:' : 'Importante:'}</strong> {copy.important}
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
