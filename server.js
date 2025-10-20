// server.js — Chamba Fácil (Express + Mercado Pago v2 + Cloudinary signature + static)
// Requisitos: Node 18+, "type": "module" en package.json

import express from "express";
import "dotenv/config";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import fetch from "node-fetch";
import { v2 as cloudinary } from "cloudinary";

// Mercado Pago v2
import { MercadoPagoConfig, Preference } from "mercadopago";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// === Env ===
const {
  MP_ACCESS_TOKEN = "",
  PUBLIC_URL = "",
  PORT = 3000,
  CLOUDINARY_CLOUD_NAME = "",
  CLOUDINARY_KEY = "",
  CLOUDINARY_SECRET = "",
} = process.env;

// === Mercado Pago (v2) ===
if (!MP_ACCESS_TOKEN) {
  console.warn("⚠️  MP_ACCESS_TOKEN no configurado.");
}
const mpClient = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });

// === Cloudinary (firma de uploads) ===
if (CLOUDINARY_CLOUD_NAME && CLOUDINARY_KEY && CLOUDINARY_SECRET) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_KEY,
    api_secret: CLOUDINARY_SECRET,
  });
} else {
  console.warn("⚠️  Cloudinary no configurado (CLOUDINARY_* faltan).");
}

// === Precios (centavos MXN) ===
const PLANS = {
  basic: 499000,        // $4,990.00
  professional: 999000, // $9,990.00
  advanced: 1799000,    // $17,990.00
};

// ---------------------------------------------------------------------
// Crear preferencia de pago (Checkout Pro) solo OXXO y Transferencia
// Frontend llama a: POST /api/create-preference { plan: "basic"|"professional"|"advanced" }
// ---------------------------------------------------------------------
app.post("/api/create-preference", async (req, res) => {
  try {
    const { plan = "professional", name = "Suscripción anual Chamba Fácil" } =
      req.body || {};
    const amount = Number(((PLANS[plan] ?? PLANS.professional) / 100).toFixed(2));
    const baseUrl = PUBLIC_URL || `http://localhost:${PORT}`;

    const body = {
      binary_mode: true,
      statement_descriptor: "CHAMBA FACIL",
      items: [
        {
          title: name,
          quantity: 1,
          currency_id: "MXN",
          unit_price: amount,
        },
      ],
      back_urls: {
        success: `${baseUrl}/gracias.html?status=success`,
        failure: `${baseUrl}/gracias.html?status=failure`,
        pending: `${baseUrl}/gracias.html?status=pending`,
      },
      auto_return: "approved",
      notification_url: `${baseUrl}/webhooks/mercadopago`,
      payment_methods: {
        // Habilitamos efectivo (ticket/OXXO) y bank_transfer (SPEI) excluyendo tarjetas/cajero
        excluded_payment_types: [
          { id: "credit_card" },
          { id: "debit_card" },
          { id: "prepaid_card" },
          { id: "atm" },
        ],
        installments: 1,
      },
    };

    // SDK v2
    const pref = await new Preference(mpClient).create({ body });
    // pref.body contiene los datos; para compatibilidad devolvemos init_point
    res.json({
      id: pref.id || pref?.body?.id,
      init_point: pref.init_point || pref?.body?.init_point,
      sandbox_init_point:
        pref.sandbox_init_point || pref?.body?.sandbox_init_point,
    });
  } catch (error) {
    console.error("Error creando preferencia:", error);
    res.status(500).json({ error: "No se pudo crear la preferencia" });
  }
});

// ---------------------------------------------------------------------
// Webhook de Mercado Pago (confirmación de pagos)
// Configurado arriba en notification_url
// ---------------------------------------------------------------------
app.post("/webhooks/mercadopago", async (req, res) => {
  try {
    // MP envía a veces por body (type/data.id) y a veces por query (topic/id)
    const topic = req.body?.type || req.query?.topic;
    const paymentId = req.body?.data?.id || req.query?.id;

    if (topic === "payment" && paymentId) {
      const resp = await fetch(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } }
      );
      const payment = await resp.json();
      console.log(
        "Webhook pago:",
        payment.status,
        payment.status_detail,
        payment.payment_type_id,
        payment.payment_method_id
      );

      // TODO: activar el perfil del usuario si payment.status === 'approved'
      // (por ejemplo, marcar activo en tu base de datos / Firestore)
    } else {
      console.log("Webhook recibido sin paymentId/topic:", {
        body: req.body,
        query: req.query,
      });
    }

    res.sendStatus(200);
  } catch (e) {
    console.error("Error en webhook:", e?.message || e);
    // Responder 200 para que MP no reintente indefinidamente por error de servidor
    res.sendStatus(200);
  }
});

// ---------------------------------------------------------------------
// Firma de Cloudinary (subidas firmadas desde el cliente)
// Frontend llama a: GET /api/signature  -> { timestamp, signature, apiKey, cloudName }
// ---------------------------------------------------------------------
app.get("/api/signature", (_req, res) => {
  try {
    if (!CLOUDINARY_SECRET || !CLOUDINARY_KEY || !CLOUDINARY_CLOUD_NAME) {
      return res.status(400).json({ error: "Cloudinary no configurado" });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const paramsToSign = `timestamp=${timestamp}`;
    const signature = crypto
      .createHash("sha1")
      .update(paramsToSign + CLOUDINARY_SECRET)
      .digest("hex");

    return res.json({
      timestamp,
      signature,
      apiKey: CLOUDINARY_KEY,
      cloudName: CLOUDINARY_CLOUD_NAME,
    });
  } catch (e) {
    console.error("Error firmando Cloudinary:", e?.message || e);
    res.status(500).json({ error: "No se pudo firmar" });
  }
});

// ---------------------------------------------------------------------
// Estáticos + Health + SPA fallback
// ---------------------------------------------------------------------
app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (_req, res) =>
  res.sendFile(path.join(__dirname, "public", "index.html"))
);

// ---------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`✅ Servidor Chamba Fácil listo en http://localhost:${PORT}`);
});
