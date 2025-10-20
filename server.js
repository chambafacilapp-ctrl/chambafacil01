import express from 'express';
import 'dotenv/config';
import cors from 'cors';
import fetch from 'node-fetch';
import mercadopago from 'mercadopago';
import crypto from 'crypto';
import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

const {
  MP_ACCESS_TOKEN = '',
  PORT = 3000,
  PUBLIC_URL = '',
  CLOUDINARY_CLOUD_NAME = '',
  CLOUDINARY_KEY = '',
  CLOUDINARY_SECRET = ''
} = process.env;

if (!MP_ACCESS_TOKEN) {
  console.warn('⚠️  MP_ACCESS_TOKEN no configurado.');
}
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_KEY && CLOUDINARY_SECRET) {
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_KEY, api_secret: CLOUDINARY_SECRET });
} else {
  console.warn('⚠️  Cloudinary no configurado: CLOUDINARY_* faltan.');
}

mercadopago.configure({ access_token: MP_ACCESS_TOKEN });

// Precios (centavos MXN)
const PLANS = { basic: 499000, professional: 999000, advanced: 1799000 };

// Crear preferencia de pago (solo OXXO y SPEI)
app.post('/api/create-preference', async (req, res) => {
  try {
    const { plan = 'professional', name = 'Suscripción anual Chamba Fácil' } = req.body || {};
    const amount = Number(((PLANS[plan] ?? PLANS.professional) / 100).toFixed(2));
    const baseUrl = PUBLIC_URL || `http://localhost:${PORT}`;

    const preference = {
      binary_mode: true,
      statement_descriptor: 'CHAMBA FACIL',
      items: [{ title: name, quantity: 1, currency_id: 'MXN', unit_price: amount }],
      back_urls: {
        success: `${baseUrl}/gracias.html?status=success`,
        failure: `${baseUrl}/gracias.html?status=failure`,
        pending: `${baseUrl}/gracias.html?status=pending`
      },
      auto_return: 'approved',
      notification_url: `${baseUrl}/webhooks/mercadopago`,
      payment_methods: {
        excluded_payment_types: [
          { id: 'credit_card' }, { id: 'debit_card' }, { id: 'prepaid_card' }, { id: 'atm' }
        ],
        installments: 1
      }
    };

    const response = await mercadopago.preferences.create(preference);
    return res.json({ id: response.body.id, init_point: response.body.init_point, sandbox_init_point: response.body.sandbox_init_point });
  } catch (e) {
    console.error('Error preferencia:', e?.message || e);
    res.status(500).json({ error: 'No se pudo crear la preferencia' });
  }
});

// Webhook Mercado Pago
app.post('/webhooks/mercadopago', async (req, res) => {
  try {
    const { type, data } = req.body || {};
    const paymentId = data?.id || req.query?.id;
    const topic = type || req.query?.topic;
    if (topic === 'payment' && paymentId) {
      const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` }
      });
      const payment = await resp.json();
      console.log('Webhook pago:', payment.status, payment.status_detail, payment.payment_type_id, payment.payment_method_id);
      // TODO: activar perfil si status === 'approved'
    } else {
      console.log('Webhook recibió:', req.body, req.query);
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('Webhook error:', e?.message || e);
    res.sendStatus(200);
  }
});

// Firma de Cloudinary (subidas firmadas)
app.get('/api/signature', (req, res) => {
  try {
    if (!CLOUDINARY_SECRET || !CLOUDINARY_KEY || !CLOUDINARY_CLOUD_NAME) {
      return res.status(400).json({ error: 'Cloudinary no configurado' });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const params = `timestamp=${timestamp}`;
    const signature = crypto.createHash('sha1').update(params + CLOUDINARY_SECRET).digest('hex');
    return res.json({ timestamp, signature, apiKey: CLOUDINARY_KEY, cloudName: CLOUDINARY_CLOUD_NAME });
  } catch (e) {
    res.status(500).json({ error: 'No se pudo firmar' });
  }
});

// Estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`✅ Servidor listo en http://localhost:${PORT}`));
