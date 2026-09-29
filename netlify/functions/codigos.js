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

    const codigoUp = codigo.toUpperCase().trim();
    const siteId = process.env.INNFOCUS_SITE_ID;
    const token = process.env.NETLIFY_TOKEN;

    // === PASO 1: Buscar en variable de entorno (códigos manuales) ===
    const codigosEnv = process.env.CODIGOS_ACTIVOS || '';
    const codigosMap = {};
    codigosEnv.split(',').forEach(item => {
      const [cod, usos] = item.trim().split(':');
      if (cod) codigosMap[cod.toUpperCase()] = parseInt(usos) || 0;
    });

    let usosMaximos = null;

    if (codigoUp in codigosMap) {
      // Código manual encontrado en env
      usosMaximos = codigosMap[codigoUp];
    } else {
      // === PASO 2: Buscar en Blobs (códigos generados por compra) ===
      const regUrl = `https://api.netlify.com/api/v1/blobs/${siteId}/innfocus-codigos/REGISTRO_${codigoUp}`;
      try {
        const regRes = await fetch(regUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (regRes.ok) {
          const registro = await regRes.json();
          usosMaximos = registro.usos || 0;
        }
      } catch(e) {
        // No se encontró registro
      }
    }

    if (usosMaximos === null) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ valido: false, error: 'Código no válido' })
      };
    }

    // === PASO 3: Verificar y actualizar conteo de usos ===
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

    const usosRestantes = usosMaximos - usosActuales;

    if (usosRestantes <= 0) {
      return {
        statusCode: 200, headers,
        body: JSON.stringify({ valido: false, error: 'Este código ya agotó sus usos disponibles' })
      };
    }

    // Incrementar conteo
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
