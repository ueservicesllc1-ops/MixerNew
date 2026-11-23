import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { onAuthStateChanged } from 'firebase/auth';
import {
    Check, Minus, Globe, Smartphone, Monitor, Apple,
    Sliders, Cloud, Music2, Layers, ArrowRight, Copy,
} from 'lucide-react';
import { auth } from '../firebase';
import AuthModal from '../components/AuthModal';
import { PAID_PLANS_ENABLED, FREE_LAUNCH_STORAGE_GB } from '../config/features';
import '../styles/brand.css';

const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.zionstagelive.app';
const FALLBACK_WINDOWS_URL = 'https://mixernew-production.up.railway.app/api/download?url=https%3A%2F%2Ff005.backblazeb2.com%2Ffile%2Fmixercur%2Fapps%2Fzion-stage-desktop-v1.1.9-1778611080599.exe';

// Planes globales — coinciden con STRIPE_PLANS_CONFIG en b2-proxy.mjs
const PLANS = [
    { id: 'std2', vip: false, monthly: 6.99, annual: 58.72, storage: 50 },
    { id: 'vip2', vip: true, monthly: 9.99, annual: 83.92, storage: 300 },
];

const COPY = {
    es: {
        nav: { program: 'El programa', features: 'Funciones', plans: 'Precios', downloads: 'Descargas', faq: 'FAQ', login: 'Iniciar sesión', start: 'Crear cuenta gratis', dash: 'Ir a mi cuenta' },
        hero: {
            eyebrow: 'Multitracks en vivo · Web, iOS, Android y Windows',
            title: 'Secuencias para tu banda, hechas simples.',
            lead: 'Mezcla cada pista en tiempo real, cambia el tono o el BPM al instante y dirige tu setlist desde la web, iPad, iPhone, Android o Windows con una sola cuenta.',
            cta: 'Crear cuenta gratis',
            cta2: 'Ver planes y precios',
            badges: ['Versión Web incluida', 'App iOS y Android', 'Escritorio Windows', 'Un plan para todos tus equipos'],
            caption: 'Zion Stage • Mezclador Multitrack en vivo',
            live: 'Audio en tiempo real',
        },
        pillars: {
            eyebrow: 'Cómo te ayuda Zion Stage',
            title: 'Todo lo que tu banda necesita en el escenario',
            lead: 'Sin configuraciones complicadas ni programas costosos. Pensado para que subas tus pistas y toques en minutos.',
            items: [
                { icon: 'sliders', t: 'Mezclador por canal', d: 'Controla el volumen, Mute y Solo de cada instrumento con medidores VU en vivo.' },
                { icon: 'music', t: 'Tono y BPM al instante', d: 'Transpón la canción en semitonos o ajusta el tempo sin afectar la claridad del audio.' },
                { icon: 'layers', t: 'Click y Guía separados', d: 'Envía el metrónomo y las guías al monitor de la banda y la música limpia a la consola.' },
                { icon: 'cloud', t: 'Nube y Setlists', d: 'Sube tus multitracks una sola vez y ábrelos en cualquier dispositivo de tu equipo.' },
            ],
        },
        appShowcase: {
            eyebrow: 'Consola Zion Stage',
            title: 'Control total de tus pistas, desde el navegador o la app',
            lead: 'A diferencia de otras plataformas que solo funcionan en Apple, Zion Stage corre en la web, iPad, iPhone, Android y Windows con la misma cuenta.',
            checks: [
                'Mezclador completo sin límite de canales por canción',
                'Ruteo inteligente L/R para monitoreo In-Ear',
                'Ambient Pads continuos integrados en las 12 tonalidades',
                'Letras, acordes y estructura de la canción en pantalla',
                'Reproducción offline una vez descargada tu secuencia',
                'Acceso inmediato desde el navegador sin instalar nada',
            ],
            cta: 'Empezar gratis ahora',
        },
        cloudShowcase: {
            eyebrow: 'Tu biblioteca en la nube',
            title: 'Sube tus multitracks en segundos o usa el catálogo VIP',
            lead: 'Prepara el repertorio de tu iglesia o banda sin perder horas armando sesiones.',
            steps: [
                { t: 'Crea tu cuenta gratis', d: 'Regístrate en segundos y elige el plan que mejor se adapte a tu equipo.' },
                { t: 'Sube tus pistas o elige del catálogo', d: 'Arrastra los stems de tu canción en el dashboard. Con VIP también accedes al catálogo completo de Zion Stage.' },
                { t: 'Abre tu setlist y toca en vivo', d: 'Todo se sincroniza automáticamente en la web, iPad, celular y computadora.' },
            ],
        },
        plans: {
            eyebrow: 'Precios simples y globales',
            title: 'Un solo registro, todos tus dispositivos',
            lead: 'Todos los planes funcionan en Web, iOS, Android y Windows. La única diferencia es si deseas acceso al catálogo de canciones multitrack.',
            monthly: 'Mensual',
            annual: 'Anual',
            save: 'Ahorra 30%',
            perMonth: '/mes',
            perYear: '/año',
            billedYear: 'Facturado anualmente',
            billedMonth: 'Facturado cada mes',
            std: { name: 'Estándar', desc: 'Ideal si ya tienes tus propios multitracks y quieres mezclarlos en cualquier dispositivo.' },
            vip: { name: 'VIP', desc: 'Todo lo del Estándar con 300 GB de nube y uso de todos los multitracks de la base de datos VIP.', tag: 'Más popular · Base de datos VIP' },
            cta: 'Elegir este plan',
            f: {
                devices: 'Acceso global: Web, iOS, Android y Windows',
                own: 'Sube y mezcla tus propios multitracks',
                storage: (n) => `${n} GB de almacenamiento en la nube`,
                setlists: 'Setlists, Ambient Pads, letras y acordes',
                catalog: 'Uso de los multitracks de la base de datos VIP',
            },
        },
        dl: {
            eyebrow: 'Multiplataforma',
            title: 'Lleva Zion Stage a donde toques',
            lead: 'Inicia sesión con tu misma cuenta en cualquier dispositivo.',
            web: { t: 'Versión Web', d: 'Abre el mezclador directo en Chrome, Safari o Edge sin instalar nada.', b: 'Abrir Mixer Web' },
            ios: { t: 'iPhone y iPad', d: 'App nativa optimizada para pantallas táctiles en iOS y iPadOS.', b: 'App Store (1.0)' },
            and: { t: 'Android', d: 'Descarga la app oficial para teléfonos y tablets Android.', b: 'Google Play' },
            win: { t: 'Windows PC', d: 'Instalador de escritorio de baja latencia para computadoras Windows.', b: 'Descargar para PC' },
        },
        faq: {
            eyebrow: 'Dudas comunes',
            title: 'Preguntas frecuentes',
            items: [
                { q: '¿Tengo que pagar aparte por la web, el iPad o Windows?', a: 'No. Tu suscripción es global: con una sola cuenta entras en la web, iPhone, iPad, Android y Windows sin cargos extra.' },
                { q: '¿Cuál es la diferencia exacta entre Estándar y VIP?', a: 'En Estándar puedes subir, guardar y tocar todos tus propios multitracks. En VIP tienes exactamente lo mismo y además acceso al catálogo de multitracks subidos en Zion Stage.' },
                { q: '¿Qué ahorro tengo al pagar el plan anual?', a: 'Al elegir facturación anual recibes un 30% de descuento directo sobre el precio mensual durante todo el año.' },
                { q: '¿Funciona sin internet durante el evento en vivo?', a: 'Sí. Una vez que descargas tus canciones en el dispositivo, puedes reproducirlas y mezclarlas sin conexión a internet.' },
                { q: '¿Puedo cancelar o cambiar de plan cuando quiera?', a: 'Sí, puedes cambiar entre Estándar y VIP o cancelar tu renovación en cualquier momento desde tu dashboard.' },
            ],
        },
        cta: { title: 'Lleva el sonido de tu banda al siguiente nivel', sub: 'Crea tu cuenta hoy y prueba Zion Stage en la web y en todos tus dispositivos.', b: 'Crear cuenta gratis' },
        footer: { desc: 'Plataforma multitrack en vivo para bandas y ministerios de alabanza.', product: 'Producto', help: 'Soporte', legal: 'Legal', resources: 'Recursos', contact: 'Contacto', privacy: 'Política de privacidad', terms: 'Términos de uso', del: 'Eliminar cuenta', rights: 'Todos los derechos reservados.' },
    },
    en: {
        nav: { program: 'The app', features: 'Features', plans: 'Pricing', downloads: 'Downloads', faq: 'FAQ', login: 'Sign in', start: 'Join for free', dash: 'My Dashboard' },
        hero: {
            eyebrow: 'Live Multitracks · Web, iOS, Android & Windows',
            title: 'Tracks for your band, made easy.',
            lead: 'Mix every stem in real time, change key or BPM on the fly, and run your setlist from the web, iPad, iPhone, Android, or Windows with one account.',
            cta: 'Join for free',
            cta2: 'View pricing',
            badges: ['Web App included', 'iOS & Android Apps', 'Windows Desktop', 'One plan for all devices'],
            caption: 'Zion Stage • Live Multitrack Console',
            live: 'Real-time audio',
        },
        pillars: {
            eyebrow: 'How Zion Stage helps you',
            title: 'Everything your band needs on stage',
            lead: 'No complicated DAW setup or expensive gear. Built so you can upload your tracks and play in minutes.',
            items: [
                { icon: 'sliders', t: 'Per-channel mixer', d: 'Control volume, Mute, and Solo for every instrument with live VU meters.' },
                { icon: 'music', t: 'Instant Key & BPM', d: 'Transpose songs by semitones or adjust tempo live without losing audio clarity.' },
                { icon: 'layers', t: 'Separate Click & Guide', d: 'Route click and vocal cues to your band monitors and clean music to FOH.' },
                { icon: 'cloud', t: 'Cloud & Setlists', d: 'Upload your multitracks once and access them across every device on your team.' },
            ],
        },
        appShowcase: {
            eyebrow: 'Zion Stage Console',
            title: 'Total control of your tracks, in the browser or native app',
            lead: 'Unlike platforms locked to a single ecosystem, Zion Stage runs on Web, iPad, iPhone, Android, and Windows with one login.',
            checks: [
                'Full channel mixer with no track limit per song',
                'Smart L/R routing for In-Ear monitoring',
                'Built-in continuous Ambient Pads in all 12 keys',
                'On-screen lyrics, chords, and song sections',
                'Offline playback once your setlist is downloaded',
                'Instant browser access — nothing to install',
            ],
            cta: 'Get started free',
        },
        cloudShowcase: {
            eyebrow: 'Your cloud library',
            title: 'Upload your own tracks in seconds or unlock the VIP catalog',
            lead: 'Prepare Sunday or gig setlists fast without spending hours building sessions.',
            steps: [
                { t: 'Create your free account', d: 'Sign up in seconds and pick the plan that fits your team.' },
                { t: 'Upload stems or browse the catalog', d: 'Drag your song stems into the dashboard. VIP unlocks the full Zion Stage song catalog.' },
                { t: 'Open your setlist and play live', d: 'Everything stays synced across web, iPad, phone, and desktop.' },
            ],
        },
        plans: {
            eyebrow: 'Simple global pricing',
            title: 'One account, every device',
            lead: 'Every plan works on Web, iOS, Android, and Windows. The only difference is access to the Zion Stage multitrack catalog.',
            monthly: 'Monthly',
            annual: 'Annual',
            save: 'Save 30%',
            perMonth: '/mo',
            perYear: '/yr',
            billedYear: 'Billed annually',
            billedMonth: 'Billed monthly',
            std: { name: 'Standard', desc: 'Built for musicians who upload and run their own multitrack stems on any device.' },
            vip: { name: 'VIP', desc: 'Everything in Standard plus full access to the Zion Stage multitrack catalog.', tag: 'Most popular · Includes catalog' },
            cta: 'Choose this plan',
            f: {
                devices: 'Global access: Web, iOS, Android & Windows',
                own: 'Upload and mix your own multitracks',
                storage: (n) => `${n} GB cloud storage`,
                setlists: 'Setlists, Ambient Pads, lyrics & chords',
                catalog: 'Full access to the Zion Stage multitrack catalog',
            },
        },
        dl: {
            eyebrow: 'Cross-platform',
            title: 'Run Zion Stage wherever you play',
            lead: 'Sign in with the same account on any device.',
            web: { t: 'Web Version', d: 'Open the mixer directly in Chrome, Safari, or Edge — no install needed.', b: 'Open Web Mixer' },
            ios: { t: 'iPhone & iPad', d: 'Native touch-first app built for iOS and iPadOS.', b: 'App Store (1.0)' },
            and: { t: 'Android', d: 'Download the official app for Android phones and tablets.', b: 'Google Play' },
            win: { t: 'Windows PC', d: 'Low-latency desktop installer for Windows computers.', b: 'Download for PC' },
        },
        faq: {
            eyebrow: 'Common questions',
            title: 'Frequently asked questions',
            items: [
                { q: 'Do I pay separately for Web, iPad, or Windows?', a: 'No. Your subscription is global: one account works on Web, iPhone, iPad, Android, and Windows with no extra fees.' },
                { q: 'What is the difference between Standard and VIP?', a: 'Standard lets you upload, store, and mix your own multitracks. VIP includes all of that plus access to the Zion Stage multitrack song catalog.' },
                { q: 'How much do I save with annual billing?', a: 'Annual billing gives you a 30% discount compared to paying month-to-month.' },
                { q: 'Does it work offline during a live service?', a: 'Yes. Once your songs are downloaded on your device, they play reliably without an internet connection.' },
                { q: 'Can I switch plans or cancel anytime?', a: 'Yes, you can upgrade, downgrade, or cancel anytime directly from your dashboard.' },
            ],
        },
        cta: { title: 'Elevate your band’s live sound today', sub: 'Create your account and run Zion Stage on the web and all your devices.', b: 'Join for free' },
        footer: { desc: 'Live multitrack platform for bands and worship teams.', product: 'Product', help: 'Support', legal: 'Legal', resources: 'Resources', contact: 'Contact', privacy: 'Privacy Policy', terms: 'Terms of Service', del: 'Delete account', rights: 'All rights reserved.' },
    },
};

function PillarIcon({ name }) {
    if (name === 'sliders') return <Sliders size={22} />;
    if (name === 'music') return <Music2 size={22} />;
    if (name === 'layers') return <Layers size={22} />;
    return <Cloud size={22} />;
}

export default function Landing() {
    const navigate = useNavigate();
    const { i18n } = useTranslation();
    const lang = (i18n.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
    const c = COPY[lang];

    const [user, setUser] = useState(null);
    const [authMode, setAuthMode] = useState(null);
    const [annual, setAnnual] = useState(true);
    const [copiedCode, setCopiedCode] = useState(false);
    const [windowsUrl, setWindowsUrl] = useState(FALLBACK_WINDOWS_URL);

    const copyPromoCode = () => {
        try { navigator.clipboard?.writeText('ZION99'); } catch { /* ignore */ }
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2200);
    };

    const claimPromo = () => {
        setAnnual(false);
        try {
            localStorage.setItem('zion_intended_coupon', 'ZION99');
            localStorage.setItem('zion_intended_plan', JSON.stringify({ id: 'vip2', cycle: 'monthly' }));
        } catch { /* ignore */ }
        scrollTo('precios');
    };

    useEffect(() => onAuthStateChanged(auth, setUser), []);

    useEffect(() => {
        let alive = true;
        fetch('/app-latest-desktop.json', { cache: 'no-store' })
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => { if (alive && j?.desktopDownloadUrl) setWindowsUrl(j.desktopDownloadUrl); })
            .catch(() => {});
        return () => { alive = false; };
    }, []);

    const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const toggleLang = () => i18n.changeLanguage(lang === 'es' ? 'en' : 'es');

    const openRegister = (planId) => {
        if (planId) {
            try { localStorage.setItem('zion_intended_plan', JSON.stringify({ id: planId, cycle: annual ? 'annual' : 'monthly' })); } catch { /* ignore */ }
        }
        if (user) { navigate('/dashboard'); return; }
        setAuthMode('register');
    };

    const money = (n) => `$${n.toFixed(2)}`;

    return (
        <div className="z-page">
            {/* Franja promocional ZION99 (solo cuando los planes de pago están activos) */}
            {PAID_PLANS_ENABLED && (
            <div className="z-promo-bar">
                <div className="z-promo-bar-inner">
                    <span>
                        {lang === 'en'
                            ? <>Launch offer: get your <strong>1st month for $0.99 USD</strong> on any monthly plan with code</>
                            : <>Promoción: obtén tu <strong>1er mes por $0.99 USD</strong> en cualquier plan mensual con el código</>}
                    </span>
                    <button type="button" className="z-promo-code" onClick={copyPromoCode} title="Copiar código">
                        ZION99 <Copy size={13} />
                        {copiedCode && <span style={{ fontFamily: 'var(--z-font)', fontSize: '0.74rem', color: '#17bcc7' }}>{lang === 'en' ? 'Copied' : 'Copiado'}</span>}
                    </button>
                    <button
                        type="button"
                        onClick={claimPromo}
                        style={{ background: 'none', border: 'none', color: '#17bcc7', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', fontSize: '0.84rem' }}
                    >
                        {lang === 'en' ? 'Apply to pricing →' : 'Ver oferta →'}
                    </button>
                </div>
            </div>
            )}

            {/* Barra superior blanca y limpia */}
            <header className="z-nav">
                <div className="z-wrap z-nav-inner">
                    <div className="z-nav-left">
                        <img
                            src="/logo2.png"
                            alt="Zion Stage"
                            style={{ height: 32, cursor: 'pointer' }}
                            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                        />
                        <nav className="z-nav-links">
                            <button className="z-nav-link" onClick={() => scrollTo('programa')}>{c.nav.program}</button>
                            <button className="z-nav-link" onClick={() => scrollTo('funciones')}>{c.nav.features}</button>
                            <button className="z-nav-link" onClick={() => scrollTo('precios')}>{c.nav.plans}</button>
                            <button className="z-nav-link" onClick={() => scrollTo('descargas')}>{c.nav.downloads}</button>
                            <button className="z-nav-link" onClick={() => scrollTo('preguntas')}>{c.nav.faq}</button>
                        </nav>
                    </div>
                    <div className="z-nav-actions">
                        <button className="z-lang-btn" onClick={toggleLang} title="Cambiar idioma">
                            {lang === 'es' ? 'EN' : 'ES'}
                        </button>
                        {user ? (
                            <button className="z-btn z-btn-primary z-btn-sm" onClick={() => navigate('/dashboard')}>{c.nav.dash}</button>
                        ) : (
                            <>
                                <button className="z-btn z-btn-ghost z-btn-sm" onClick={() => setAuthMode('login')}>{c.nav.login}</button>
                                <button className="z-btn z-btn-primary z-btn-sm" onClick={() => openRegister()}>{c.nav.start}</button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* HERO con fotografía real de escenario y vista del estudio */}
            <section className="z-hero">
                <div className="z-hero-bg" aria-hidden="true" />
                <div className="z-hero-overlay" aria-hidden="true" />
                <div className="z-wrap z-hero-grid">
                    <div>
                        <div className="z-eyebrow">{c.hero.eyebrow}</div>
                        <h1 className="z-h1">{c.hero.title}</h1>
                        <p className="z-hero-lead">{c.hero.lead}</p>
                        <div className="z-cta-row">
                            <button className="z-btn z-btn-primary" onClick={() => openRegister()}>
                                {c.hero.cta} <ArrowRight size={17} />
                            </button>
                            <button className="z-btn z-btn-outline-light" onClick={() => scrollTo('precios')}>
                                {c.hero.cta2}
                            </button>
                        </div>
                        <div className="z-hero-badges">
                            {c.hero.badges.map((b) => (
                                <span key={b}><Check size={15} /> {b}</span>
                            ))}
                        </div>
                    </div>

                    <div className="z-hero-media">
                        <img src="/hero_mockup_mixer_1772898901088.png" alt="Zion Stage Multitrack Mixer" />
                        <div className="z-hero-caption">
                            <span>{c.hero.caption}</span>
                            <span className="z-live-dot">{c.hero.live}</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4 Pilares principales (como "How Loop Community helps you") */}
            <section id="programa" className="z-section">
                <div className="z-wrap">
                    <div className="z-section-head-center">
                        <div className="z-eyebrow">{c.pillars.eyebrow}</div>
                        <h2 className="z-h2">{c.pillars.title}</h2>
                        <p className="z-lead">{c.pillars.lead}</p>
                    </div>
                    <div className="z-grid-4">
                        {c.pillars.items.map((it) => (
                            <div key={it.t} className="z-card">
                                <div className="z-icon-box"><PillarIcon name={it.icon} /></div>
                                <h3 className="z-h3">{it.t}</h3>
                                <p>{it.d}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Showcase 1: La consola (estilo sección Prime App de Loop) */}
            <section id="funciones" className="z-section z-section-gray">
                <div className="z-wrap z-split">
                    <div className="z-photo-frame">
                        <img src="/hero_banner_studio.png" alt="Zion Stage en iPad en estudio" />
                    </div>
                    <div>
                        <div className="z-eyebrow">{c.appShowcase.eyebrow}</div>
                        <h2 className="z-h2">{c.appShowcase.title}</h2>
                        <p className="z-lead">{c.appShowcase.lead}</p>
                        <ul className="z-list">
                            {c.appShowcase.checks.map((item) => (
                                <li key={item}><Check size={18} /><span>{item}</span></li>
                            ))}
                        </ul>
                        <button className="z-btn z-btn-primary" onClick={() => openRegister()}>
                            {c.appShowcase.cta} <ArrowRight size={17} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Showcase 2: Nube y 3 pasos */}
            <section className="z-section">
                <div className="z-wrap z-split">
                    <div>
                        <div className="z-eyebrow">{c.cloudShowcase.eyebrow}</div>
                        <h2 className="z-h2">{c.cloudShowcase.title}</h2>
                        <p className="z-lead">{c.cloudShowcase.lead}</p>
                        <div className="z-steps">
                            {c.cloudShowcase.steps.map((s, i) => (
                                <div key={s.t} className="z-step-item">
                                    <span className="z-step-num">{i + 1}</span>
                                    <div>
                                        <h3 className="z-h3">{s.t}</h3>
                                        <p>{s.d}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="z-photo-frame">
                        <img src="/worship_community_banner_1772898920206.png" alt="Banda tocando en vivo con Zion Stage" />
                    </div>
                </div>
            </section>

            {/* Precios: Modo Gratis de lanzamiento (5 GB) o Planes de pago Estándar/VIP */}
            <section id="precios" className="z-section z-section-dark">
                <div className="z-wrap">
                    {!PAID_PLANS_ENABLED ? (
                        <>
                            <div className="z-section-head-center">
                                <div className="z-eyebrow">{lang === 'en' ? 'Free Launch Access' : 'Acceso Gratuito de Lanzamiento'}</div>
                                <h2 className="z-h2">{lang === 'en' ? 'Start 100% free with 5 GB in the cloud' : 'Empieza 100% gratis con 5 GB en la nube'}</h2>
                                <p className="z-lead">
                                    {lang === 'en'
                                        ? 'Create your free account, upload your own multitracks, and use every mixer feature across Web, iOS, Android, and Windows — no credit card required.'
                                        : 'Crea tu cuenta gratis, sube tus propios multitracks y usa todas las funciones del mixer en Web, iOS, Android y Windows — sin tarjeta de crédito.'}
                                </p>
                            </div>
                            <div style={{ maxWidth: 480, margin: '0 auto' }}>
                                <div className="z-plan vip">
                                    <span className="z-plan-tag">{lang === 'en' ? 'Free Account · No card needed' : 'Cuenta Gratis · Sin tarjeta'}</span>
                                    <h3 className="z-h3" style={{ fontSize: '1.45rem' }}>{lang === 'en' ? 'Zion Stage Free' : 'Plan Gratis'}</h3>
                                    <p className="z-muted" style={{ margin: '8px 0 0', fontSize: '0.94rem' }}>
                                        {lang === 'en'
                                            ? 'Everything you need to upload and run your band’s multitracks live.'
                                            : 'Todas las herramientas para subir y mezclar los multitracks de tu banda en vivo.'}
                                    </p>
                                    <div className="z-plan-price">
                                        <strong>$0</strong>
                                        <span className="z-muted" style={{ fontWeight: 600 }}>{lang === 'en' ? '/forever' : '/gratis'}</span>
                                    </div>
                                    <ul className="z-list">
                                        <li><Check size={17} /><span>{lang === 'en' ? `${FREE_LAUNCH_STORAGE_GB} GB free cloud storage` : `${FREE_LAUNCH_STORAGE_GB} GB de almacenamiento gratis en la nube`}</span></li>
                                        <li><Check size={17} /><span>{lang === 'en' ? 'Unlimited songs & unlimited setlists' : 'Canciones y setlists ilimitados'}</span></li>
                                        <li><Check size={17} /><span>{lang === 'en' ? 'Upload & mix your own multitracks (.MP3, .WAV, .ZIP)' : 'Sube y mezcla tus propios multitracks (.MP3, .WAV, .ZIP)'}</span></li>
                                        <li><Check size={17} /><span>{lang === 'en' ? 'All features: Pitch, BPM, Ambient Pads, Lyrics & Chords' : 'Todas las funciones: Tono, BPM, Ambient Pads, Letras y Acordes'}</span></li>
                                        <li><Check size={17} /><span>{lang === 'en' ? 'Global access: Web, iOS, Android & Windows' : 'Acceso en Web, iOS, Android y Windows'}</span></li>
                                    </ul>
                                    <button className="z-btn z-btn-primary z-btn-block" onClick={() => openRegister()}>
                                        {c.hero.cta} <ArrowRight size={17} />
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                    <>
                    <div className="z-section-head-center">
                        <div className="z-eyebrow">{c.plans.eyebrow}</div>
                        <h2 className="z-h2">{c.plans.title}</h2>
                        <p className="z-lead">{c.plans.lead}</p>
                    </div>

                    <div className="z-toggle-wrap">
                        <div className="z-toggle" role="group">
                            <button className={!annual ? 'on' : ''} onClick={() => setAnnual(false)}>{c.plans.monthly}</button>
                            <button className={annual ? 'on' : ''} onClick={() => setAnnual(true)}>
                                {c.plans.annual}<small>{c.plans.save}</small>
                            </button>
                        </div>
                    </div>

                    <div className="z-promo-box">
                        <div>
                            <div style={{ fontWeight: 800, fontSize: '0.98rem', color: '#ffffff' }}>
                                {lang === 'en'
                                    ? 'Try your 1st month for just $0.99 USD'
                                    : 'Prueba tu primer mes por solo $0.99 USD'}
                            </div>
                            <div style={{ fontSize: '0.85rem', color: '#b7c4cc', marginTop: 3 }}>
                                {lang === 'en'
                                    ? 'Enter code ZION99 at checkout on any monthly plan. Limit 1 use per email.'
                                    : 'Ingresa el código ZION99 al pagar en cualquier plan mensual. Válido 1 sola vez por correo.'}
                            </div>
                        </div>
                        <button type="button" className="z-promo-code" onClick={copyPromoCode} style={{ padding: '8px 14px', fontSize: '0.92rem' }}>
                            ZION99 <Copy size={15} /> {copiedCode ? (lang === 'en' ? 'Copied!' : '¡Copiado!') : ''}
                        </button>
                    </div>

                    <div className="z-plans">
                        {PLANS.map((p) => {
                            const txt = p.vip ? c.plans.vip : c.plans.std;
                            const price = annual ? p.annual : p.monthly;
                            return (
                                <div key={p.id} className={`z-plan${p.vip ? ' vip' : ''}`}>
                                    {p.vip && <span className="z-plan-tag">{c.plans.vip.tag}</span>}
                                    <h3 className="z-h3" style={{ fontSize: '1.4rem' }}>{txt.name}</h3>
                                    <p className="z-muted" style={{ margin: '8px 0 0', fontSize: '0.94rem' }}>{txt.desc}</p>
                                    <div className="z-plan-price">
                                        <strong>{money(price)}</strong>
                                        <span className="z-muted" style={{ fontWeight: 600 }}>{annual ? c.plans.perYear : c.plans.perMonth}</span>
                                    </div>
                                    <div className="z-muted" style={{ fontSize: '0.84rem' }}>
                                        {annual ? `${c.plans.billedYear} (${money(p.annual / 12)}${c.plans.perMonth})` : c.plans.billedMonth}
                                    </div>
                                    <ul className="z-list">
                                        <li><Check size={17} /><span>{c.plans.f.devices}</span></li>
                                        <li><Check size={17} /><span>{c.plans.f.own}</span></li>
                                        <li><Check size={17} /><span>{c.plans.f.storage(p.storage)}</span></li>
                                        <li><Check size={17} /><span>{c.plans.f.setlists}</span></li>
                                        <li className={p.vip ? '' : 'z-off'}>
                                            {p.vip ? <Check size={17} /> : <Minus size={17} />}
                                            <span>{c.plans.f.catalog}</span>
                                        </li>
                                    </ul>
                                    <button
                                        className={`z-btn ${p.vip ? 'z-btn-primary' : 'z-btn-dark'} z-btn-block`}
                                        onClick={() => openRegister(p.id)}
                                    >
                                        {c.plans.cta}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    </>
                    )}
                </div>
            </section>

            {/* Descargas multiplataforma */}
            <section id="descargas" className="z-section">
                <div className="z-wrap">
                    <div className="z-section-head-center">
                        <div className="z-eyebrow">{c.dl.eyebrow}</div>
                        <h2 className="z-h2">{c.dl.title}</h2>
                        <p className="z-lead">{c.dl.lead}</p>
                    </div>
                    <div className="z-grid-4">
                        <div className="z-card z-dl">
                            <div className="z-icon-box"><Globe size={22} /></div>
                            <h3 className="z-h3">{c.dl.web.t}</h3>
                            <p>{c.dl.web.d}</p>
                            <button className="z-btn z-btn-primary z-btn-block" onClick={() => navigate('/multitrack')}>{c.dl.web.b}</button>
                        </div>
                        <div className="z-card z-dl">
                            <div className="z-icon-box"><Apple size={22} /></div>
                            <h3 className="z-h3">{c.dl.ios.t}</h3>
                            <p>{c.dl.ios.d}</p>
                            <button className="z-btn z-btn-ghost z-btn-block" onClick={() => scrollTo('precios')}>{c.dl.ios.b}</button>
                        </div>
                        <div className="z-card z-dl">
                            <div className="z-icon-box"><Smartphone size={22} /></div>
                            <h3 className="z-h3">{c.dl.and.t}</h3>
                            <p>{c.dl.and.d}</p>
                            <a className="z-btn z-btn-dark z-btn-block" href={PLAY_URL} target="_blank" rel="noopener noreferrer">{c.dl.and.b}</a>
                        </div>
                        <div className="z-card z-dl">
                            <div className="z-icon-box"><Monitor size={22} /></div>
                            <h3 className="z-h3">{c.dl.win.t}</h3>
                            <p>{c.dl.win.d}</p>
                            <a className="z-btn z-btn-dark z-btn-block" href={windowsUrl} target="_blank" rel="noopener noreferrer">{c.dl.win.b}</a>
                        </div>
                    </div>
                </div>
            </section>

            {/* Preguntas frecuentes */}
            <section id="preguntas" className="z-section z-section-gray">
                <div className="z-wrap">
                    <div className="z-section-head-center">
                        <div className="z-eyebrow">{c.faq.eyebrow}</div>
                        <h2 className="z-h2">{c.faq.title}</h2>
                    </div>
                    <div className="z-faq">
                        {c.faq.items.map((f) => (
                            <details key={f.q}>
                                <summary>{f.q}</summary>
                                <p>{f.a}</p>
                            </details>
                        ))}
                    </div>
                </div>
            </section>

            {/* Banda final */}
            <section className="z-cta-band">
                <div className="z-wrap">
                    <h2 className="z-h2">{c.cta.title}</h2>
                    <p className="z-lead">{c.cta.sub}</p>
                    <div className="z-cta-row" style={{ justifyContent: 'center' }}>
                        <button className="z-btn z-btn-primary" onClick={() => openRegister()}>
                            {c.cta.b} <ArrowRight size={17} />
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer oscuro */}
            <footer className="z-footer">
                <div className="z-wrap">
                    <div className="z-footer-grid">
                        <div>
                            <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: 30, marginBottom: 14 }} />
                            <p style={{ fontSize: '0.9rem', margin: 0, maxWidth: 270, lineHeight: 1.6 }}>{c.footer.desc}</p>
                        </div>
                        <div>
                            <h4>{c.footer.product}</h4>
                            <button className="z-flink" onClick={() => scrollTo('programa')}>{c.nav.program}</button>
                            <button className="z-flink" onClick={() => scrollTo('funciones')}>{c.nav.features}</button>
                            <button className="z-flink" onClick={() => scrollTo('precios')}>{c.nav.plans}</button>
                            <button className="z-flink" onClick={() => scrollTo('descargas')}>{c.nav.downloads}</button>
                        </div>
                        <div>
                            <h4>{c.footer.help}</h4>
                            <button className="z-flink" onClick={() => navigate('/recursos')}>{c.footer.resources}</button>
                            <button className="z-flink" onClick={() => navigate('/contact')}>{c.footer.contact}</button>
                            <button className="z-flink" onClick={() => scrollTo('preguntas')}>{c.nav.faq}</button>
                        </div>
                        <div>
                            <h4>{c.footer.legal}</h4>
                            <button className="z-flink" onClick={() => navigate('/privacy')}>{c.footer.privacy}</button>
                            <button className="z-flink" onClick={() => navigate('/terms')}>{c.footer.terms}</button>
                            <button className="z-flink" onClick={() => navigate('/delete')}>{c.footer.del}</button>
                        </div>
                    </div>
                    <div className="z-footer-bottom">© {new Date().getFullYear()} Zion Stage. {c.footer.rights}</div>
                </div>
            </footer>

            <AuthModal
                open={!!authMode}
                mode={authMode || 'register'}
                lang={lang}
                onClose={() => setAuthMode(null)}
                onDone={() => { setAuthMode(null); navigate('/dashboard'); }}
            />
        </div>
    );
}
