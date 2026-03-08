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

    const existProd = await request({
        hostname: BASE_URL,
        path: '/v1/catalogs/products?page_size=1',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    let productId = null;
    if (existProd.data && existProd.data.products && existProd.data.products.length > 0) {
        productId = existProd.data.products[0].id;
    } else {
        const prodRes = await request({
            hostname: BASE_URL,
            path: '/v1/catalogs/products',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        }, JSON.stringify({
            name: 'MixCommunity Suscripciones',
            description: 'Planes de almacenamiento para MixCommunity',
            type: 'DIGITAL',
            category: 'SOFTWARE'
        }));
        productId = prodRes.data.id;
    }

    console.log("Product ID:", productId);

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
        name: `Plan Vendedor MixCommunity`,
        description: `Suscripción mensual Vendedor MixCommunity (3 meses a $1.99, luego $9.99)`,
        status: "ACTIVE",
        billing_cycles: [
            {
                frequency: { interval_unit: "MONTH", interval_count: 1 },
                tenure_type: "TRIAL",
                sequence: 1,
                total_cycles: 3,
                pricing_scheme: {
                    fixed_price: { value: "1.99", currency_code: "USD" }
                }
            },
            {
                frequency: { interval_unit: "MONTH", interval_count: 1 },
                tenure_type: "REGULAR",
                sequence: 2,
                total_cycles: 0,
                pricing_scheme: {
                    fixed_price: { value: "9.99", currency_code: "USD" }
                }
            }
        ],
        payment_preferences: {
            auto_bill_outstanding: true,
            setup_fee_failure_action: "CONTINUE",
            payment_failure_threshold: 3
        }
    }));

    if (planRes.statusCode === 200 || planRes.statusCode === 201) {
        console.log(`PLAN_ID_GENERADO=`, planRes.data.id);
    } else {
        console.error("Error generating plan:", planRes.data.details || planRes.data);
    }
}

run().catch(console.error);
