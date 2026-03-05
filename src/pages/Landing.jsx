import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function Landing() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLogin, setIsLogin] = useState(true);
    const [errorMsg, setErrorMsg] = useState('');

    const handleEmailAuth = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        try {
            if (isLogin) {
                await signInWithEmailAndPassword(auth, email, password);
            } else {
                await createUserWithEmailAndPassword(auth, email, password);
            }
            navigate('/dashboard'); // Ir al panel al triunfar
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
        <div style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
            <h1 style={{ fontSize: '3rem', color: '#00bcd4' }}>MultiTrack Omni-Play</h1>
            <p style={{ fontSize: '1.2rem', color: '#666', margin: '20px 0' }}>
                La plataforma perfecta para directores musicales. Reproduce mezclas multitrack sin desafase temporal,
                gestiona tus librerías y organiza tus sesiones. Todo en un solo lugar.
            </p>

            <div style={{ background: 'white', padding: '30px', borderRadius: '12px', marginTop: '40px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)' }}>
                <h2 style={{ color: '#333' }}>{isLogin ? 'Accede a tu cuenta' : 'Crear una cuenta nueva'}</h2>

                {errorMsg && <div style={{ color: 'red', marginBottom: '10px', fontSize: '0.9rem' }}>{errorMsg}</div>}

                <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '300px', margin: '20px auto' }}>
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ padding: '10px', width: '100%', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ccc', background: '#fafafa' }}
                    />
                    <input
                        type="password"
                        placeholder="Contraseña (mín. 6 caracteres)"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        style={{ padding: '10px', width: '100%', boxSizing: 'border-box', borderRadius: '5px', border: '1px solid #ccc', background: '#fafafa' }}
                    />
                    <button type="submit" style={{ padding: '10px', background: '#00d2d3', color: 'white', border: 'none', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer' }}>
                        {isLogin ? 'Entrar' : 'Registrarse'}
                    </button>
                </form>

                <div style={{ margin: '15px 0', color: '#888', fontSize: '0.9rem' }}>
                    o
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button onClick={handleGoogleAuth} style={{ padding: '10px 20px', background: '#white', color: '#333', border: '1px solid #ddd', borderRadius: '5px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" style={{ width: '18px' }} />
                        Entrar con Google
                    </button>
                </div>

                <div style={{ marginTop: '20px', fontSize: '0.9rem' }}>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        style={{ background: 'none', border: 'none', color: '#00bcd4', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                        {isLogin ? '¿No tienes cuenta? Regístrate aquí' : '¿Ya tienes cuenta? Inicia sesión'}
                    </button>
                </div>
            </div>
        </div>
    );
}
