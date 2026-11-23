import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { auth, db } from '../firebase';
import {
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup,
    GoogleAuthProvider, updateProfile, sendPasswordResetEmail, sendEmailVerification,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { getMixerApiBase } from '../mixerApiBase';
import './../styles/brand.css';

const TXT = {
    es: {
        loginTitle: 'Entrar a Zion Stage', registerTitle: 'Crea tu cuenta',
        loginSub: 'Usa el correo con el que te registraste.', registerSub: 'Después eliges tu plan y empiezas a usarlo en cualquier dispositivo.',
        name: 'Nombre', email: 'Correo', pass: 'Contraseña', login: 'Entrar', register: 'Crear cuenta',
        or: 'o', google: 'Continuar con Google', forgot: '¿Olvidaste tu contraseña?',
        noAcc: '¿No tienes cuenta?', hasAcc: '¿Ya tienes cuenta?', goRegister: 'Crear cuenta', goLogin: 'Entrar',
        resetSent: 'Te enviamos un correo para cambiar la contraseña.', needEmail: 'Escribe tu correo primero.',
        short: 'La contraseña debe tener al menos 6 caracteres.',
        errors: {
            'auth/invalid-credential': 'Correo o contraseña incorrectos.', 'auth/wrong-password': 'Correo o contraseña incorrectos.',
            'auth/user-not-found': 'No existe una cuenta con ese correo.', 'auth/email-already-in-use': 'Ese correo ya tiene una cuenta. Prueba entrar.',
            'auth/invalid-email': 'El correo no es válido.', 'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
            'auth/too-many-requests': 'Demasiados intentos. Espera un momento e inténtalo de nuevo.', 'auth/popup-closed-by-user': '',
            'auth/network-request-failed': 'Sin conexión. Revisa tu internet.',
        },
        generic: 'No pudimos completar la acción. Inténtalo de nuevo.',
    },
    en: {
        loginTitle: 'Sign in to Zion Stage', registerTitle: 'Create your account',
        loginSub: 'Use the email you signed up with.', registerSub: 'Then pick your plan and use it on any device.',
        name: 'Name', email: 'Email', pass: 'Password', login: 'Sign in', register: 'Create account',
        or: 'or', google: 'Continue with Google', forgot: 'Forgot your password?',
        noAcc: "Don't have an account?", hasAcc: 'Already have an account?', goRegister: 'Create account', goLogin: 'Sign in',
        resetSent: 'We emailed you a link to reset your password.', needEmail: 'Enter your email first.',
        short: 'Password must be at least 6 characters.',
        errors: {
            'auth/invalid-credential': 'Wrong email or password.', 'auth/wrong-password': 'Wrong email or password.',
            'auth/user-not-found': 'No account with that email.', 'auth/email-already-in-use': 'That email already has an account. Try signing in.',
            'auth/invalid-email': 'Invalid email.', 'auth/weak-password': 'Password must be at least 6 characters.',
            'auth/too-many-requests': 'Too many attempts. Wait a moment and try again.', 'auth/popup-closed-by-user': '',
            'auth/network-request-failed': 'No connection. Check your internet.',
        },
        generic: "We couldn't complete that. Please try again.",
    },
};

/**
 * Ventana única de entrar / crear cuenta.
 * El pago del plan se elige justo después, en el dashboard (planId 'free' => selección inicial).
 */
export default function AuthModal({ open, mode = 'register', lang = 'es', onClose, onDone }) {
    const T = TXT[lang === 'en' ? 'en' : 'es'];
    const [isLogin, setIsLogin] = useState(mode === 'login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => { if (open) { setIsLogin(mode === 'login'); setError(''); setInfo(''); } }, [open, mode]);
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open) return null;

    const fail = (err) => {
        const msg = T.errors[err?.code];
        setError(msg === '' ? '' : (msg || T.generic));
    };

    const ensureUserDoc = async (user, displayName) => {
        const ref = doc(db, 'users', user.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) return;
        const [first, ...rest] = (displayName || user.displayName || '').trim().split(' ');
        await setDoc(ref, {
            firstName: first || '', lastName: rest.join(' '), email: user.email || '',
            planId: 'free', customStorageGB: 1, createdAt: serverTimestamp(),
        }, { merge: true });
    };

    const submit = async (e) => {
        e.preventDefault();
        setError(''); setInfo('');
        if (!isLogin && password.length < 6) { setError(T.short); return; }
        setBusy(true);
        try {
            let user;
            if (isLogin) {
                user = (await signInWithEmailAndPassword(auth, email.trim(), password)).user;
            } else {
                user = (await createUserWithEmailAndPassword(auth, email.trim(), password)).user;
                const fullName = name.trim();
                if (fullName) await updateProfile(user, { displayName: fullName });
                await ensureUserDoc(user, fullName);
                // Enviar correo con link único de verificación (Gmail SMTP con respaldo automático de Firebase)
                try {
                    const idToken = await user.getIdToken();
                    const resp = await fetch(`${getMixerApiBase()}/api/auth/send-verification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
                    });
                    const data = await resp.json().catch(() => ({}));
                    if (!resp.ok || data.fallbackToFirebase) {
                        await sendEmailVerification(user);
                    }
                } catch {
                    try { await sendEmailVerification(user); } catch { /* ignore */ }
                }
            }
            onDone?.(user);
        } catch (err) { console.error('Auth error:', err); fail(err); } finally { setBusy(false); }
    };

    const google = async () => {
        setError(''); setInfo(''); setBusy(true);
        try {
            const user = (await signInWithPopup(auth, new GoogleAuthProvider())).user;
            await ensureUserDoc(user, user.displayName);
            onDone?.(user);
        } catch (err) { console.error('Google auth error:', err); fail(err); } finally { setBusy(false); }
    };

    const forgot = async () => {
        setError(''); setInfo('');
        if (!email.trim()) { setError(T.needEmail); return; }
        try { await sendPasswordResetEmail(auth, email.trim()); setInfo(T.resetSent); } catch (err) { fail(err); }
    };

    return (
        <div className="z-modal-bg" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
            <div className="z-modal" role="dialog" aria-modal="true">
                <button className="z-modal-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button>
                <img src="/logo2.png" alt="Zion Stage" style={{ height: 30, marginBottom: 20 }} />
                <h2>{isLogin ? T.loginTitle : T.registerTitle}</h2>
                <p className="z-muted" style={{ margin: '0 0 22px', fontSize: '0.93rem' }}>{isLogin ? T.loginSub : T.registerSub}</p>

                {error && <div className="z-error">{error}</div>}
                {info && <div className="z-error" style={{ background: '#e8f6f6', borderColor: '#bfe5e5', color: '#0b6a6b' }}>{info}</div>}

                <form onSubmit={submit}>
                    {!isLogin && (
                        <div className="z-field">
                            <label htmlFor="z-name">{T.name}</label>
                            <input id="z-name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                    )}
                    <div className="z-field">
                        <label htmlFor="z-email">{T.email}</label>
                        <input id="z-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                    </div>
                    <div className="z-field">
                        <label htmlFor="z-pass">{T.pass}</label>
                        <input id="z-pass" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    </div>
                    {isLogin && <div style={{ marginBottom: 16 }}><button type="button" className="z-link" onClick={forgot}>{T.forgot}</button></div>}
                    <button type="submit" className="z-btn z-btn-primary z-btn-block" disabled={busy}>{isLogin ? T.login : T.register}</button>
                </form>

                <div className="z-or">{T.or}</div>
                <button type="button" className="z-btn z-btn-ghost z-btn-block" onClick={google} disabled={busy}>
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" alt="" /> {T.google}
                </button>

                <p className="z-muted" style={{ textAlign: 'center', fontSize: '0.9rem', margin: '22px 0 0' }}>
                    {isLogin ? T.noAcc : T.hasAcc}{' '}
                    <button type="button" className="z-link" onClick={() => { setIsLogin(!isLogin); setError(''); setInfo(''); }}>
                        {isLogin ? T.goRegister : T.goLogin}
                    </button>
                </p>
            </div>
        </div>
    );
}
