import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Send, CheckCircle2, MessageSquare, Phone, MapPin } from 'lucide-react';
import Footer from '../components/Footer';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import PageNavBar from '../components/PageNavBar';

export default function Contact() {
    const { t } = useTranslation();
    const [form, setForm] = useState({ nombre: '', email: '', asunto: '', mensaje: '' });
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nombre || !form.email || !form.mensaje) return;
        setSending(true);
        setError('');
        try {
            await addDoc(collection(db, 'contacts'), {
                ...form,
                leido: false,
                createdAt: serverTimestamp()
            });
            setSent(true);
        } catch (err) {
            console.error(err);
            setError(t('contact.errorSend'));
        } finally {
            setSending(false);
        }
    };

    const inputStyle = {
        width: '100%', padding: '12px 14px', borderRadius: '10px',
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        color: 'white', fontSize: '0.88rem', fontFamily: '"Outfit", sans-serif',
        outline: 'none', transition: 'border-color 0.2s',
        boxSizing: 'border-box'
    };

    const contactItems = [
        { icon: <Mail size={20} />, label: t('contact.labelGeneral'), value: 'hello@freedomlabs.io' },
        { icon: <Mail size={20} />, label: t('contact.labelSupport'), value: 'soporte@freedomlabs.io' },
        { icon: <Phone size={20} />, label: t('contact.labelWhatsapp'), value: '+1 (305) 000-0000' },
        { icon: <MapPin size={20} />, label: t('contact.labelLocation'), value: 'New Jersey — USA' },
    ];

    return (
        <div style={{ backgroundColor: '#0f172a', minHeight: '100vh', color: 'white', fontFamily: '"Outfit", sans-serif' }}>
            <PageNavBar Icon={MessageSquare} title={t('pages.contact')} />

            <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '70px 40px 100px', display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '80px', alignItems: 'start' }}>
                {/* Left info */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <div style={{ width: '24px', height: '24px', background: '#00d2d3', borderRadius: '50%' }} />
                        <span style={{ color: '#00d2d3', fontWeight: '700', fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase' }}>{t('contact.badge')}</span>
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '900', margin: '0 0 16px', lineHeight: '1.2' }}>{t('contact.heroTitle')}</h1>
                    <p style={{ color: '#64748b', lineHeight: '1.7', marginBottom: '40px', fontSize: '0.88rem' }}>
                        {t('contact.heroSub')}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                        {contactItems.map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                                <div style={{ width: '42px', height: '42px', background: 'rgba(0,210,211,0.1)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#00d2d3', flexShrink: 0 }}>
                                    {item.icon}
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{item.label}</div>
                                    <div style={{ fontWeight: '600', color: '#e2e8f0', marginTop: '2px' }}>{item.value}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right form */}
                <div style={{ background: '#1e293b', borderRadius: '20px', padding: '48px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    {sent ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                            <CheckCircle2 size={52} color="#10b981" style={{ marginBottom: '16px' }} />
                            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', marginBottom: '10px' }}>{t('contact.sentTitle')}</h2>
                            <p style={{ color: '#64748b', lineHeight: '1.7', marginBottom: '24px', fontSize: '0.88rem' }}>
                                {t('contact.sentSub')}
                            </p>
                            <button onClick={() => { setSent(false); setForm({ nombre: '', email: '', asunto: '', mensaje: '' }); }} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontFamily: '"Outfit", sans-serif' }}>
                                {t('contact.sendAnother')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: '800', marginBottom: '6px' }}>{t('contact.formTitle')}</h2>
                            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '24px' }}>{t('contact.requiredNote')}</p>

                            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>{error}</div>}

                            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('contact.labelNameStar')}</label>
                                        <input name="nombre" value={form.nombre} onChange={handleChange} required placeholder={t('contact.phYourName')} style={inputStyle} onFocus={e => e.target.style.borderColor = '#00d2d3'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('contact.labelEmailStar')}</label>
                                        <input name="email" type="email" value={form.email} onChange={handleChange} required placeholder={t('contact.phEmailEx')} style={inputStyle} onFocus={e => e.target.style.borderColor = '#00d2d3'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                                    </div>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('contact.labelSubject')}</label>
                                    <select name="asunto" value={form.asunto} onChange={handleChange} style={{ ...inputStyle, appearance: 'none' }}>
                                        <option value="" style={{ background: '#1e293b' }}>{t('contact.subjectPick')}</option>
                                        <option value="soporte" style={{ background: '#1e293b' }}>{t('contact.subjectSupport')}</option>
                                        <option value="facturacion" style={{ background: '#1e293b' }}>{t('contact.subjectBilling')}</option>
                                        <option value="marketplace" style={{ background: '#1e293b' }}>{t('contact.subjectMarketplace')}</option>
                                        <option value="planes" style={{ background: '#1e293b' }}>{t('contact.subjectPlans')}</option>
                                        <option value="otro" style={{ background: '#1e293b' }}>{t('contact.subjectOther')}</option>
                                    </select>
                                </div>

                                <div>
                                    <label style={{ fontSize: '0.8rem', color: '#64748b', display: 'block', marginBottom: '6px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{t('contact.labelMessageStar')}</label>
                                    <textarea name="mensaje" value={form.mensaje} onChange={handleChange} required placeholder={t('contact.phMessage')} rows={6} style={{ ...inputStyle, resize: 'vertical', minHeight: '140px' }} onFocus={e => e.target.style.borderColor = '#00d2d3'} onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'} />
                                </div>

                                <button type="submit" disabled={sending} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '15px', background: sending ? 'rgba(0,210,211,0.4)' : '#00d2d3', border: 'none', borderRadius: '10px', color: '#0f172a', fontWeight: '800', fontSize: '1rem', cursor: sending ? 'not-allowed' : 'pointer', fontFamily: '"Outfit", sans-serif', transition: 'background 0.2s' }}>
                                    <Send size={18} /> {sending ? t('contact.sending') : t('contact.submit')}
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
