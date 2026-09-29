exports.handler = async function(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };
  try {
    const ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;
    const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
    const SITE_ID = process.env.INNFOCUS_SITE_ID;
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    const body = JSON.parse(event.body || '{}');

    // Solo procesamos pagos
    if (body.type !== 'payment') {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // Obtener datos del pago desde Mercado Pago
    const pagoRes = await fetch(`https://api.mercadopago.com/v1/payments/${body.data.id}`, {
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` }
    });
    const pago = await pagoRes.json();

    if (pago.status !== 'approved') {
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // Extraer paquete y email de la referencia externa
    const [paquete, email] = (pago.external_reference || '').split('|');
    const usos = paquete === 'pro' ? 50 : 20;
    const nombrePaquete = paquete === 'pro' ? 'Pro (50 planes)' : 'Básico (20 planes)';

    // Generar código único
    const codigo = 'INN-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Date.now().toString(36).toUpperCase().slice(-4);

    // Guardar código en Netlify Blobs (conteo de usos inicializado en 0)
    const blobUrl = `https://api.netlify.com/api/v1/blobs/${SITE_ID}/innfocus-codigos/${codigo}`;
    await fetch(blobUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'text/plain'
      },
      body: '0'
    });

    // Guardar registro completo del código
    const regUrl = `https://api.netlify.com/api/v1/blobs/${SITE_ID}/innfocus-codigos/REGISTRO_${codigo}`;
    await fetch(regUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, paquete, usos, fecha: new Date().toISOString(), codigo })
    });

    // Enviar correo con el código via Resend
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'InnFocus <hola@innfocus.colapp.com.co>',
        to: [email],
        subject: '✅ Tu acceso a InnFocus está listo',
        html: `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#f7f7f5;">
            <div style="background:white;border-radius:16px;padding:32px;border:0.5px solid #e5e5e5;">

              <div style="text-align:center;margin-bottom:24px;">
                <div style="font-size:24px;font-weight:700;color:#1a1a1a;">Inn<span style="color:#6B21FF;">Focus</span></div>
                <div style="font-size:13px;color:#888;margin-top:4px;">Tu herramienta de planeación estratégica</div>
              </div>

              <p style="font-size:15px;color:#1a1a1a;margin-bottom:8px;">¡Hola! Tu pago fue confirmado. 🎉</p>
              <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:24px;">
                Adquiriste el paquete <strong>${nombrePaquete}</strong>. Aquí está tu código de acceso:
              </p>

              <div style="background:#F0E8FF;border:2px solid #6B21FF;border-radius:12px;padding:20px;text-align:center;margin-bottom:24px;">
                <div style="font-size:11px;color:#4A0FBF;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">Tu código de acceso</div>
                <div style="font-size:28px;font-weight:700;color:#6B21FF;letter-spacing:0.1em;">${codigo}</div>
                <div style="font-size:12px;color:#888;margin-top:8px;">${usos} usos disponibles · Sin vencimiento</div>
              </div>

              <p style="font-size:14px;color:#555;line-height:1.6;margin-bottom:8px;"><strong>¿Cómo usarlo?</strong></p>
              <ol style="font-size:14px;color:#555;line-height:1.8;margin-bottom:24px;padding-left:20px;">
                <li>Ve a <a href="https://innfocus.colapp.com.co" style="color:#6B21FF;">innfocus.colapp.com.co</a></li>
                <li>Ingresa tu nombre, correo y WhatsApp</li>
                <li>Escribe tu código en el campo correspondiente</li>
                <li>¡Empieza a generar tu plan estratégico!</li>
              </ol>

              <div style="text-align:center;margin-bottom:24px;">
                <a href="https://innfocus.colapp.com.co" style="display:inline-block;background:#6B21FF;color:white;font-weight:600;font-size:14px;padding:12px 28px;border-radius:24px;text-decoration:none;">
                  Ir a InnFocus →
                </a>
              </div>

              <hr style="border:none;border-top:0.5px solid #e5e5e5;margin-bottom:16px;">
              <p style="font-size:12px;color:#aaa;text-align:center;margin:0;">
                ¿Tienes preguntas? Escríbenos a
                <a href="mailto:innfocus2025@gmail.com" style="color:#6B21FF;">innfocus2025@gmail.com</a>
              </p>
            </div>
          </div>
        `
      })
    });

    const emailData = await emailRes.json();
    console.log('Email enviado:', JSON.stringify(emailData));
    console.log(`PAGO APROBADO: código ${codigo} para ${email} (${usos} usos)`);

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true, codigo }) };

  } catch(error) {
    console.error('Webhook error:', error);
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
