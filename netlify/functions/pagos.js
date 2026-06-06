exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { paquete, nombre, email } = JSON.parse(event.body);
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

    const paquetes = {
      'basico': { titulo: 'InnFocus Básico — 20 planes estratégicos', precio: 18500, codigo: 'BASIC20' },
      'pro':    { titulo: 'InnFocus Pro — 50 planes estratégicos',    precio: 37000, codigo: 'PRO50'   }
    };

    const p = paquetes[paquete];
    if (!p) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Paquete no válido' }) };
    }

    const preference = {
      items: [{
        title: p.titulo,
        quantity: 1,
        unit_price: p.precio,
        currency_id: 'COP'
      }],
      payer: { name: nombre, email: email },
      back_urls: {
        success: 'https://innfocus.colapp.com.co?pago=ok&paquete=' + paquete,
        failure: 'https://innfocus.colapp.com.co?pago=error',
        pending: 'https://innfocus.colapp.com.co?pago=pendiente'
      },
      auto_return: 'approved',
      notification_url: 'https://innfocus.colapp.com.co/.netlify/functions/webhook-mp',
      external_reference: paquete + '|' + email + '|' + Date.now()
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify(preference)
    });

    const data = await res.json();

    if (data.id) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ url: data.init_point })
      };
    } else {
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: 'Error creando preferencia de pago', detail: data })
      };
    }

  } catch(error) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};
