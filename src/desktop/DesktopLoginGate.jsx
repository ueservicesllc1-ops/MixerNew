import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { LocalAuthService } from './LocalAuthService';
import { DesktopSessionService } from './DesktopSessionService';

export default function DesktopLoginGate({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(DesktopSessionService.isOnline());

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isOnline) {
                // ONLINE FLOW
                let userCredential;
                if (authMode === 'login') {
                    userCredential = await signInWithEmailAndPassword(auth, email, password);
                } else {
                    userCredential = await createUserWithEmailAndPassword(auth, email, password);
                }
                
                const user = userCredential.user;
                const userData = {
                    uid: user.uid,
                    email: user.email,
                    displayName: user.displayName || email.split('@')[0]
                };

                // Guardar para uso offline
                await LocalAuthService.saveLocalUser(email, password, userData);
                DesktopSessionService.setCurrentSession(userData);
                onLoginSuccess(userData);
            } else {
                // OFFLINE FLOW
                if (!LocalAuthService.hasLocalUser()) {
                    throw new Error("Necesitas iniciar sesión al menos una vez con internet para usar Zion offline.");
                }

                if (authMode === 'register') {
                    throw new Error("No puedes registrar una cuenta nueva en modo offline. Conéctate a internet.");
                }

                const isValid = await LocalAuthService.validateOfflineLogin(email, password);
                if (isValid) {
                    const localData = await LocalAuthService.getLocalUserData();
                    DesktopSessionService.setCurrentSession(localData || { email, isOffline: true });
                    onLoginSuccess(localData || { email, isOffline: true });
                } else {
                    throw new Error("Credenciales inválidas para el modo offline.");
                }
            }
        } catch (err) {
            setError(err.message || 'Error de autenticación');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 2000000,
            background: 'linear-gradient(160deg, #0f172a 0%, #020617 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            fontFamily: '"Inter", sans-serif'
        }}>
            <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                padding: '50px 40px',
                borderRadius: '24px',
                width: '400px',
                border: '1px solid rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                textAlign: 'center'
            }}>
                <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '50px', marginBottom: '30px' }} />
                
                {!isOnline && (
                    <div style={{
                        background: '#f59e0b22', color: '#f59e0b', padding: '8px', 
                        borderRadius: '8px', marginBottom: '20px', fontSize: '0.85rem', fontWeight: 'bold'
                    }}>
                        Modo Offline Activado
                    </div>
                )}

                <h1 style={{ color: 'white', fontSize: '1.8rem', fontWeight: '800', marginBottom: '8px' }}>
                    {authMode === 'login' ? 'Bienvenido a Zion' : 'Únete a Zion'}
                </h1>
                <p style={{ color: '#94a3b8', fontSize: '0.95rem', marginBottom: '32px' }}>
                    {authMode === 'login' 
                        ? 'Inicia sesión para acceder al mixer' 
                        : 'Crea tu cuenta para empezar a ensayar'}
                </p>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <input 
                        type="email" 
                        placeholder="Correo electrónico" 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        required
                        style={{ 
                            width: '100%', padding: '14px 16px', borderRadius: '12px', 
                            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.6)', 
                            color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                        }} 
                    />
                    <input 
                        type="password" 
                        placeholder="Contraseña" 
                        value={password} 
                        onChange={e => setPassword(e.target.value)} 
                        required
                        style={{ 
                            width: '100%', padding: '14px 16px', borderRadius: '12px', 
                            border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15, 23, 42, 0.6)', 
                            color: 'white', fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
                        }} 
                    />

                    {error && (
                        <div style={{ 
                            background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', 
                            padding: '12px', borderRadius: '10px', marginTop: '4px', fontSize: '0.85rem' 
                        }}>
                            {error}
                        </div>
                    )}

                    <button 
                        type="submit"
                        disabled={isLoading}
                        style={{ 
                            width: '100%', padding: '15px', background: '#00d2d3', 
                            border: 'none', borderRadius: '12px', color: 'white', 
                            fontWeight: '700', fontSize: '1rem', marginTop: '16px', 
                            cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        {isLoading ? 'Cargando...' : (authMode === 'login' ? 'Entrar ahora' : 'Comenzar Registro')}
                    </button>
                </form>

                {isOnline && (
                    <div style={{ textAlign: 'center', marginTop: '24px' }}>
                        <button 
                            onClick={() => {
                                setAuthMode(authMode === 'login' ? 'register' : 'login');
                                setError('');
                            }} 
                            style={{ background: 'none', border: 'none', color: '#00bcd4', fontSize: '0.85rem', cursor: 'pointer' }}
                        >
                            {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
