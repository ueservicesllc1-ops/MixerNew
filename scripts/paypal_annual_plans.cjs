const https = require('https');

const CLIENT_ID = 'AbXQ6fanTIWx-dAoMagwbOTZ_M51YI4A-Dwzf2AY2CyIG7qNhV8QIiXuyBX-fina0FUxgTs8euJuAGc3';
const SECRET = 'EOlDw8jOkkGKUm9wj8sxWKT48n0JezDtW8WIKBaJhSs9RdZPMiYOjlVZwx7l9r6wU3xMRiBph5_44E00';
let BASE_URL = 'api-m.paypal.com';

function request(options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ statusCode: res.statusCode, data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function run() {
    let auth = Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64');
    let res = await request({
        hostname: BASE_URL,
        path: '/v1/oauth2/token',
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    }, 'grant_type=client_credentials');

    if (res.statusCode !== 200) {
        console.error("Auth failed:", res.data);
        return;
    }

    const token = res.data.access_token;
    console.log("Auth success. Mode:", BASE_URL);

    const productId = 'PROD-9PR44899GX773183D'; // Desde creacion anterior

    const annualPlansToCreate = [
        { id: 'std1', name: 'Básico Anual', price: ((4.99 * 12) * 0.70).toFixed(2) },
        { id: 'std2', name: 'Estándar Anual', price: ((6.99 * 12) * 0.70).toFixed(2) },
        { id: 'std3', name: 'Plus Anual', price: ((9.99 * 12) * 0.70).toFixed(2) },
        { id: 'vip1', name: 'Básico VIP Anual', price: ((7.99 * 12) * 0.70).toFixed(2) },
        { id: 'vip2', name: 'Estándar VIP Anual', price: ((9.99 * 12) * 0.70).toFixed(2) },
        { id: 'vip3', name: 'Plus VIP Anual', price: ((12.99 * 12) * 0.70).toFixed(2) }
    ];

    const planIds = {};

    for (let plan of annualPlansToCreate) {
        const planRes = await request({
            hostname: BASE_URL,
            path: '/v1/billing/plans',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        }, JSON.stringify({
            product_id: productId,
            name: `Plan ${plan.name}`,
            description: `Suscripción anual al Plan ${plan.name} de MixCommunity (30% descuento)`,
            status: "ACTIVE",
            billing_cycles: [
                {
                    frequency: { interval_unit: "YEAR", interval_count: 1 },
                    tenure_type: "REGULAR",
                    sequence: 1,
                    pricing_scheme: {
                        fixed_price: { value: plan.price.toString(), currency_code: "USD" }
                    }
                }
            ],
            payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee_failure_action: "CONTINUE",
                payment_failure_threshold: 3
            }
        }));

        planIds[plan.id] = planRes.data.id;
        console.log(`Plan ${plan.id}:`, planRes.data.id, 'Price:', plan.price);
    }

    console.log("FINAL_ANNUAL_IDS=" + JSON.stringify(planIds));
}

run().catch(console.error);
