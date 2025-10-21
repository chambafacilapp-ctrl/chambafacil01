// server.js — Chamba Fácil (Express + Mercado Pago v2 + Cloudinary signature + static)
// Node 18+, package.json with "type":"module"

import express from "express";
import "dotenv/config";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import fetch from "node-fetch";
import { v2 as cloudinary } from "cloudinary";
import { MercadoPagoConfig, Preference } from "mercadopago";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const {
  MP_ACCESS_TOKEN = "",
  PUBLIC_URL = "",
  PORT = 3000,
  CLOUDINARY_CLOUD_NAME = "",
  CLOUDINARY_KEY = "",
  CLOUDINARY_SECRET = "",
} = process.env;

// Mercado Pago v2
if (!MP_ACCESS_TOKEN) console.warn("⚠️ MP_ACCESS_TOKEN no configurado.");
const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });

// Cloudinary (firma)
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_KEY && CLOUDINARY_SECRET) {
  cloudinary.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_KEY, api_secret: CLOUDINARY_SECRET });
} else {
  console.warn("⚠️ Cloudinary no configurado (CLOUDINARY_* faltan).");
}

// === Precio único (centavos MXN) ===
const PLANS = { annual: 15000 }; // $150.00 MXN

// Crear preferencia (OXXO + SPEI)
app.post("/api/create-preference", async (req, res) => {
  try {
    const { plan = "annual", name = "Inscripción anual Chamba Fácil" } = req.body || {};
    const amount = Number(((PLANS[plan] ?? PLANS.annual) / 100).toFixed(2));
    const baseUrl = PUBLIC_URL || `http://localhost:${PORT}`;
    const body = {
      binary_mode: true,
      statement_descriptor: "CHAMBA FACIL",
      items: [{ title: name, quantity: 1, currency_id: "MXN", unit_price: amount }],
      back_urls: {
        success: `${baseUrl}/gracias.html?status=success`,
        failure: `${baseUrl}/gracias.html?status=failure`,
        pending: `${baseUrl}/gracias.html?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/webhooks/mercadopago`,
      payment_methods: {
        excluded_payment_types: [{ id: "credit_card" }, { id: "debit_card" }, { id: "prepaid_card" }, { id: "atm" }],
        installments: 1,
      },
    };
    const pref = await new Preference(mpClient).create({ body });
    res.json({ id: pref.id || pref?.body?.id, init_point: pref.init_point || pref?.body?.init_point, sandbox_init_point: pref.sandbox_init_point || pref?.body?.sandbox_init_point });
  } catch (e) {
    console.error("Error creando preferencia:", e);
    res.status(500).json({ error: "No se pudo crear la preferencia" });
  }
});

// Webhook (log de estado de pago)
app.post("/webhooks/mercadopago", async (req, res) => {
  try {
    const topic = req.body?.type || req.query?.topic;
    const paymentId = req.body?.data?.id || req.query?.id;
    if (topic === "payment" && paymentId) {
      const r = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } });
      const p = await r.json();
      console.log("Webhook pago:", p.status, p.status_detail, p.payment_type_id, p.payment_method_id);
      // TODO: activar perfil en Firestore si status === 'approved'
    } else {
      console.log("Webhook sin paymentId/topic:", { body: req.body, query: req.query });
    }
    res.sendStatus(200);
  } catch (e) {
    console.error("Webhook error:", e);
    res.sendStatus(200);
  }
});

// Firma Cloudinary
app.get("/api/signature", (_req, res) => {
  try {
    if (!CLOUDINARY_SECRET || !CLOUDINARY_KEY || !CLOUDINARY_CLOUD_NAME) return res.status(400).json({ error: "Cloudinary no configurado" });
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `timestamp=${timestamp}`;
    const signature = crypto.createHash("sha1").update(paramsToSign + CLOUDINARY_SECRET).digest("hex");
    res.json({ timestamp, signature, apiKey: CLOUDINARY_KEY, cloudName: CLOUDINARY_CLOUD_NAME });
  } catch (e) {
    res.status(500).json({ error: "No se pudo firmar" });
  }
});

// Estáticos + fallback
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.listen(PORT, () => console.log(`✅ Servidor en http://localhost:${PORT}`));
