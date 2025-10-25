import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
const MP_PUBLIC_KEY = process.env.MP_PUBLIC_KEY;

app.post('/api/create-preference', async (req, res) => {
  try {
    const { plan } = req.body || {};
    if (plan !== 'annual') return res.status(400).json({ error: 'plan inválido' });

    const items = [{
      title: 'Inscripción anual Chamba Fácil',
      description: 'Publica tu perfil y aparece en el mapa cercano',
      unit_price: 150,
      currency_id: 'MXN',
      quantity: 1
    }];

    const back_urls = {
      success: `${req.protocol}://${req.get('host')}/mp-success.html`,
      failure: `${req.protocol}://${req.get('host')}/mp-failure.html`,
      pending: `${req.protocol}://${req.get('host')}/mp-pending.html`
    };

    const prefRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items, back_urls, auto_return: 'approved',
        statement_descriptor: 'CHAMBA FACIL',
        metadata: { plan }
      })
    });

    const pref = await prefRes.json();
    if (!pref || !pref.init_point)
      return res.status(500).json({ error: 'No se pudo crear la preferencia', pref });

    res.json({ init_point: pref.init_point, sandbox_init_point: pref.sandbox_init_point });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'error interno' });
  }
});

app.use(express.static('public'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Servidor Chamba Fácil activo en puerto', PORT));