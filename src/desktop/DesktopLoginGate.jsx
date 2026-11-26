import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { LocalAuthService } from './LocalAuthService';
import { DesktopSessionService } from './DesktopSessionService';
import { LOGO_BLANCO_PNG } from '../utils/publicAssets.js';
import { PAID_PLANS_ENABLED, FREE_LAUNCH_STORAGE_GB } from '../config/features';
import { getMixerApiBase } from '../mixerApiBase';

const EXEMPT_VERIFY_EMAILS = new Set(['ueservicesllc1@gmail.com', '123@gmail.com']);

export default function DesktopLoginGate({ onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOnline, setIsOnline] = useState(DesktopSessionService.isOnline());
    const [resetMsg, setResetMsg] = useState('');

    // Email verification gate (Online)
    const [pendingVerifyUser, setPendingVerifyUser] = useState(null);
    const [verifyChecking, setVerifyChecking] = useState(false);
    const [verifyResending, setVerifyResending] = useState(false);
    const [verifyFeedback, setVerifyFeedback] = useState('');

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

    const openSignUpWeb = () => {
        const url = 'https://zionstage.live';
        if (typeof window !== 'undefined' && typeof window.zionNative?.openExternalUrl === 'function') {
            window.zionNative.openExternalUrl(url).catch(() => {
                window.open(url, '_blank', 'noopener,noreferrer');
            });
        } else {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    const completeOnlineLogin = async (user, rawEmail, rawPassword) => {
        const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || (user.email || rawEmail).split('@')[0],
        };
        await LocalAuthService.saveLocalUser(rawEmail || user.email, rawPassword, userData);
        DesktopSessionService.setCurrentSession(userData);
        onLoginSuccess(userData);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setResetMsg('');
        setVerifyFeedback('');
        setIsLoading(true);

        const cleanEmail = email.trim();

        try {
            if (isOnline) {
                const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
                const user = userCredential.user;
                try { await user.reload(); } catch { /* ignore */ }

                const refreshed = auth.currentUser || user;
                const isExempt = EXEMPT_VERIFY_EMAILS.has(String(refreshed.email || '').trim().toLowerCase());
                if (!refreshed.emailVerified && !isExempt) {
                    setPendingVerifyUser(refreshed);
                    return;
                }

                await completeOnlineLogin(refreshed, cleanEmail, password);
            } else {
                // OFFLINE FLOW (100% preserved for local multitracks without internet)
                if (!LocalAuthService.hasLocalUser()) {
                    throw new Error('Necesitas iniciar sesión al menos una vez con internet para usar Zion offline.');
                }

                const isValid = await LocalAuthService.validateOfflineLogin(cleanEmail, password);
                if (isValid) {
                    const localData = await LocalAuthService.getLocalUserData();
                    DesktopSessionService.setCurrentSession(localData || { email: cleanEmail, isOffline: true });
                    onLoginSuccess(localData || { email: cleanEmail, isOffline: true });
                } else {
                    throw new Error('Credenciales inválidas para el modo offline.');
                }
            }
        } catch (err) {
            const code = err?.code || '';
            if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
                setError('Correo o contraseña incorrectos.');
            } else if (code === 'auth/user-not-found') {
                setError('No existe una cuenta con ese correo.');
            } else {
                setError(err.message || 'Error de autenticación');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleCheckEmailVerified = async () => {
        if (!auth.currentUser) return;
        setVerifyChecking(true);
        setVerifyFeedback('');
        try {
            await auth.currentUser.reload();
            if (auth.currentUser.emailVerified) {
                await completeOnlineLogin(auth.currentUser, email.trim(), password);
            } else {
                setVerifyFeedback('Todavía no aparece verificado. Abre el enlace en tu correo y vuelve a intentar.');
            }
        } catch (err) {
            setVerifyFeedback(err?.message || 'Error al comprobar la verificación.');
        } finally {
            setVerifyChecking(false);
        }
    };

    const handleResendVerification = async () => {
        if (!auth.currentUser) return;
        setVerifyResending(true);
        setVerifyFeedback('');
        try {
            const idToken = await auth.currentUser.getIdToken();
            const resp = await fetch(`${getMixerApiBase()}/api/auth/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || data.fallbackToFirebase) {
                await sendEmailVerification(auth.currentUser);
            }
            setVerifyFeedback(`Listo. Enviamos un nuevo enlace a ${auth.currentUser.email}. Revisa tu bandeja o Spam.`);
        } catch (err) {
            setVerifyFeedback(err?.message || 'Espera un minuto antes de reenviar el correo.');
        } finally {
            setVerifyResending(false);
        }
    };

    const handleCancelVerification = async () => {
        try { await signOut(auth); } catch { /* ignore */ }
        setPendingVerifyUser(null);
        setVerifyFeedback('');
    };

    const handleForgotPassword = async () => {
        setError('');
        setResetMsg('');
        if (!email.trim()) {
            setError('Ingresá tu correo para recuperar la contraseña.');
            return;
        }
        if (!isOnline) {
            setError('Conectate a internet para recuperar la contraseña.');
            return;
        }
        setIsLoading(true);
        try {
            await sendPasswordResetEmail(auth, email.trim());
            setResetMsg('Revisá tu correo: te enviamos un enlace para restablecer la contraseña.');
        } catch (err) {
            const code = err?.code || '';
            if (code === 'auth/user-not-found') {
                setError('No hay cuenta con ese correo.');
            } else if (code === 'auth/invalid-email') {
                setError('El correo no es válido.');
            } else {
                setError(err?.message || 'No se pudo enviar el correo.');
            }
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
                padding: '44px 38px',
                borderRadius: '24px',
                width: '420px',
                maxWidth: '92vw',
                border: '1px solid rgba(255,255,255,0.08)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                textAlign: 'center'
            }}>
                <img src={LOGO_BLANCO_PNG} alt="Zion Stage" style={{ height: '48px', marginBottom: '26px' }} />

                {pendingVerifyUser ? (
                    <div>
                        <h1 style={{ color: 'white', fontSize: '1.5rem', fontWeight: '800', marginBottom: '10px' }}>
                            Confirma tu correo electrónico
                        </h1>
                        <p style={{ color: '#cbd5e1', fontSize: '0.92rem', lineHeight: 1.55, marginBottom: '20px' }}>
                            Enviamos un enlace de verificación a <strong style={{ color: '#22d3ee' }}>{pendingVerifyUser.email}</strong>. Ábrelo para activar tu cuenta y entrar al mixer de escritorio.
                        </p>
                        {verifyFeedback && (
                            <div style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.35)', color: '#67e8f9', padding: '10px 12px', borderRadius: '10px', fontSize: '0.84rem', marginBottom: '16px', lineHeight: 1.45 }}>
                                {verifyFeedback}
                            </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={handleCheckEmailVerified}
                                disabled={verifyChecking}
                                style={{ width: '100%', padding: '14px', background: '#00d2d3', border: 'none', borderRadius: '12px', color: '#000', fontWeight: '800', fontSize: '0.96rem', cursor: 'pointer' }}
                            >
                                {verifyChecking ? 'Comprobando...' : 'Ya confirmé mi correo'}
                            </button>
                            <button
                                type="button"
                                onClick={handleResendVerification}
                                disabled={verifyResending}
                                style={{ width: '100%', padding: '12px', background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: '12px', color: 'white', fontWeight: '700', fontSize: '0.9rem', cursor: 'pointer' }}
                            >
                                {verifyResending ? 'Enviando...' : 'Reenviar enlace de confirmación'}
                            </button>
                            <button
                                type="button"
                                onClick={handleCancelVerification}
                                style={{ width: '100%', padding: '9px', background: 'transparent', border: 'none', color: '#94a3b8', fontSize: '0.85rem', cursor: 'pointer' }}
                            >
                                Usar otra cuenta
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {!isOnline && (
                            <div style={{
                                background: '#f59e0b22', color: '#f59e0b', padding: '8px',
                                borderRadius: '8px', marginBottom: '18px', fontSize: '0.85rem', fontWeight: 'bold'
                            }}>
                                Modo Offline Activado (Multitracks Locales)
                            </div>
                        )}

                        <h1 style={{ color: 'white', fontSize: '1.75rem', fontWeight: '800', marginBottom: '8px' }}>
                            Bienvenido a Zion Stage
                        </h1>
                        <p style={{ color: '#94a3b8', fontSize: '0.94rem', marginBottom: '26px' }}>
                            Inicia sesión para acceder al mixer y tus multitracks locales
                        </p>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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

                            {isOnline && (
                                <button
                                    type="button"
                                    onClick={handleForgotPassword}
                                    disabled={isLoading}
                                    style={{
                                        alignSelf: 'flex-end',
                                        marginTop: '-4px',
                                        background: 'none',
                                        border: 'none',
                                        color: '#22d3ee',
                                        fontSize: '0.85rem',
                                        fontWeight: '600',
                                        cursor: isLoading ? 'not-allowed' : 'pointer',
                                        textDecoration: 'underline',
                                        textUnderlineOffset: '3px',
                                    }}
                                >
                                    ¿Olvidaste tu contraseña?
                                </button>
                            )}

                            {error && (
                                <div style={{
                                    background: 'rgba(239, 68, 68, 0.1)', color: '#f87171',
                                    padding: '12px', borderRadius: '10px', marginTop: '4px', fontSize: '0.85rem'
                                }}>
                                    {error}
                                </div>
                            )}
                            {resetMsg && (
                                <div style={{
                                    background: 'rgba(74, 222, 128, 0.12)', color: '#86efac',
                                    padding: '12px', borderRadius: '10px', marginTop: '4px', fontSize: '0.85rem', lineHeight: 1.45,
                                }}>
                                    {resetMsg}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                style={{
                                    width: '100%', padding: '15px', background: '#00d2d3',
                                    border: 'none', borderRadius: '12px', color: '#000',
                                    fontWeight: '800', fontSize: '1rem', marginTop: '10px',
                                    cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.7 : 1
                                }}
                            >
                                {isLoading ? 'Cargando...' : 'INICIAR SESIÓN'}
                            </button>
                        </form>

                        {isOnline && (
                            <div style={{ marginTop: '22px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                    <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>¿No tienes cuenta?</span>
                                    <button
                                        type="button"
                                        onClick={openSignUpWeb}
                                        style={{
                                            padding: '6px 14px',
                                            borderRadius: '8px',
                                            background: 'rgba(0, 210, 211, 0.14)',
                                            border: '1px solid rgba(0, 210, 211, 0.45)',
                                            color: '#00d2d3',
                                            fontSize: '0.88rem',
                                            fontWeight: '800',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Unirte ↗
                                    </button>
                                </div>
                                {!PAID_PLANS_ENABLED && (
                                    <span style={{ color: '#4ade80', fontSize: '0.8rem', fontWeight: '600' }}>
                                        Gratis {FREE_LAUNCH_STORAGE_GB} GB + Global VIP en zionstage.live
                                    </span>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
