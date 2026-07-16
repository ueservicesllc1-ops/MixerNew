import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { createObjectCsvStringifier } from 'csv-writer';

// ── Planes VIP de la app móvil ────────────────────────────────────
const VIP_PLAN_IDS = ['vip1', 'vip2', 'vip3', 'zion_desktop_pro_online'];

const PLAN_LABELS = {
    'vip1': 'Básico VIP ($7.99/mes | 10 GB)',
    'vip2': 'Estándar VIP ($9.99/mes | 20 GB)',
    'vip3': 'Plus VIP ($12.99/mes | 50 GB)',
    'zion_desktop_pro_online': 'Zion Stage PRO Online ($5.99/mes | 20 GB)',
    'free': 'Gratis',
    'std1': 'Básico ($4.99/mes)',
    'std2': 'Estándar ($6.99/mes)',
    'std3': 'Plus ($9.99/mes)',
    'zion_desktop_pro_local': 'Zion Stage PRO PC ($1.99/mes)',
    'seller': 'Vendedor MixCommunity ($1.99/mes)',
};

// ── Inicializar Firebase Admin ────────────────────────────────────
const serviceAccount = JSON.parse(
    readFileSync('./e:/Mixer/.secrets/freedommix-c5c3e-firebase-adminsdk-fbsvc-bb80ba4e1e.json', 'utf8')
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

function fmtDate(ts) {
    if (!ts) return 'N/A';
    try {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        return d.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' }) +
            ' ' + d.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });
    } catch { return 'N/A'; }
}

async function main() {
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('        REPORTE DE USUARIOS VIP — MIXER APP MÓVIL');
    console.log(`        Generado: ${new Date().toLocaleString('es-EC')}`);
    console.log('═══════════════════════════════════════════════════════════\n');

    // ── Traer TODOS los usuarios para calcular totales ────────────
    const allSnap = await db.collection('users').get();
    const allUsers = [];
    allSnap.forEach(doc => allUsers.push({ id: doc.id, ...doc.data() }));

    const totalUsers = allUsers.length;
    const vipUsers = allUsers.filter(u => VIP_PLAN_IDS.includes(u.planId));

    // ── Estadísticas globales ─────────────────────────────────────
    const planCounts = {};
    allUsers.forEach(u => {
        const pid = u.planId || 'free';
        planCounts[pid] = (planCounts[pid] || 0) + 1;
    });

    console.log('📊 RESUMEN GENERAL');
    console.log('───────────────────────────────────────────────────────────');
    console.log(`  Total usuarios registrados : ${totalUsers}`);
    console.log(`  Usuarios con plan VIP       : ${vipUsers.length}`);
    console.log(`  Penetración VIP             : ${((vipUsers.length / totalUsers) * 100).toFixed(1)}%`);
    console.log();

    console.log('📋 DISTRIBUCIÓN POR PLAN');
    console.log('───────────────────────────────────────────────────────────');
    const sortedPlans = Object.entries(planCounts).sort((a, b) => b[1] - a[1]);
    sortedPlans.forEach(([planId, count]) => {
        const label = PLAN_LABELS[planId] || planId;
        const isVip = VIP_PLAN_IDS.includes(planId);
        const pct = ((count / totalUsers) * 100).toFixed(1);
        const marker = isVip ? '⭐' : '  ';
        console.log(`  ${marker} ${label.padEnd(38)} ${String(count).padStart(4)} usuarios  (${pct}%)`);
    });
    console.log();

    // ── Detalle de usuarios VIP ───────────────────────────────────
    if (vipUsers.length === 0) {
        console.log('⚠️  No se encontraron usuarios con plan VIP.');
        return;
    }

    // Ordenar: primero por plan, luego por fecha de creación desc
    const planOrder = { 'vip3': 0, 'vip2': 1, 'vip1': 2, 'zion_desktop_pro_online': 3 };
    vipUsers.sort((a, b) => {
        const po = (planOrder[a.planId] ?? 99) - (planOrder[b.planId] ?? 99);
        if (po !== 0) return po;
        const ta = a.createdAt?.toMillis?.() || 0;
        const tb = b.createdAt?.toMillis?.() || 0;
        return tb - ta;
    });

    console.log('👥 LISTA DE USUARIOS VIP');
    console.log('───────────────────────────────────────────────────────────');
    vipUsers.forEach((u, i) => {
        const label = PLAN_LABELS[u.planId] || u.planId;
        const status = u.stripeSubscriptionStatus || 'N/A';
        const statusIcon = status === 'active' ? '✅' : status === 'canceled' ? '❌' : '⏳';
        console.log(`\n  [${String(i + 1).padStart(2, '0')}] ${u.email || 'sin email'}`);
        console.log(`       UID    : ${u.id}`);
        console.log(`       Plan   : ${label}`);
        console.log(`       Estado : ${statusIcon} ${status}`);
        console.log(`       Nombre : ${u.displayName || 'N/A'}`);
        console.log(`       Registro: ${fmtDate(u.createdAt)}`);
        if (u.customStorageGB) console.log(`       Storage: ${u.customStorageGB} GB (custom)`);
        if (u.stripeSubscriptionId) console.log(`       Stripe ID: ${u.stripeSubscriptionId}`);
    });

    // ── Exportar CSV ──────────────────────────────────────────────
    const csvRows = vipUsers.map(u => [
        u.email || '',
        u.displayName || '',
        u.id,
        u.planId || '',
        PLAN_LABELS[u.planId] || u.planId || '',
        u.stripeSubscriptionStatus || '',
        u.stripeSubscriptionId || '',
        u.customStorageGB || '',
        fmtDate(u.createdAt),
    ].join(','));

    const csvHeader = 'email,nombre,uid,planId,planNombre,stripeStatus,stripeSubId,customStorageGB,registrado';
    const csvContent = [csvHeader, ...csvRows].join('\n');

    const { writeFileSync } = await import('fs');
    const outPath = './scratch/reporte_vip_output.csv';
    writeFileSync(outPath, csvContent, 'utf8');

    console.log('\n───────────────────────────────────────────────────────────');
    console.log(`✅ Reporte CSV guardado en: ${outPath}`);
    console.log(`   Total usuarios VIP: ${vipUsers.length}`);
    console.log('═══════════════════════════════════════════════════════════\n');
}

main().catch(e => {
    console.error('❌ Error generando reporte:', e);
    process.exit(1);
});
