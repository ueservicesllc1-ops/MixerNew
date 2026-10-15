import React, { useState, useEffect } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripeJsPromise as stripePromise } from '../stripeClient.js';
import { getMixerApiBase } from '../mixerApiBase.js';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    auth, db,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    sendPasswordResetEmail
} from '../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import {
    Check, Sparkles, CreditCard, ShieldCheck, Globe,
    ArrowLeft, Loader2, Star, CheckCircle2, AlertCircle, X
} from 'lucide-react';

const STORAGE_PLANS = [
    { id: 'free', name: 'Gratis', storageGB: 1, price: 0, annualPrice: 0, isVIP: false, desc: '1 GB de almacenamiento' },
    { id: 'std1', name: 'Básico', storageGB: 10, price: 4.99, annualPrice: 41.92, originalAnnualPrice: 59.88, isVIP: false, desc: '10 GB Storage en la nube' },
    { id: 'std2', name: 'Estándar', storageGB: 20, price: 6.99, annualPrice: 58.72, originalAnnualPrice: 83.88, isVIP: false, desc: '20 GB Storage en la nube' },
    { id: 'std3', name: 'Plus', storageGB: 50, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: false, desc: '50 GB Storage en la nube' },
    { id: 'vip1', name: 'Básico VIP', storageGB: 10, price: 7.99, annualPrice: 67.12, originalAnnualPrice: 95.88, isVIP: true, desc: '10 GB + Catálogo Global VIP Ilimitado' },
    { id: 'vip2', name: 'Estándar VIP', storageGB: 20, price: 9.99, annualPrice: 83.92, originalAnnualPrice: 119.88, isVIP: true, desc: '20 GB + Catálogo Global VIP Ilimitado' },
    { id: 'vip3', name: 'Plus VIP', storageGB: 50, price: 12.99, annualPrice: 109.12, originalAnnualPrice: 155.88, isVIP: true, desc: '50 GB + Catálogo Global VIP Ilimitado' },
    { id: 'universal_pro', name: 'Universal PRO', storageGB: 100, price: 14.99, annualPrice: 134.90, originalAnnualPrice: 179.88, isVIP: true, isUniversal: true, desc: '100 GB + Acceso Total (Android, iPad, Web, PC)' },
];

const StripeCheckoutForm = ({ plan, isAnnual, onPaymentSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);
        setErrorMsg('');
        try {
            const result = await stripe.confirmPayment({
                elements,
                confirmParams: {
                    return_url: window.location.href,
                },
                redirect: 'if_required'
            });

            if (result.error) {
                setErrorMsg(result.error.message || 'Error en el pago');
                setIsProcessing(false);
            } else {
                onPaymentSuccess();
            }
        } catch (error) {
            console.error('Stripe error:', error);
            setErrorMsg(error.message || 'Error al procesar el pago');
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ background: '#1c1c1e', padding: '24px', borderRadius: '16px', border: '1px solid #333' }}>
            <h4 style={{ color: 'white', marginTop: 0, marginBottom: '16px', fontWeight: '800', textAlign: 'center', fontSize: '1.1rem' }}>
                Pagar Plan {plan.name} ({isAnnual ? 'Anual' : 'Mensual'})
            </h4>
            <div style={{ background: 'white', padding: '16px', borderRadius: '10px', marginBottom: '16px' }}>
                <PaymentElement options={{ layout: 'accordion' }} />
            </div>
            {errorMsg && (
                <div style={{ color: '#ff5252', fontSize: '0.85rem', textAlign: 'center', marginBottom: '14px', background: 'rgba(255,82,82,0.1)', padding: '10px', borderRadius: '8px' }}>
                    {errorMsg}
                </div>
            )}
            <button
                type="submit"
                disabled={!stripe || isProcessing}
                style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #00d2d3, #0984e3)',
                    color: 'white',
                    fontWeight: '800',
                    fontSize: '1rem',
                    cursor: (!stripe || isProcessing) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 15px rgba(0,210,211,0.3)'
                }}
            >
                {isProcessing ? <Loader2 className="animate-spin" size={20} /> : 'Confirmar y Pagar'}
            </button>
        </form>
    );
};

export default function Subscribe() {
    const navigate = useNavigate();
    const location = useLocation();

    // Parse email from query params
    const queryParams = new URLSearchParams(location.search);
    const initialEmail = queryParams.get('email') || '';

    // Auth States
    const [currentUser, setCurrentUser] = useState(null);
    const [authLoading, setAuthLoading] = useState(true);
    const [loginEmail, setLoginEmail] = useState(initialEmail);
    const [loginPassword, setLoginPassword] = useState('');
    const [loginIsRegister, setLoginIsRegister] = useState(false);
    const [authError, setAuthError] = useState('');
    const [authSuccess, setAuthSuccess] = useState('');
    const [authSubmitting, setAuthSubmitting] = useState(false);

    // Plan & Stripe States
    const [userPlanId, setUserPlanId] = useState('free');
    const [isAnnual, setIsAnnual] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [couponInput, setCouponInput] = useState('ZION99');
    const [promoApplied, setPromoApplied] = useState(false);
    const [stripeClientSecret, setStripeClientSecret] = useState('');
    const [isPreparingStripe, setIsPreparingStripe] = useState(false);
    const [paymentCompleted, setPaymentCompleted] = useState(false);

    useEffect(() => {
        let unsubUser = () => { };
        const unsubAuth = auth.onAuthStateChanged((user) => {
            setCurrentUser(user);
            setAuthLoading(false);
            if (user) {
                if (!loginEmail) setLoginEmail(user.email || '');
                unsubUser = onSnapshot(doc(db, 'users', user.uid), (snap) => {
                    if (snap.exists()) {
                        setUserPlanId(snap.data().planId || 'free');
                    } else {
                        setDoc(doc(db, 'users', user.uid), {
                            planId: 'free',
                            email: user.email || '',
                            displayName: user.displayName || '',
                            createdAt: serverTimestamp()
                        }, { merge: true });
                        setUserPlanId('free');
                    }
                });
            } else {
                setUserPlanId('free');
            }
        });
        return () => {
            unsubAuth();
            unsubUser();
        };
    }, []);

    const handleAuthSubmit = async (e) => {
        e.preventDefault();
        setAuthError('');
        setAuthSuccess('');
        setAuthSubmitting(true);
        try {
            if (loginIsRegister) {
                const cred = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
                await setDoc(doc(db, 'users', cred.user.uid), {
                    planId: 'free',
                    email: loginEmail,
                    createdAt: serverTimestamp()
                }, { merge: true });
            } else {
                await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
            }
        } catch (error) {
            console.error('Auth error:', error);
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setAuthError('Correo o contraseña incorrectos.');
            } else if (error.code === 'auth/email-already-in-use') {
                setAuthError('Este correo ya está registrado. Inicia sesión.');
            } else if (error.code === 'auth/weak-password') {
                setAuthError('La contraseña debe tener al menos 6 caracteres.');
            } else {
                setAuthError(error.message || 'Error al iniciar sesión.');
            }
        } finally {
            setAuthSubmitting(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setAuthError('');
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error('Google Sign-In error:', error);
            setAuthError(error.message || 'Error al iniciar con Google.');
        }
    };

    const handleForgotPassword = async () => {
        if (!loginEmail) {
            setAuthError('Ingresa tu correo en el campo de arriba para restablecer tu contraseña.');
            return;
        }
        try {
            await sendPasswordResetEmail(auth, loginEmail);
            setAuthSuccess('✓ Se ha enviado un enlace para restablecer tu contraseña a tu correo.');
            setAuthError('');
        } catch (error) {
            setAuthError('No se pudo enviar el correo de restablecimiento.');
        }
    };

    const handleChoosePlan = async (plan, couponOverride) => {
        if (plan.id === 'free') {
            if (currentUser) {
                await updateDoc(doc(db, 'users', currentUser.uid), { planId: 'free' });
            }
            setSelectedPlan(null);
            setStripeClientSecret('');
            return;
        }

        setSelectedPlan(plan);
        setIsPreparingStripe(true);
        setStripeClientSecret('');

        const couponToUse = (couponOverride !== undefined ? couponOverride : couponInput).trim();
        try {
            const devProxy = getMixerApiBase();
            const res = await fetch(`${devProxy}/api/stripe/create-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentUser.email,
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    userId: currentUser.uid,
                    planId: plan.id,
                    isAnnual: isAnnual,
                    couponCode: couponToUse,
                })
            });
            const data = await res.json();
            if (data.clientSecret) {
                setStripeClientSecret(data.clientSecret);
                setPromoApplied(data.promoApplied === true);
            } else {
                throw new Error(data.error || 'Error al iniciar pago');
            }
        } catch (err) {
            alert(err.message || 'No se pudo iniciar el proceso de pago');
            setSelectedPlan(null);
        } finally {
            setIsPreparingStripe(false);
        }
    };

    const handlePaymentSuccess = () => {
        setPaymentCompleted(true);
        setSelectedPlan(null);
        setStripeClientSecret('');
    };

    if (authLoading) {
        return (
            <div style={{ minHeight: '100vh', background: '#0a0a12', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d2d3' }}>
                <Loader2 className="animate-spin" size={40} />
            </div>
        );
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #080811 0%, #0d1a2d 60%, #09131d 100%)', color: 'white', padding: '40px 20px', fontFamily: '"Outfit", "Inter", sans-serif' }}>
            <div style={{ maxWidth: '960px', margin: '0 auto' }}>

                {/* HEADER / LOGO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => navigate('/')}>
                        <img src="/logo2blanco.png" alt="Zion Stage" style={{ height: '36px' }} />
                    </div>
                    {currentUser && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{ textAlign: 'right', fontSize: '0.85rem' }}>
                                <div style={{ color: '#94a3b8' }}>{currentUser.email}</div>
                                <div style={{ fontWeight: 800, color: userPlanId === 'free' ? '#94a3b8' : '#f1c40f' }}>
                                    PLAN ACTUAL: {userPlanId.toUpperCase()}
                                </div>
                            </div>
                            <button
                                onClick={() => auth.signOut()}
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#cbd5e1', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                                Salir
                            </button>
                        </div>
                    )}
                </div>

                {/* ── ESTADO 1: NO AUTENTICADO → PANTALLA DIRECTA DE INICIO DE SESIÓN ── */}
                {!currentUser ? (
                    <div style={{ maxWidth: '420px', margin: '40px auto', background: '#131926', padding: '36px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
                        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
                            <div style={{ display: 'inline-flex', padding: '8px 16px', borderRadius: '30px', background: 'rgba(0,210,211,0.12)', color: '#00d2d3', fontWeight: 800, fontSize: '0.8rem', marginBottom: '14px', gap: '6px', alignItems: 'center' }}>
                                <Sparkles size={14} /> Activa tu Suscripción VIP
                            </div>
                            <h2 style={{ margin: '0 0 8px', fontSize: '1.6rem', fontWeight: 900 }}>
                                {loginIsRegister ? 'Crea tu Cuenta' : 'Inicia Sesión'}
                            </h2>
                            <p style={{ color: '#94a3b8', fontSize: '0.88rem', margin: 0, lineHeight: '1.4' }}>
                                Ingresa con tu cuenta de Zion Stage para elegir tu plan y sincronizar tus canciones en la app.
                            </p>
                        </div>

                        <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '6px', fontWeight: 700 }}>Correo electrónico</label>
                                <input
                                    type="email"
                                    value={loginEmail}
                                    onChange={(e) => setLoginEmail(e.target.value)}
                                    placeholder="tu@correo.com"
                                    required
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '0.95rem', outline: 'none' }}
                                />
                            </div>

                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 700 }}>Contraseña</label>
                                    {!loginIsRegister && (
                                        <span onClick={handleForgotPassword} style={{ fontSize: '0.75rem', color: '#00d2d3', cursor: 'pointer', textDecoration: 'underline' }}>
                                            ¿Olvidaste tu contraseña?
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="password"
                                    value={loginPassword}
                                    onChange={(e) => setLoginPassword(e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: '10px', border: '1px solid #334155', background: '#0f172a', color: 'white', fontSize: '0.95rem', outline: 'none' }}
                                />
                            </div>

                            {authError && (
                                <div style={{ color: '#ff5252', fontSize: '0.82rem', background: 'rgba(255,82,82,0.1)', border: '1px solid rgba(255,82,82,0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                    {authError}
                                </div>
                            )}

                            {authSuccess && (
                                <div style={{ color: '#4ade80', fontSize: '0.82rem', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                                    {authSuccess}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={authSubmitting}
                                style={{ width: '100%', padding: '14px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #00d2d3, #0984e3)', color: 'white', fontWeight: 800, fontSize: '1rem', cursor: authSubmitting ? 'not-allowed' : 'pointer', marginTop: '6px' }}
                            >
                                {authSubmitting ? <Loader2 className="animate-spin" size={18} style={{ margin: '0 auto' }} /> : (loginIsRegister ? 'Crear Cuenta y Ver Planes' : 'Iniciar Sesión y Ver Planes')}
                            </button>

                            <button
                                type="button"
                                onClick={handleGoogleSignIn}
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z" /><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z" /><path fill="#FBBC05" d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15.2s.7 5.5 1.9 7.9l3.7-2.9z" /><path fill="#34A853" d="M12 23.5c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 17C3.7 20.7 7.5 23.5 12 23.5z" /></svg>
                                Continuar con Google
                            </button>
                        </form>

                        <div style={{ marginTop: '22px', textAlign: 'center', fontSize: '0.85rem' }}>
                            <span onClick={() => { setLoginIsRegister(!loginIsRegister); setAuthError(''); setAuthSuccess(''); }} style={{ color: '#00d2d3', cursor: 'pointer', fontWeight: 700 }}>
                                {loginIsRegister ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta aún? Regístrate aquí'}
                            </span>
                        </div>
                    </div>
                ) : paymentCompleted ? (
                    /* ── ESTADO 2: PAGO COMPLETADO CON ÉXITO ── */
                    <div style={{ maxWidth: '520px', margin: '40px auto', background: '#131926', padding: '40px', borderRadius: '20px', border: '1px solid rgba(0,210,211,0.4)', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,210,211,0.2)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(0,210,211,0.15)', color: '#00d2d3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                            <CheckCircle2 size={36} />
                        </div>
                        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '0 0 12px' }}>¡Suscripción Activada con Éxito!</h2>
                        <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: '1.6', margin: '0 0 24px' }}>
                            Tu cuenta ha sido actualizada. Ya tienes acceso inmediato a todo el catálogo VIP y características premium.
                        </p>
                        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', marginBottom: '28px', textAlign: 'left', fontSize: '0.88rem', color: '#94a3b8' }}>
                            <div>✓ Tu app en la tablet o teléfono ya está desbloqueada</div>
                            <div>✓ Acceso completo a multitracks, pistas y stems</div>
                            <div>✓ Recibo de confirmación enviado a tu correo</div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                            <button
                                onClick={() => navigate('/dashboard')}
                                style={{ padding: '14px 28px', borderRadius: '10px', border: 'none', background: '#00d2d3', color: 'black', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}
                            >
                                Ir a mi Dashboard
                            </button>
                            <button
                                onClick={() => navigate('/multitrack')}
                                style={{ padding: '14px 28px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontWeight: 800, fontSize: '0.95rem', cursor: 'pointer' }}
                            >
                                Abrir Mixer Web
                            </button>
                        </div>
                    </div>
                ) : selectedPlan && stripeClientSecret ? (
                    /* ── ESTADO 3: CHECKOUT STRIPE DIRECTO PARA EL PLAN SELECCIONADO ── */
                    <div style={{ maxWidth: '480px', margin: '20px auto' }}>
                        <button
                            onClick={() => { setSelectedPlan(null); setStripeClientSecret(''); }}
                            style={{ background: 'transparent', border: 'none', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '16px', fontSize: '0.9rem' }}
                        >
                            <ArrowLeft size={16} /> Volver a ver todos los planes
                        </button>

                        <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                <input
                                    type="text"
                                    value={couponInput}
                                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                    placeholder="CUPÓN"
                                    style={{ flex: 1, background: '#0f172a', border: '1px solid #eab308', borderRadius: '8px', padding: '8px 12px', color: '#fbbf24', fontWeight: 800, textTransform: 'uppercase' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleChoosePlan(selectedPlan, couponInput)}
                                    style={{ background: 'linear-gradient(135deg, #eab308, #f59e0b)', color: '#000', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer' }}
                                >
                                    Aplicar
                                </button>
                            </div>
                            {promoApplied ? (
                                <div style={{ fontSize: '0.88rem', color: '#fbbf24', fontWeight: 800 }}>
                                    🎁 Descuento aplicado: <strong>$0.99 USD hoy</strong> (primer mes).
                                </div>
                            ) : (
                                <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                                    Ingresa <strong style={{ color: '#fbbf24' }}>ZION99</strong> y presiona Aplicar para activar tu 1er mes a $0.99 USD.
                                </div>
                            )}
                        </div>

                        <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                            <StripeCheckoutForm plan={selectedPlan} isAnnual={isAnnual} onPaymentSuccess={handlePaymentSuccess} />
                        </Elements>
                    </div>
                ) : (
                    /* ── ESTADO 4: USUARIO LOGUEADO → TABLA COMPLETA DE PLANES ── */
                    <div>
                        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                            <h1 style={{ fontSize: '2.4rem', fontWeight: 900, margin: '0 0 12px' }}>Elige tu Plan Zion Stage</h1>
                            <p style={{ color: '#94a3b8', fontSize: '1rem', margin: '0 0 24px' }}>
                                Desbloquea cientos de multitracks en vivo y sincroniza tu banda en cualquier dispositivo.
                            </p>

                            {/* TOGGLE MENSUAL / ANUAL */}
                            <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.06)', padding: '5px', borderRadius: '30px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <button
                                    onClick={() => setIsAnnual(false)}
                                    style={{ padding: '8px 24px', borderRadius: '25px', border: 'none', background: !isAnnual ? '#00d2d3' : 'transparent', color: !isAnnual ? '#000' : '#94a3b8', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                                >
                                    Mensual
                                </button>
                                <button
                                    onClick={() => setIsAnnual(true)}
                                    style={{ padding: '8px 24px', borderRadius: '25px', border: 'none', background: isAnnual ? '#00d2d3' : 'transparent', color: isAnnual ? '#000' : '#94a3b8', fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s' }}
                                >
                                    Anual (-30%)
                                </button>
                            </div>
                        </div>

                        {isPreparingStripe && (
                            <div style={{ textAlign: 'center', padding: '30px', color: '#00d2d3' }}>
                                <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 10px' }} />
                                <div>Preparando pasarela segura de pago...</div>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                            {STORAGE_PLANS.filter(p => !p.isDesktop && !p.isSeller && p.id !== 'free').map((p) => {
                                const isCurrent = userPlanId === p.id;
                                const isVip = p.isVIP;
                                return (
                                    <div
                                        key={p.id}
                                        style={{
                                            background: isVip ? 'linear-gradient(160deg, rgba(241,196,15,0.08) 0%, rgba(20,25,38,0.9) 100%)' : '#131926',
                                            border: isCurrent ? '2px solid #00d2d3' : isVip ? '1px solid rgba(241,196,15,0.3)' : '1px solid rgba(255,255,255,0.08)',
                                            borderRadius: '18px',
                                            padding: '24px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between',
                                            position: 'relative',
                                            boxShadow: isVip ? '0 10px 30px rgba(241,196,15,0.08)' : '0 10px 30px rgba(0,0,0,0.3)'
                                        }}
                                    >
                                        {p.isUniversal && (
                                            <div style={{ position: 'absolute', top: '-12px', right: '16px', background: 'linear-gradient(135deg, #f1c40f, #e67e22)', color: '#000', fontSize: '0.72rem', fontWeight: 900, padding: '4px 12px', borderRadius: '20px', letterSpacing: '0.05em' }}>
                                                MÁS POPULAR ⭐
                                            </div>
                                        )}

                                        <div>
                                            <div style={{ color: isVip ? '#f1c40f' : '#00d2d3', fontWeight: 800, fontSize: '0.85rem', textTransform: 'uppercase', marginBottom: '6px' }}>
                                                {isVip ? 'VIP Premium' : 'Estándar'}
                                            </div>
                                            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '0 0 8px' }}>{p.name}</h3>
                                            <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: '1.4', margin: '0 0 16px', minHeight: '36px' }}>
                                                {p.desc}
                                            </p>

                                            <div style={{ marginBottom: '20px' }}>
                                                <div style={{ fontSize: '2rem', fontWeight: 900 }}>
                                                    ${isAnnual ? p.annualPrice : p.price}
                                                    <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>/{isAnnual ? 'año' : 'mes'}</span>
                                                </div>
                                                {isAnnual && (
                                                    <div style={{ fontSize: '0.78rem', color: '#64748b', textDecoration: 'line-through' }}>
                                                        ${p.originalAnnualPrice} USD / año
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ fontSize: '0.82rem', color: '#cbd5e1', lineHeight: '1.8', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginBottom: '20px' }}>
                                                <div>✓ {p.storageGB} GB Almacenamiento</div>
                                                {isVip && <div>✓ Catálogo Global VIP Completo</div>}
                                                <div>✓ Multitracks Android, Web & Desktop</div>
                                                <div>✓ Soporte prioritario</div>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleChoosePlan(p)}
                                            disabled={isCurrent || isPreparingStripe}
                                            style={{
                                                width: '100%',
                                                padding: '12px',
                                                borderRadius: '10px',
                                                border: 'none',
                                                background: isCurrent ? 'rgba(255,255,255,0.1)' : isVip ? 'linear-gradient(135deg, #f1c40f, #f39c12)' : 'linear-gradient(135deg, #00d2d3, #0984e3)',
                                                color: isCurrent ? '#94a3b8' : isVip ? '#000' : 'white',
                                                fontWeight: 800,
                                                fontSize: '0.9rem',
                                                cursor: (isCurrent || isPreparingStripe) ? 'default' : 'pointer'
                                            }}
                                        >
                                            {isCurrent ? 'PLAN ACTUAL' : isVip ? 'Elegir VIP' : 'Elegir Plan'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
