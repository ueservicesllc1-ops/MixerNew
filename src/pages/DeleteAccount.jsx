import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserX, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import Footer from '../components/Footer';
import PageNavBar from '../components/PageNavBar';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export default function DeleteAccount() {
    const { t } = useTranslation();
    const [form, setForm] = useState({
        email: '',
        nombre: '',
        detalles: '',
        confirm: false,
    });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsub = auth.onAuthStateChanged((user) => {
            if (user?.email) {
                setForm((prev) => ({ ...prev, email: user.email || '' }));
            }
        });
        return () => unsub();
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.email || !form.confirm) return;
        setSending(true);
        setError('');
        try {
            const user = auth.currentUser;
            await addDoc(collection(db, 'account_deletion_requests'), {
                email: form.email.trim(),
                nombre: form.nombre.trim() || null,
                detalles: form.detalles.trim() || null,
                authUid: user?.uid || null,
                leido: false,
                estado: 'pending',
                createdAt: serverTimestamp(),
            });
            setSent(true);
        } catch (err) {
            console.error(err);
            setError(t('deleteAccount.errorSend'));
        } finally {
            setSending(false);
        }
    };

    const inputStyle = {
        width: '100%',
        padding: '12px 14px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'white',
        fontSize: '0.88rem',
        fontFamily: '"Outfit", sans-serif',
        outline: 'none',
        transition: 'border-color 0.2s',
        boxSizing: 'border-box',
    };

    const resetForm = () => {
        setSent(false);
        setForm((prev) => ({
            email: prev.email,
            nombre: '',
            detalles: '',
            confirm: false,
        }));
    };

    return (
        <div
            style={{
                backgroundColor: '#0f172a',
                minHeight: '100vh',
                color: 'white',
                fontFamily: '"Outfit", sans-serif',
            }}
        >
            <PageNavBar Icon={UserX} title={t('pages.deleteAccount')} backPath="/" />

            <div
                style={{
                    maxWidth: '720px',
                    margin: '0 auto',
                    padding: '56px 24px 100px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '10px',
                    }}
                >
                    <div
                        style={{
                            width: '24px',
                            height: '24px',
                            background: '#f87171',
                            borderRadius: '50%',
                        }}
                    />
                    <span
                        style={{
                            color: '#f87171',
                            fontWeight: '700',
                            fontSize: '0.85rem',
                            letterSpacing: '1px',
                            textTransform: 'uppercase',
                        }}
                    >
                        {t('deleteAccount.badge')}
                    </span>
                </div>
                <h1
                    style={{
                        fontSize: '1.85rem',
                        fontWeight: '900',
                        margin: '0 0 14px',
                        lineHeight: '1.2',
                    }}
                >
                    {t('deleteAccount.heroTitle')}
                </h1>
                <p
                    style={{
                        color: '#64748b',
                        lineHeight: '1.7',
                        marginBottom: '28px',
                        fontSize: '0.9rem',
                    }}
                >
                    {t('deleteAccount.heroSub')}
                </p>

                <div
                    style={{
                        background: 'rgba(248,113,113,0.08)',
                        border: '1px solid rgba(248,113,113,0.25)',
                        borderRadius: '14px',
                        padding: '16px 18px',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        marginBottom: '28px',
                    }}
                >
                    <AlertTriangle
                        size={22}
                        color="#f87171"
                        style={{ flexShrink: 0, marginTop: '2px' }}
                    />
                    <p style={{ margin: 0, color: '#fca5a5', fontSize: '0.86rem', lineHeight: '1.65' }}>
                        {t('deleteAccount.warning')}
                    </p>
                </div>

                <div
                    style={{
                        background: '#1e293b',
                        borderRadius: '20px',
                        padding: '40px 36px',
                        border: '1px solid rgba(255,255,255,0.05)',
                    }}
                >
                    {sent ? (
                        <div style={{ textAlign: 'center', padding: '28px 12px' }}>
                            <CheckCircle2 size={52} color="#10b981" style={{ marginBottom: '16px' }} />
                            <h2 style={{ fontSize: '1.15rem', fontWeight: '800', marginBottom: '10px' }}>
                                {t('deleteAccount.sentTitle')}
                            </h2>
                            <p
                                style={{
                                    color: '#64748b',
                                    lineHeight: '1.7',
                                    marginBottom: '24px',
                                    fontSize: '0.88rem',
                                }}
                            >
                                {t('deleteAccount.sentSub')}
                            </p>
                            <button
                                type="button"
                                onClick={resetForm}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.15)',
                                    color: '#94a3b8',
                                    padding: '10px 24px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontFamily: '"Outfit", sans-serif',
                                }}
                            >
                                {t('deleteAccount.sendAnother')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '6px' }}>
                                {t('deleteAccount.formTitle')}
                            </h2>
                            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '22px' }}>
                                {t('deleteAccount.requiredNote')}
                            </p>

                            {error && (
                                <div
                                    style={{
                                        background: 'rgba(239,68,68,0.1)',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        color: '#f87171',
                                        padding: '12px 16px',
                                        borderRadius: '8px',
                                        marginBottom: '20px',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    {error}
                                </div>
                            )}

                            <form
                                onSubmit={handleSubmit}
                                style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                            >
                                <div>
                                    <label
                                        style={{
                                            fontSize: '0.8rem',
                                            color: '#64748b',
                                            display: 'block',
                                            marginBottom: '6px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        {t('deleteAccount.labelEmailStar')}
                                    </label>
                                    <input
                                        name="email"
                                        type="email"
                                        value={form.email}
                                        onChange={handleChange}
                                        required
                                        autoComplete="email"
                                        placeholder={t('deleteAccount.phEmail')}
                                        style={inputStyle}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#f87171';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                                        }}
                                    />
                                </div>

                                <div>
                                    <label
                                        style={{
                                            fontSize: '0.8rem',
                                            color: '#64748b',
                                            display: 'block',
                                            marginBottom: '6px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        {t('deleteAccount.labelName')}
                                    </label>
                                    <input
                                        name="nombre"
                                        value={form.nombre}
                                        onChange={handleChange}
                                        placeholder={t('deleteAccount.phName')}
                                        style={inputStyle}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#f87171';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                                        }}
                                    />
                                </div>

                                <div>
                                    <label
                                        style={{
                                            fontSize: '0.8rem',
                                            color: '#64748b',
                                            display: 'block',
                                            marginBottom: '6px',
                                            fontWeight: '700',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.5px',
                                        }}
                                    >
                                        {t('deleteAccount.labelDetails')}
                                    </label>
                                    <textarea
                                        name="detalles"
                                        value={form.detalles}
                                        onChange={handleChange}
                                        rows={4}
                                        placeholder={t('deleteAccount.phDetails')}
                                        style={{
                                            ...inputStyle,
                                            resize: 'vertical',
                                            minHeight: '100px',
                                        }}
                                        onFocus={(e) => {
                                            e.target.style.borderColor = '#f87171';
                                        }}
                                        onBlur={(e) => {
                                            e.target.style.borderColor = 'rgba(255,255,255,0.08)';
                                        }}
                                    />
                                </div>

                                <label
                                    style={{
                                        display: 'flex',
                                        gap: '12px',
                                        alignItems: 'flex-start',
                                        cursor: 'pointer',
                                        fontSize: '0.88rem',
                                        color: '#e2e8f0',
                                        lineHeight: '1.5',
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        name="confirm"
                                        checked={form.confirm}
                                        onChange={handleChange}
                                        required
                                        style={{ marginTop: '4px', width: '18px', height: '18px', flexShrink: 0 }}
                                    />
                                    <span>{t('deleteAccount.confirmLabel')}</span>
                                </label>

                                <button
                                    type="submit"
                                    disabled={sending || !form.confirm}
                                    style={{
                                        marginTop: '8px',
                                        background: sending || !form.confirm ? '#475569' : '#dc2626',
                                        color: 'white',
                                        border: 'none',
                                        padding: '14px 22px',
                                        borderRadius: '10px',
                                        fontWeight: '800',
                                        fontSize: '0.95rem',
                                        cursor: sending || !form.confirm ? 'not-allowed' : 'pointer',
                                        fontFamily: '"Outfit", sans-serif',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                    }}
                                >
                                    <Send size={18} />
                                    {sending ? t('deleteAccount.sending') : t('deleteAccount.submit')}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>

            <Footer />
        </div>
    );
}
