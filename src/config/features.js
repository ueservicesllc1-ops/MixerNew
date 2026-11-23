// Interruptores globales de funciones (nada se borra, todo es 100% reversible).
// Poner SHOP_ENABLED = true para reactivar la venta de multitracks (tienda/vendedores/checkout).
export const SHOP_ENABLED = false;

// Poner PAID_PLANS_ENABLED = true (ej. en 2 meses) para reactivar los planes de pago
// Estándar (50 GB) y VIP (300 GB + Base de datos VIP), Stripe y la promo ZION99.
// Mientras esté en false: cuentas 100% gratis con 5 GB, setlists y canciones ilimitadas,
// todas las plataformas (Web, iOS, Android, Windows) y sin acceso al catálogo VIP.
export const PAID_PLANS_ENABLED = false;
export const FREE_LAUNCH_STORAGE_GB = 5;

