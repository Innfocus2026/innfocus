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
    const { codigo } = JSON.parse(event.body);
    if (!codigo) {
      return { statusCode: 400, headers, body: JSON.stringify({ valido: false, error: 'Código requerido' }) };
    }

    // Leer códigos desde variable de entorno
    const codigosEnv = process.env.CODIGOS_ACTIVOS || '';
    const codigosMap = {};
    codigosEnv.split(',').forEach(item => {
      const [cod, usos] = item.trim().split(':');
      if (cod) codigosMap[cod.toUpperCase()] = parseInt(usos) || 0;
    });

    const codigoUp = codigo.toUpperCase().trim();

    if (!(codigoUp in codigosMap)) {
      return { statusCode: 200, headers, body: JSON.stringify({ valido: false, error: 'Código no válido' }) };
    }

    // Leer usos actuales desde Netlify Blobs via REST API
    const siteId = process.env.INNFOCUS_SITE_ID;
    const token = process.env.NETLIFY_TOKEN;
    const blobUrl = `https://api.netlify.com/api/v1/blobs/${siteId}/innfocus-codigos/${codigoUp}`;

    let usosActuales = 0;
    try {
      const getRes = await fetch(blobUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (getRes.ok) {
        const text = await getRes.text();
        usosActuales = parseInt(text) || 0;
      }
    } catch(e) {
      usosActuales = 0;
    }

    const usosMaximos = codigosMap[codigoUp];
    const usosRestantes = usosMaximos - usosActuales;

    if (usosRestantes <= 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ valido: false, error: 'Este código ya agotó sus usos disponibles' })
      };
    }

    // Guardar nuevo conteo
    await fetch(blobUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body: String(usosActuales + 1)
    });

    return {
      statusCode: 200, headers,
      body: JSON.stringify({
        valido: true,
        usosRestantes: usosRestantes - 1,
        mensaje: 'Código válido'
      })
    };

  } catch(error) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ valido: false, error: 'Error interno: ' + error.message })
    };
  }
};
