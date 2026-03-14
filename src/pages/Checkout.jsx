import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, updateDoc, arrayUnion, getDocs } from 'firebase/firestore';
import { ShoppingCart, ArrowLeft, X, Loader2, CheckCircle2, ChevronRight, Music2, ShieldCheck, Mail, CreditCard, LogOut, Globe } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import Footer from '../components/Footer';

const stripePromise = loadStripe('pk_live_51S37NBId1DsVBhR7DBfuwJHCjLo2KzUWPxEKew3JdyI5ypBwgt420B9pXM6qQuHRscOLyNeLjxumZHwVfWdZsMQp003Gc0ne2Y');

const StripeCheckoutForm = ({ clientSecret, itemsCount, total, subtotal, discount, onPaymentSuccess }) => {
    const stripe = useStripe();
    const elements = useElements();
    const [isProcessing, setIsProcessing] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stripe || !elements) return;
        setIsProcessing(true);
        const result = await stripe.confirmPayment({
            elements,
            redirect: 'if_required'
        });

        if (result.error) {
            alert("Error en el pago: " + result.error.message);
            setIsProcessing(false);
        } else {
            onPaymentSuccess();
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
            <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem' }}>
                    <span style={{ color: '#64748b', fontWeight: '600' }}>Subtotal:</span>
                    <span style={{ fontWeight: '700', color: '#0f172a' }}>${subtotal}</span>
                </div>
                {parseFloat(discount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.9rem', color: '#166534' }}>
                        <span style={{ fontWeight: '600' }}>Descuento:</span>
                        <span style={{ fontWeight: '700' }}>-${discount}</span>
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
                    <span style={{ fontWeight: '800', color: '#0f172a' }}>Total a pagar:</span>
                    <span style={{ fontWeight: '900', color: '#00d2d3' }}>${total}</span>
                </div>
            </div>

            <div style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                <h4 style={{ color: '#0f172a', marginBottom: '20px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <CreditCard size={20} color="#00d2d3" /> Detalles de Pago
                </h4>
                <PaymentElement options={{ layout: 'accordion' }} />
                <button disabled={!stripe || isProcessing} className="btn-teal" style={{ width: '100%', padding: '16px', marginTop: '24px', fontSize: '1.1rem', fontWeight: '900', borderRadius: '12px' }}>
                    {isProcessing ? <Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> : `Pagar $${total}`}
                </button>
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                    <ShieldCheck size={14} /> Pago seguro encriptado vía Stripe
                </p>
            </div>
        </form>
    );
};

export default function Checkout() {
    const navigate = useNavigate();
    const [cart, setCart] = useState([]);
    const [currentUser, setCurrentUser] = useState(null);
    const [stripeClientSecret, setStripeClientSecret] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState(null);
    const [couponCode, setCouponCode] = useState(''); // Nuevo: Estado para cupones
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false); // Nuevo: Estado para dropdown de usuario

    useEffect(() => {
        const savedCart = localStorage.getItem('zion_cart');
        if (savedCart) {
            try { setCart(JSON.parse(savedCart)); } catch (e) { setCart([]); }
        }

        const unsub = auth.onAuthStateChanged(user => {
            setCurrentUser(user);
            if (user && savedCart) {
                initPayment(user, JSON.parse(savedCart), 0); // Initial call with 0 discount
            } else if (!user) {
                setLoading(false);
            }
        });

        return () => unsub();
    }, []);

    const cartSubtotal = cart.reduce((acc, item) => acc + (parseFloat(item.price) || 9.99), 0);
    const discountAmount = appliedCoupon ? (cartSubtotal * (appliedCoupon.discount / 100)) : 0;
    const cartTotal = (cartSubtotal - discountAmount).toFixed(2);

    const applyCoupon = async () => {
        if (!couponCode.trim()) return;
        setIsValidatingCoupon(true);
        try {
            const couponsRef = collection(db, 'coupons');
            const q = query(couponsRef, where("code", "==", couponCode.trim().toUpperCase()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setToast({ message: "Cupón no válido", type: 'error' });
                setTimeout(() => setToast(null), 3000);
            } else {
                const couponData = querySnapshot.docs[0].data();
                setAppliedCoupon(couponData);
                setToast({ message: `¡Cupón aplicado! ${couponData.discount}% de descuento`, type: 'success' });
                setTimeout(() => setToast(null), 3000);
                // Re-init Stripe with discount
                initPayment(currentUser, cart, couponData.discount);
            }
        } catch (err) {
            console.error("Coupon error:", err);
            setToast({ message: "Error al validar cupón", type: 'error' });
            setTimeout(() => setToast(null), 3000);
        } finally {
            setIsValidatingCoupon(false);
        }
    };

    // Need to make initPayment available outside useEffect if we want to call it from applyCoupon
    // or wrap it in a function that useeffect also uses.
    // For simplicity I redefined it or I could lift it.
    const initPayment = async (user, cartItems, discount = 0) => {
        try {
            setStripeClientSecret('');
            const subtotal = cartItems.reduce((acc, i) => acc + (parseFloat(i.price) || 9.99), 0);
            const total = (subtotal * (1 - discount / 100)).toFixed(2);

            const devProxy = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
                ? 'http://localhost:3001' : 'https://mixernew-production.up.railway.app';

            const res = await fetch(`${devProxy}/api/stripe/create-single-payment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    songId: cartItems.map(i => i.id).join(','),
                    songName: cartItems.length > 1 ? `${cartItems.length} canciones` : cartItems[0].name,
                    price: total,
                    email: user.email,
                    userId: user.uid
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error en el servidor de pagos");
            }

            const data = await res.json();
            if (data.clientSecret) {
                setStripeClientSecret(data.clientSecret);
            }
        } catch (err) {
            console.error("🚨 Stripe Init Error:", err);
            setToast({ message: "Error: " + err.message, type: 'error' });
            setTimeout(() => setToast(null), 4000);
        } finally {
            setLoading(false);
        }
    };

    const removeFromCart = (id) => {
        const newCart = cart.filter(item => item.id !== id);
        setCart(newCart);
        localStorage.setItem('zion_cart', JSON.stringify(newCart));
        if (newCart.length === 0) {
            navigate('/store');
        } else {
            // Re-init payment would be complex here, maybe just refresh
            window.location.reload();
        }
    };

    const handlePaymentSuccess = async () => {
        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const songIds = cart.map(i => i.id);
            await updateDoc(userRef, {
                purchasedSongs: arrayUnion(...songIds)
            });
            setCart([]);
            localStorage.removeItem('zion_cart');
            setIsSuccess(true);
        } catch (err) {
            console.error("Error updating purchase:", err);
            setIsSuccess(true); // Still show success if Stripe worked
        }
    };

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
                <Loader2 size={50} className="animate-spin" color="#00d2d3" />
                <p style={{ marginTop: '20px', fontWeight: '600' }}>Iniciando pasarela segura...</p>
            </div>
        );
    }

    if (!currentUser && !isSuccess) {
        return (
            <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white', padding: '20px', textAlign: 'center' }}>
                <ShieldCheck size={60} color="#94a3b8" style={{ marginBottom: '20px' }} />
                <h2 style={{ fontSize: '2rem', fontWeight: '900' }}>Inicio de sesión requerido</h2>
                <p style={{ color: '#94a3b8', maxWidth: '400px', margin: '15px 0 30px' }}>Para completar tu compra de forma segura, necesitamos que inicies sesión en tu cuenta.</p>
                <button onClick={() => navigate('/dashboard')} className="btn-teal" style={{ padding: '16px 40px' }}>Iniciar Sesión / Registrarse</button>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
                <div style={{ maxWidth: '500px', width: '100%', background: 'white', padding: '50px 40px', borderRadius: '32px', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)' }}>
                    <div style={{ width: '80px', height: '80px', background: '#f0fdf4', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                        <CheckCircle2 size={40} color="#22c55e" />
                    </div>
                    <h1 style={{ fontSize: '2.5rem', fontWeight: '900', marginBottom: '16px', letterSpacing: '-1px' }}>¡Pago Exitoso!</h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', marginBottom: '40px', lineHeight: '1.6' }}>Tus pistas ya han sido añadidas a tu biblioteca personal. Puedes empezar a mezclarlas ahora mismo.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        <button onClick={() => navigate('/dashboard')} className="btn-teal" style={{ padding: '18px', fontSize: '1.1rem', fontWeight: '900' }}>Ir a mi Biblioteca</button>
                        <button onClick={() => navigate('/store')} style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: '700', cursor: 'pointer' }}>Seguir comprando</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', color: '#0f172a', fontFamily: '"Outfit", sans-serif' }}>
            {/* NOTIFICACIÓN TIPO TOAST */}
            {toast && (
                <div style={{
                    position: 'fixed', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
                    background: '#1e293b', border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#00d2d3'}`, color: 'white',
                    padding: '12px 24px', borderRadius: '50px', zIndex: 5000,
                    boxShadow: '0 10px 30px rgba(0,0,10,0.5)', display: 'flex', alignItems: 'center', gap: '12px',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: toast.type === 'error' ? '#ef4444' : '#00d2d3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {toast.type === 'error' ? <X size={14} color="white" /> : <CheckCircle2 size={16} color="black" />}
                    </div>
                    <span style={{ fontWeight: '700', fontSize: '0.9rem' }}>{toast.message}</span>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translate(-50%, 50px); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `}</style>

            {/* Header Reducido */}
            <nav style={{
                padding: '15px 60px',
                background: 'white',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 1000,
                backdropFilter: 'blur(20px)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
                    <div onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <img src="/logo2.png" alt="Zion Stage" style={{ height: '36px' }} />
                    </div>

                    <div onClick={() => navigate('/store')} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: '700', color: '#64748b', fontSize: '0.9rem', background: '#f1f5f9', padding: '8px 16px', borderRadius: '30px' }}>
                        <ArrowLeft size={16} /> <span className="hide-mobile">Volver a la Tienda</span>
                    </div>
                </div>

                <div style={{ fontSize: '1.2rem', fontWeight: '900', letterSpacing: '-1px' }} className="hide-mobile">ZION<span style={{ color: '#00d2d3' }}>STAGE</span> CHECKOUT</div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontWeight: '700', fontSize: '0.85rem' }} className="hide-mobile">
                        <ShieldCheck size={18} /> Pago Seguro
                    </div>

                    {currentUser && (
                        <div style={{ position: 'relative' }}>
                            <div
                                onClick={() => setShowDropdown(!showDropdown)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#f1f5f9', padding: '4px 4px 4px 10px', borderRadius: '30px', border: '1px solid #e2e8f0' }}
                            >
                                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#475569' }} className="hide-mobile">{currentUser.displayName || currentUser.email?.split('@')[0]}</span>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'linear-gradient(135deg,#00d2d3,#9b59b6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '800', fontSize: '0.75rem', color: 'white' }}>
                                    {(currentUser.displayName || currentUser.email || 'U')[0].toUpperCase()}
                                </div>
                            </div>

                            {showDropdown && (
                                <div style={{ position: 'absolute', top: '45px', right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', width: '200px', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', overflow: 'hidden', zIndex: 2000 }}>
                                    <div
                                        onClick={() => navigate('/dashboard')}
                                        style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#475569', fontSize: '0.9rem', fontWeight: '600', borderBottom: '1px solid #f1f5f9' }}
                                    >
                                        <Globe size={16} color="#94a3b8" /> Dashboard
                                    </div>
                                    <div
                                        onClick={() => auth.signOut()}
                                        style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: '#ef4444', fontSize: '0.9rem', fontWeight: '600' }}
                                    >
                                        <LogOut size={16} /> Cerrar Sesión
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </nav>

            <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '60px' }}>

                {/* Columna Izquierda: Carrito */}
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                        Tu Carrito <span style={{ background: '#00d2d3', color: 'white', fontSize: '1rem', padding: '2px 10px', borderRadius: '20px' }}>{cart.length}</span>
                    </h2>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {cart.map(item => (
                            <div key={item.id} style={{ background: 'white', padding: '20px', borderRadius: '20px', display: 'flex', gap: '20px', alignItems: 'center', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                <div style={{ width: '70px', height: '70px', borderRadius: '12px', overflow: 'hidden', background: '#f1f5f9', flexShrink: 0 }}>
                                    <img src={item.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800' }}>{item.name}</h4>
                                    <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '0.9rem' }}>{item.artist}</p>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: '900', fontSize: '1.2rem', color: '#0f172a' }}>${item.price}</div>
                                    <button onClick={() => removeFromCart(item.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', fontSize: '0.8rem', fontWeight: '700', cursor: 'pointer', padding: '5px' }}>Eliminar</button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginTop: '40px', padding: '30px', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                        <h4 style={{ margin: '0 0 15px 0', fontSize: '1rem', fontWeight: '800' }}>¿Tienes un cupón?</h4>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <input
                                value={couponCode}
                                onChange={e => setCouponCode(e.target.value)}
                                placeholder="Ingresa tu código..."
                                style={{ flex: 1, padding: '12px 20px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.9rem' }}
                            />
                            <button
                                onClick={applyCoupon}
                                disabled={isValidatingCoupon || !couponCode.trim()}
                                style={{ background: '#0f172a', color: 'white', border: 'none', padding: '0 20px', borderRadius: '12px', fontWeight: '800', cursor: 'pointer', opacity: isValidatingCoupon ? 0.7 : 1 }}
                            >
                                {isValidatingCoupon ? '...' : 'Aplicar'}
                            </button>
                        </div>
                        {appliedCoupon && (
                            <div style={{ marginTop: '15px', padding: '10px 15px', background: '#f0fdf4', borderRadius: '10px', color: '#166534', fontSize: '0.85rem', fontWeight: '700', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Cupón {appliedCoupon.code} aplicado</span>
                                <span>-{appliedCoupon.discount}%</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Columna Derecha: Checkout Form */}
                <div>
                    <h2 style={{ fontSize: '2rem', fontWeight: '900', marginBottom: '30px' }}>Checkout</h2>

                    {stripeClientSecret ? (
                        <Elements stripe={stripePromise} options={{ clientSecret: stripeClientSecret }}>
                            <StripeCheckoutForm
                                clientSecret={stripeClientSecret}
                                itemsCount={cart.length}
                                total={cartTotal}
                                onPaymentSuccess={handlePaymentSuccess}
                                subtotal={cartSubtotal.toFixed(2)}
                                discount={discountAmount.toFixed(2)}
                            />
                        </Elements>
                    ) : (
                        <div style={{ background: 'white', padding: '60px', borderRadius: '24px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                            <Loader2 size={40} className="animate-spin" color="#00d2d3" style={{ margin: '0 auto 20px' }} />
                            <p style={{ color: '#64748b' }}>Preparando pasarela segura...</p>
                        </div>
                    )}

                    <div style={{ marginTop: '40px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
                            < ShieldCheck size={24} color="#22c55e" />
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b' }}>Protección al Comprador</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '10px' }}>
                            < CheckCircle2 size={24} color="#00d2d3" />
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#64748b' }}>Acceso Instantáneo</span>
                        </div>
                    </div>
                </div>

            </main>

            <Footer />
        </div>
    );
}
