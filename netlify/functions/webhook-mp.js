exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
    const SITE_ID = process.env.INNFOCUS_SITE_ID;
    const body = JSON.parse(event.body || '{}');

    // Solo procesamos pagos aprobados
    if (body.type !== 'payment') {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // Obtener datos del pago
    const pagoRes = await fetch(`https://api.mercadopago.com/v1/payments/${body.data.id}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const pago = await pagoRes.json();

    if (pago.status !== 'approved') {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // Extraer datos de la referencia externa
    const [paquete, email] = (pago.external_reference || '').split('|');
    const usos = paquete === 'pro' ? 50 : 20;

    // Generar código único
    const codigo = 'INN-' + Math.random().toString(36).substring(2,6).toUpperCase() + '-' + Date.now().toString(36).toUpperCase().slice(-4);

    // Guardar código en Netlify Blobs
    const blobUrl = `https://api.netlify.com/api/v1/blobs/${SITE_ID}/innfocus-codigos/${codigo}`;
    await fetch(blobUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'text/plain'
      },
      body: '0'
    });

    // Registrar código en variable dinámica (guardamos en blob de registro)
    const regUrl = `https://api.netlify.com/api/v1/blobs/${SITE_ID}/innfocus-codigos/REGISTRO_${codigo}`;
    await fetch(regUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, paquete, usos, fecha: new Date().toISOString(), codigo })
    });

    // Enviar código por WhatsApp (notificación a Josue)
    const msg = `Nuevo pago InnFocus%0APaquete: ${paquete}%0AEmail: ${email}%0ACódigo generado: ${codigo}%0AUsos: ${usos}`;
    // Solo log — el envío de WhatsApp lo hace Josue manualmente por ahora
    console.log(`PAGO APROBADO: código ${codigo} para ${email} (${usos} usos)`);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, codigo }) };

  } catch(error) {
    console.error('Webhook error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
