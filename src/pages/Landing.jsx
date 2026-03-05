import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { Search, ShoppingCart } from 'lucide-react';

export default function Landing() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');
    const [showLoginPanel, setShowLoginPanel] = useState(false);

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            navigate('/dashboard');
        } catch (error) {
            console.error("Auth error:", error);
            setErrorMsg(error.message);
        }
    };

    const handleGoogleAuth = async () => {
        setErrorMsg('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            navigate('/dashboard');
        } catch (error) {
            console.error("Google Auth error:", error);
            setErrorMsg(error.message);
        }
    };

    return (
        <div style={{ backgroundColor: '#1c1c1e', minHeight: '100vh', width: '100vw', margin: 0, padding: 0, overflowX: 'hidden', color: 'white', fontFamily: '"Inter", "Segoe UI", sans-serif' }}>

            {/* TOP INFOBAR */}
            <div style={{ backgroundColor: '#21262d', padding: '10px 0', fontSize: '0.8rem', textAlign: 'center', letterSpacing: '1px' }}>
                <span style={{ color: '#ccc' }}>PRUEBA LA NUEVA VERSIÓN DE MIXER</span>
                <span style={{ color: '#00d2d3', marginLeft: '10px', textDecoration: 'underline', cursor: 'pointer' }}>ÚNETE AHORA</span>
            </div>

            {/* NAVBAR */}
            <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 50px', backgroundColor: '#2a2a2c', borderBottom: '1px solid #333' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <div style={{ width: '28px', height: '28px', backgroundColor: '#00d2d3', borderRadius: '50%', border: '4px solid #1c1c1e', boxShadow: '0 0 0 2px #00d2d3' }}></div>
                        <span style={{ fontSize: '1.2rem', fontWeight: '800', letterSpacing: '0.5px' }}>MixCommunity</span>
                    </div>

                    <div style={{ display: 'flex', gap: '25px', marginLeft: '20px', fontSize: '0.9rem', fontWeight: '600', color: '#ccc' }}>
                        <span style={{ cursor: 'pointer' }}>Canciones ▾</span>
                        <span style={{ cursor: 'pointer' }}>Productos ▾</span>
                        <span style={{ cursor: 'pointer' }}>Recursos ▾</span>
                        <span style={{ cursor: 'pointer' }}>Mixer™</span>
                        <span style={{ cursor: 'pointer' }}>Ayuda</span>
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <span onClick={() => setShowLoginPanel(true)} style={{ cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold' }}>Iniciar sesión</span>
                    <button onClick={() => { setIsLogin(false); setShowLoginPanel(true); }} style={{ backgroundColor: '#00bcd4', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.9rem' }}>
                        Únete gratis
                    </button>
                    <ShoppingCart size={20} color="#ccc" style={{ cursor: 'pointer' }} />
                    <Search size={20} color="#ccc" style={{ cursor: 'pointer' }} />
                </div>
            </nav>

            {/* HERO SECTION */}
            <main style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '60px 80px', maxWidth: '1400px', margin: '0 auto', gap: '40px' }}>

                {/* LEFT TEXT */}
                <div style={{ flex: '1', maxWidth: '500px' }}>
                    <h1 style={{ fontSize: '3.8rem', fontWeight: 'bold', lineHeight: '1.1', margin: '0 0 30px 0' }}>
                        Pistas para<br />la adoración<br />simplificadas
                    </h1>
                    <p style={{ fontSize: '1.1rem', color: '#aaa', lineHeight: '1.6', marginBottom: '40px' }}>
                        MixCommunity ofrece a los líderes de alabanza pistas, hardware, software y capacitación de calidad y a precios accesibles. Simplificamos lo complicado para que usted pueda concentrarse en lo importante.
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                        <button onClick={() => { setIsLogin(false); setShowLoginPanel(true); }} style={{ backgroundColor: '#00bcd4', color: 'white', border: 'none', padding: '15px 30px', borderRadius: '4px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer' }}>
                            Regístrate gratis
                        </button>
                        <span style={{ color: '#00bcd4', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            ▶ ¿Por qué utilizar Mixer?
                        </span>
                    </div>
                </div>

                {/* RIGHT IMAGE/MOCKUP AREA */}
                <div style={{ flex: '1.2', position: 'relative', display: 'flex', justifyContent: 'center' }}>
                    {/* Fake Laptop Screen mockup */}
                    <div style={{
                        width: '100%',
                        maxWidth: '700px',
                        aspectRatio: '16/10',
                        backgroundColor: '#111',
                        borderRadius: '12px 12px 0 0',
                        border: '8px solid #333',
                        borderBottomWidth: '20px',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                        position: 'relative',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {/* Fake Browser Toolbar */}
                        <div style={{ height: '24px', backgroundColor: '#222', borderBottom: '1px solid #444', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '6px' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff5f56' }}></div>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ffbd2e' }}></div>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#27c93f' }}></div>
                        </div>
                        {/* Fake App Interface */}
                        <div style={{ flex: 1, backgroundColor: '#1c1c1e', padding: '15px' }}>
                            <div style={{ height: '60px', backgroundColor: '#2a2a2c', borderRadius: '8px', marginBottom: '10px', display: 'flex', alignItems: 'center', padding: '0 15px', gap: '15px' }}>
                                <div style={{ flex: 1, height: '30px', backgroundColor: '#333', borderRadius: '4px', display: 'flex', overflow: 'hidden' }}>
                                    <div style={{ width: '15%', backgroundColor: '#ff5252' }}></div>
                                    <div style={{ width: '25%', backgroundColor: '#2ecc71' }}></div>
                                    <div style={{ width: '40%', backgroundColor: '#00bcd4' }}></div>
                                    <div style={{ width: '20%', backgroundColor: '#9b59b6' }}></div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', height: 'calc(100% - 70px)' }}>
                                <div style={{ flex: 1, backgroundColor: '#2a2a2c', borderRadius: '8px', position: 'relative' }}>
                                    <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', height: '60%', backgroundColor: '#00d2d3', opacity: 0.8, borderRadius: '4px' }}></div>
                                </div>
                                <div style={{ flex: 1, backgroundColor: '#2a2a2c', borderRadius: '8px', position: 'relative' }}>
                                    <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', height: '80%', backgroundColor: '#e74c3c', opacity: 0.8, borderRadius: '4px' }}></div>
                                </div>
                                <div style={{ flex: 1, backgroundColor: '#2a2a2c', borderRadius: '8px', position: 'relative' }}>
                                    <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px', height: '40%', backgroundColor: '#f39c12', opacity: 0.8, borderRadius: '4px' }}></div>
                                </div>
                                <div style={{ flex: 1.5, backgroundColor: '#111', borderRadius: '8px', border: '1px solid #333', padding: '10px' }}>
                                    {/* Fake Setlist */}
                                    {['House Of The Lord', 'Firm Foundation', 'Praise'].map((s, i) => (
                                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #222', fontSize: '0.7rem' }}>
                                            <span style={{ color: '#eee' }}>{s}</span>
                                            <span style={{ color: '#00bcd4' }}>120 BPM</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* TRACKS SECTION (LoopCommunity Clone Content) */}
            <section style={{ backgroundColor: '#1c1c1e', padding: '60px 80px', maxWidth: '1400px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '50px' }}>
                    <h2 style={{ fontSize: '2.5rem', margin: '0 0 15px 0' }}>Pistas para la adoración simplificadas</h2>
                    <p style={{ color: '#aaa', fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto' }}>
                        MixCommunity ofrece a los líderes de alabanza pistas, hardware, software y capacitación de calidad y a precios accesibles. Hacemos lo complicado simple.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '40px' }}>
                    {/* Left Column - Playlists/Categories */}
                    <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: '1.5rem', borderBottom: '1px solid #333', paddingBottom: '15px', marginBottom: '20px' }}>Top Tracks</h3>
                        <p style={{ color: '#aaa', marginBottom: '30px' }}>Miles de multitracks para las canciones que aman los líderes de alabanza.</p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {[
                                { title: 'Tracks Originales (Master)', info: 'Pistas originales directo del artista.', color: '#00bcd4' },
                                { title: 'Tracks de la Comunidad', info: ' Creadas por líderes aprobados.', color: '#9b59b6' },
                                { title: 'Tracks Premium', info: 'Grabadas en estudio profesional.', color: '#f39c12' },
                                { title: 'Enhancement Tracks', info: 'Mejora el sonido de tu banda.', color: '#2ecc71' }
                            ].map((item, i) => (
                                <div key={i} style={{ backgroundColor: '#2a2a2c', padding: '20px', borderRadius: '8px', borderLeft: `4px solid ${item.color}`, cursor: 'pointer', transition: '0.2s' }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '1.1rem' }}>{item.title}</h4>
                                    <p style={{ margin: 0, color: '#888', fontSize: '0.9rem' }}>{item.info}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Right Column - Top Songs */}
                    <div style={{ flex: 1.2, backgroundColor: '#212124', padding: '30px', borderRadius: '12px', border: '1px solid #333' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ fontSize: '1.5rem', margin: 0 }}>Top 10 Canciones de este Mes</h3>
                            <span style={{ color: '#00bcd4', fontSize: '0.9rem', cursor: 'pointer' }}>Ver todas</span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {[
                                { song: 'WASHED', artist: 'ELEVATION RHYTHM' },
                                { song: "God I'm Just Grateful", artist: 'Elevation Worship' },
                                { song: 'Jesus Be The Name', artist: 'Elevation Worship' },
                                { song: 'Alleluia', artist: 'Elevation Worship' },
                                { song: 'I Know A Name', artist: 'Elevation Worship' },
                                { song: 'It Really Is Amazing Grace', artist: 'Phil Wickham & Crowder' },
                                { song: "Thank God I'm Free", artist: 'ELEVATION RHYTHM' },
                                { song: 'What A God (Live)', artist: 'SEU Worship' }
                            ].map((s, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '12px 0', borderBottom: '1px solid #333' }}>
                                    <div style={{ width: '30px', color: '#666', fontWeight: 'bold' }}>{i + 1}</div>
                                    <div style={{ width: '40px', height: '40px', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden' }}>
                                        <img src={`https://picsum.photos/40/40?random=${i}`} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 'bold', fontSize: '1rem', color: '#eee' }}>{s.song}</div>
                                        <div style={{ fontSize: '0.8rem', color: '#888' }}>{s.artist}</div>
                                    </div>
                                    <div style={{ marginLeft: 'auto', color: '#00bcd4', fontSize: '0.8rem', cursor: 'pointer', padding: '5px 10px', border: '1px solid #00bcd4', borderRadius: '4px' }}>
                                        Ver Tracks
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* FULLSCREEN LOGIN/REGISTER OVERLAY (LoopCommunity Style) */}
            {
                showLoginPanel && (
                    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: '#f0f0f0', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', overflowY: 'auto', fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', paddingBottom: '50px' }}>

                        {/* HEADER BANNER */}
                        <div style={{ width: '100%', maxWidth: '900px', backgroundColor: '#fff3cd', border: '1px solid #ffeeba', color: '#856404', padding: '15px 20px', borderRadius: '4px', marginTop: '40px', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <strong>¡Nuevo!</strong> Nos hemos asociado con WorshipTools para facilitar el inicio de sesión único. Si ya usaste tu correo electrónico en ambos sitios, ¡usa tus credenciales de WorshipTools para iniciar sesión ahora!
                        </div>

                        {/* CLOSE BUTTON */}
                        <button onClick={() => setShowLoginPanel(false)} style={{ position: 'absolute', top: '20px', right: '30px', background: 'transparent', border: 'none', color: '#666', fontSize: '2rem', cursor: 'pointer', fontWeight: 'bold' }}>&times;</button>

                        <div style={{ display: 'flex', width: '100%', maxWidth: '1000px', marginTop: '30px', gap: '50px', alignItems: 'flex-start', justifyContent: 'center', flexWrap: 'wrap', padding: '0 20px' }}>

                            {/* LEFT SIDE: FORM */}
                            <div style={{ flex: '1 1 400px', maxWidth: '450px', backgroundColor: 'white', padding: '40px', borderRadius: '4px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', marginBottom: '30px' }}>
                                    <div style={{ width: '35px', height: '35px', backgroundColor: '#00bcd4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{ width: '15px', height: '15px', backgroundColor: 'white', borderRadius: '50%' }}></div>
                                    </div>
                                    <span style={{ fontSize: '1.8rem', fontWeight: '800', color: '#333' }}>MixCommunity</span>
                                </div>

                                <div style={{ backgroundColor: '#e0f2f1', padding: '15px', borderRadius: '4px', fontSize: '0.85rem', color: '#00695c', marginBottom: '25px', lineHeight: '1.4' }}>
                                    Si anteriormente utilizó su nombre de usuario para iniciar sesión y no conoce el correo electrónico conectado, <strong>haga clic aquí</strong> para buscarlo.
                                </div>

                                {errorMsg && <div style={{ color: '#d32f2f', marginBottom: '15px', fontSize: '0.9rem', textAlign: 'center', backgroundColor: '#ffebee', padding: '10px', borderRadius: '4px' }}>{errorMsg}</div>}

                                <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <input
                                        type="email"
                                        placeholder="Correo electrónico"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        style={{ padding: '12px 15px', width: '100%', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', background: '#f5f7fa', fontSize: '1rem', color: '#333' }}
                                    />
                                    <input
                                        type="password"
                                        placeholder="Contraseña"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        style={{ padding: '12px 15px', width: '100%', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc', background: 'white', fontSize: '1rem', color: '#333' }}
                                    />
                                    <button type="submit" style={{ padding: '14px', background: '#00bcd4', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', marginTop: '10px' }}>
                                        {isLogin ? 'Acceso' : 'Registrarse'}
                                    </button>

                                    <button type="button" onClick={handleGoogleAuth} style={{ padding: '12px', background: 'white', color: '#555', border: '1px solid #ccc', borderRadius: '4px', fontWeight: 'bold', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '5px' }}>
                                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
                                        Entrar con Google
                                    </button>
                                </form>

                                <div style={{ marginTop: '25px', textAlign: 'center', fontSize: '0.95rem' }}>
                                    <p style={{ color: '#555', margin: '0 0 5px 0' }}>
                                        {isLogin ? '¿No tienes un login?' : '¿Ya tienes una cuenta?'}
                                        <span onClick={() => setIsLogin(!isLogin)} style={{ color: '#00bcd4', cursor: 'pointer', marginLeft: '5px' }}>
                                            {isLogin ? 'Inscribirse' : 'Acceso'}
                                        </span>
                                    </p>
                                    {isLogin && (
                                        <p style={{ margin: 0 }}>
                                            <span style={{ color: '#00bcd4', cursor: 'pointer' }}>¿Olvidaste tu contraseña?</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* RIGHT SIDE: TEXT / FEATURES */}
                            <div style={{ flex: '1 1 400px', maxWidth: '450px', display: 'flex', flexDirection: 'column', paddingTop: '20px' }}>
                                <h1 style={{ color: '#333', fontSize: '1.6rem', marginBottom: '10px' }}>¡Qué bueno verte!</h1>
                                <p style={{ color: '#666', fontSize: '1rem', marginBottom: '20px' }}>Todo sobre la adoración™ de MixCommunity y WorshipTools</p>

                                <ul style={{ color: '#444', fontSize: '0.95rem', lineHeight: '1.6', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '0' }}>
                                    <li>Recursos para más de 20.000 canciones: pistas, gráficos, diapositivas de letras y más</li>
                                    <li>Aplicaciones dinámicas para potenciar a su equipo de adoración: Prime Multitracks App y Charts Apps</li>
                                    <li>Integración perfecta con software integrado de planificación, presentación y gestión de iglesias</li>
                                </ul>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginTop: '40px' }}>
                                    {/* Mock logos */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', fontWeight: 'bold', fontSize: '1.5rem' }}>
                                        <div style={{ width: '25px', height: '25px', border: '3px solid #555', borderRadius: '4px', position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '10px', height: '10px', backgroundColor: '#555', borderRadius: '50%' }}></div>
                                        </div>
                                        WorshipTools
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#555', fontWeight: 'bold', fontSize: '1.5rem' }}>
                                        <div style={{ width: '25px', height: '25px', backgroundColor: '#555', borderRadius: '50%', position: 'relative' }}>
                                            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '8px', height: '8px', backgroundColor: '#f0f0f0', borderRadius: '50%' }}></div>
                                        </div>
                                        Loop
                                    </div>
                                </div>

                                <div style={{ display: 'flex', gap: '15px', marginTop: 'auto', paddingTop: '40px', fontSize: '0.8rem', color: '#999' }}>
                                    <span style={{ cursor: 'pointer' }}>Ayuda</span>
                                    <span style={{ cursor: 'pointer' }}>Privacidad</span>
                                    <span style={{ cursor: 'pointer' }}>Términos</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
