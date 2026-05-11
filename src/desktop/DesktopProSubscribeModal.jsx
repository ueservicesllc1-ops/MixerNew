import React, { useState } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { stripeJsPromise as stripePromise } from '../stripeClient.js';
import { getMixerApiBase } from '../mixerApiBase.js';
import { X, Loader2, ArrowLeft } from 'lucide-react';
import { DESKTOP_PRO_PLANS } from './desktopProPlans';

function CheckoutForm({ onPaid }) {
    const stripe = useStripe();
    const elements = useElements();
    const [busy, setBusy] = useState(false);

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setBusy(true);
        const result = await stripe.confirmPayment({ elements, redirect: 'if_required' });
        if (result.error) {
            alert('Error en el pago: ' + result.error.message);
            setBusy(false);
        } else {
            onPaid();
        }
    };

    return (
        <form onSubmit={onSubmit} style={{ marginTop: '16px', textAlign: 'left', background: '#fff', padding: '16px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.08)' }}>
            <PaymentElement options={{ layout: 'accordion' }} />
            <button
                type="submit"
                disabled={!stripe || busy}
                style={{
                    width: '100%',
                    marginTop: '14px',
                    padding: '12px',
                    borderRadius: '10px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #00b8d4, #00d2d3)',
                    color: '#fff',
                    fontWeight: 800,
                    fontSize: '0.95rem',
                    cursor: busy ? 'wait' : 'pointer',
                }}
            >
                {busy ? <Loader2 className="animate-spin" style={{ margin: '0 auto', display: 'block' }} /> : 'Confirmar y pagar'}
            </button>
        </form>
    );
}

/**
 * Modal escritorio: dos planes → Stripe → Firestore + SQLite (saveLicense vía callback).
 */
export function DesktopProSubscribeModal({ open, onClose, currentUser, onLicenseApplied }) {
    const [step, setStep] = useState('pick');
    const [selected, setSelected] = useState(null);
    const [clientSecret, setClientSecret] = useState('');
    const [subscriptionId, setSubscriptionId] = useState('');
    const [preparing, setPreparing] = useState(false);

    if (!open) return null;

    const reset = () => {
        setStep('pick');
        setSelected(null);
        setClientSecret('');
        setSubscriptionId('');
        setPreparing(false);
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    const startCheckout = async (plan) => {
        if (!currentUser?.email || !currentUser?.uid) {
            alert('Inicia sesión para suscribirte.');
            return;
        }
        setPreparing(true);
        setSelected(plan);
        try {
            const base = getMixerApiBase();
            const res = await fetch(`${base}/api/stripe/create-subscription`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: currentUser.email,
                    name: currentUser.displayName || currentUser.email.split('@')[0],
                    userId: currentUser.uid,
                    planId: plan.id,
                    isAnnual: false,
                }),
            });
            const data = await res.json();
            if (!data.clientSecret) {
                throw new Error(data.error || 'No se pudo iniciar el pago. Si acabas de publicar estos planes, el servidor debe tener los Price IDs de Stripe para estos planId.');
            }
            setClientSecret(data.clientSecret);
            setSubscriptionId(data.subscriptionId || '');
            setStep('pay');
        } catch (err) {
            alert(err.message || String(err));
            setSelected(null);
        } finally {
            setPreparing(false);
        }
    };

    const finalize = async () => {
        if (!currentUser?.uid || !selected) return;
        try {
            await setDoc(
                doc(db, 'users', currentUser.uid),
                {
                    planId: selected.id,
                    desktopLicenseTier: selected.tier,
                    desktopProActive: true,
                    stripeSubscriptionId: subscriptionId || null,
                    updatedAt: serverTimestamp(),
                },
                { merge: true }
            );
        } catch (e) {
            console.error(e);
            alert('El pago se procesó pero no se pudo actualizar tu perfil. Contacta soporte con tu recibo.');
        }
        if (typeof window !== 'undefined' && window.zionNative?.saveLicense) {
            await window.zionNative.saveLicense(currentUser.uid, selected.tier);
        }
        onLicenseApplied?.(selected.tier);
        handleClose();
    };

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: 100001,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px',
                backdropFilter: 'blur(6px)',
            }}
        >
            <div
                style={{
                    background: 'linear-gradient(180deg, #0f172a 0%, #1e293b 100%)',
                    color: '#f1f5f9',
                    borderRadius: '16px',
                    maxWidth: '720px',
                    width: '100%',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    border: '1px solid rgba(148,163,184,0.2)',
                    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
                    position: 'relative',
                }}
            >
                <button
                    type="button"
                    onClick={handleClose}
                    style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '8px',
                    }}
                >
                    <X size={22} />
                </button>

                {step === 'pick' && (
                    <>
                        <div style={{ padding: '28px 24px 12px' }}>
                            <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 900 }}>Conviértete en PRO</h2>
                            <p style={{ margin: '10px 0 0', color: '#94a3b8', fontSize: '0.95rem', lineHeight: 1.5 }}>
                                Elige tu plan mensual. Tras el pago verificamos con Stripe y activamos tu licencia en esta app.
                            </p>
                        </div>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                gap: '16px',
                                padding: '8px 24px 24px',
                            }}
                        >
                            {DESKTOP_PRO_PLANS.map((plan) => (
                                <div
                                    key={plan.id}
                                    style={{
                                        background: 'rgba(15,23,42,0.6)',
                                        border: '1px solid rgba(148,163,184,0.25)',
                                        borderRadius: '14px',
                                        padding: '20px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '12px',
                                    }}
                                >
                                    <div style={{ fontSize: '0.8rem', fontWeight: 800, color: '#22d3ee', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        {plan.title}
                                    </div>
                                    <div>
                                        <span style={{ fontSize: '1.75rem', fontWeight: 900 }}>{plan.priceLabel}</span>
                                        <span style={{ color: '#64748b', fontSize: '0.95rem' }}>{plan.period}</span>
                                    </div>
                                    <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.55, color: '#cbd5e1', flex: 1 }}>{plan.blurb}</p>
                                    <button
                                        type="button"
                                        disabled={preparing}
                                        onClick={() => startCheckout(plan)}
                                        style={{
                                            padding: '12px 16px',
                                            borderRadius: '10px',
                                            border: 'none',
                                            background: plan.tier === 'pro_online' ? 'linear-gradient(135deg,#a855f7,#6366f1)' : 'linear-gradient(135deg,#0891b2,#06b6d4)',
                                            color: '#fff',
                                            fontWeight: 800,
                                            cursor: preparing ? 'wait' : 'pointer',
                                            fontSize: '0.9rem',
                                        }}
                                    >
                                        {preparing && selected?.id === plan.id ? 'Preparando…' : 'Suscribirme y pagar'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}

                {step === 'pay' && selected && clientSecret && stripePromise && (
                    <div style={{ padding: '24px' }}>
                        <button
                            type="button"
                            onClick={() => {
                                setStep('pick');
                                setClientSecret('');
                                setSubscriptionId('');
                                setSelected(null);
                            }}
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'transparent',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                marginBottom: '12px',
                                fontSize: '0.9rem',
                            }}
                        >
                            <ArrowLeft size={18} /> Volver
                        </button>
                        <h3 style={{ margin: '0 0 8px', fontSize: '1.15rem' }}>Pago: {selected.title}</h3>
                        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.88rem' }}>{selected.priceLabel}{selected.period}</p>
                        <Elements stripe={stripePromise} options={{ clientSecret }}>
                            <CheckoutForm onPaid={finalize} />
                        </Elements>
                    </div>
                )}

                {step === 'pay' && (!stripePromise || !clientSecret) && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Stripe no está configurado.</div>
                )}
            </div>
        </div>
    );
}
